import { useEffect, useRef, useState } from 'react';

const vertexSource = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  uniform vec2 u_rotation;
  uniform float u_roll;
  uniform float u_aspect;
  varying vec3 v_position;
  varying vec3 v_normal;
  mat3 rotation() {
    float x = u_rotation.x, y = u_rotation.y, z = u_roll;
    mat3 rx = mat3(1.,0.,0., 0.,cos(x),sin(x), 0.,-sin(x),cos(x));
    mat3 ry = mat3(cos(y),0.,-sin(y), 0.,1.,0., sin(y),0.,cos(y));
    mat3 rz = mat3(cos(z),sin(z),0., -sin(z),cos(z),0., 0.,0.,1.);
    return rz * ry * rx;
  }
  void main() {
    mat3 r = rotation();
    vec3 p = r * a_position;
    v_position = p; v_normal = r * a_normal;
    float depth = 4.8 - p.z;
    gl_Position = vec4(p.x * 3.6 / u_aspect, p.y * 3.6, depth * 1.002 - .2002, depth);
  }
`;
const fragmentSource = `
  precision highp float;
  varying vec3 v_position;
  varying vec3 v_normal;
  uniform vec3 u_primary;
  uniform vec3 u_background;
  uniform vec3 u_foreground;
  vec3 studio(vec3 d) {
    float horizon = smoothstep(-.7, .8, d.y);
    vec3 env = mix(mix(u_foreground, u_primary, .64), mix(u_primary, u_background, .82), horizon);
    float panel = smoothstep(.79, .87, dot(d, normalize(vec3(-.8, 1.4, 1.6))));
    float edge = pow(max(0., dot(d, normalize(vec3(1.6, .2, .7)))), 24.);
    float floor = 1. - smoothstep(-.6, -.1, d.y);
    env = mix(env, u_background, clamp(panel * .97 + edge * .76, 0., 1.));
    return mix(env, mix(u_foreground, u_primary, .45), floor * .48);
  }
  void main() {
    vec3 n = normalize(v_normal);
    vec3 view = normalize(vec3(0., 0., 4.8) - v_position);
    vec3 light = normalize(vec3(-2., 3., 4.));
    float diffuse = max(dot(n, light), 0.);
    float fresnel = pow(1. - max(dot(n, view), 0.), 4.);
    vec3 base = mix(mix(u_foreground, u_primary, .72), u_primary, .4 + diffuse * .6);
    vec3 color = mix(base, studio(reflect(-view, n)), .66 + fresnel * .26);
    float spec = pow(max(dot(n, normalize(light + view)), 0.), 110.);
    float rim = pow(max(dot(n, normalize(vec3(2., -.4, 1.))), 0.), 40.);
    color = mix(color, u_background, clamp(spec * .84 + rim * .36, 0., .9));
    float grain = sin(v_position.x * 190.) * sin(v_position.y * 170.) * sin(v_position.z * 210.);
    color = mix(color, u_background, max(grain, 0.) * .008);
    gl_FragColor = vec4(color, 1.);
  }
`;

type Vector = [number, number, number];
const normalize = (v: Vector): Vector => { const length = Math.hypot(...v) || 1; return v.map(n => n / length) as Vector; };
const subtract = (a: Vector, b: Vector): Vector => a.map((n, i) => n - b[i]) as Vector;
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function knotGeometry() {
  const lengthSegments = 320, tubeSegments = 32;
  const positions: number[] = [], normals: number[] = [], indices: number[] = [];
  const center = (t: number): Vector => {
    const radius = .81 + .27 * Math.cos(3 * t);
    return [radius * Math.cos(2 * t), radius * Math.sin(2 * t), .34 * Math.sin(3 * t)];
  };
  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments * Math.PI * 2, p = center(t);
    const tangent = normalize(subtract(center(t + .001), center(t - .001)));
    const radial: Vector = [Math.cos(2 * t), Math.sin(2 * t), 0];
    const binormal = normalize(cross(tangent, radial)), normal = normalize(cross(binormal, tangent));
    for (let j = 0; j <= tubeSegments; j++) {
      const angle = j / tubeSegments * Math.PI * 2;
      const n = normal.map((v, axis) => v * Math.cos(angle) + binormal[axis] * Math.sin(angle)) as Vector;
      normals.push(...n); positions.push(...p.map((v, axis) => v + n[axis] * .185));
      if (i < lengthSegments && j < tubeSegments) {
        const a = i * (tubeSegments + 1) + j, b = a + tubeSegments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}
function readColor(name: string): Float32Array {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = value.length === 4 ? `#${value.slice(1).split('').map(channel => channel + channel).join('')}` : value;
  return new Float32Array([1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255));
}

export default function LiquidField({ className = '', paused = false }: { className?: string; paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const resumeRef = useRef<(() => void) | null>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => { pausedRef.current = paused; resumeRef.current?.(); }, [paused]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power', premultipliedAlpha: false });
    if (!gl) { setFallback(true); return; }
    const shaders: WebGLShader[] = [], buffers: WebGLBuffer[] = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type); if (!shader) return null;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
      shaders.push(shader); return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource), program = gl.createProgram();
    if (!vertex || !fragment || !program) { shaders.forEach(shader => gl.deleteShader(shader)); if (program) gl.deleteProgram(program); setFallback(true); return; }
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); setFallback(true); return; }
    gl.useProgram(program);
    const geometry = knotGeometry();
    for (const [name, data] of [['a_position', geometry.positions], ['a_normal', geometry.normals]] as const) {
      const buffer = gl.createBuffer(); if (buffer) buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    }
    const elementBuffer = gl.createBuffer(); if (elementBuffer) buffers.push(elementBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
    for (const name of ['primary', 'background', 'foreground']) gl.uniform3fv(gl.getUniformLocation(program, `u_${name}`), readColor(`--${name}`));
    const rotation = gl.getUniformLocation(program, 'u_rotation'), roll = gl.getUniformLocation(program, 'u_roll'), aspect = gl.getUniformLocation(program, 'u_aspect');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const target = { x: 0, y: 0 }, pointer = { x: 0, y: 0 };
    let frame = 0, inView = true, disposed = false, lastTime = 0, elapsed = 0, lastDraw = 0;
    const draw = (timestamp: number) => {
      frame = 0;
      if (disposed || document.hidden || !inView || gl.isContextLost()) return;
      if (timestamp - lastDraw >= 1000 / 40 || motion.matches || pausedRef.current) {
        if (!motion.matches && !pausedRef.current && lastTime) elapsed += Math.min((timestamp - lastTime) / 1000, .08);
        lastTime = timestamp; lastDraw = timestamp;
        pointer.x += (target.x - pointer.x) * .065; pointer.y += (target.y - pointer.y) * .065;
        gl.uniform2f(rotation, .4 + Math.sin(elapsed * .2) * .16 + pointer.y * .18, -.35 + elapsed * .13 + pointer.x * .22);
        gl.uniform1f(roll, -.24 + Math.sin(elapsed * .13) * .10);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
      }
      if (!motion.matches && !pausedRef.current) frame = requestAnimationFrame(draw);
    };
    const resume = () => { if (frame) cancelAnimationFrame(frame); lastTime = lastDraw = 0; if (!disposed && !document.hidden && inView) frame = requestAnimationFrame(draw); };
    resumeRef.current = resume;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio)); canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform1f(aspect, canvas.width / canvas.height); resume();
    };
    const move = (event: PointerEvent) => {
      if (motion.matches || pausedRef.current || event.pointerType === 'touch') return;
      const b = canvas.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, (event.clientX - b.left) / b.width * 2 - 1)); target.y = Math.max(-1, Math.min(1, (event.clientY - b.top) / b.height * 2 - 1));
    };
    const lost = (event: Event) => { event.preventDefault(); if (frame) cancelAnimationFrame(frame); frame = 0; setFallback(true); };
    const restored = () => setFallback(true);
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; resume(); }); observer.observe(canvas);
    window.addEventListener('pointermove', move, { passive: true }); document.addEventListener('visibilitychange', resume); motion.addEventListener('change', resume);
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored); resize();
    return () => {
      disposed = true; resumeRef.current = null; if (frame) cancelAnimationFrame(frame); resizeObserver.disconnect(); observer.disconnect();
      window.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', resume); motion.removeEventListener('change', resume);
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      buffers.forEach(buffer => gl.deleteBuffer(buffer)); shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program);
    };
  }, []);
  return <div className={`liquid-field ${className}`} aria-hidden="true"><canvas ref={canvasRef} className={fallback ? 'sculpture-canvas is-unavailable' : 'sculpture-canvas'} />{fallback && <div className="sculpture-fallback"><span /><span /><span /></div>}</div>;
}
