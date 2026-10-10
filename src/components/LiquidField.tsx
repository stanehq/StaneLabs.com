import { useEffect, useRef, useState } from 'react';

const vertexSource = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  attribute float a_occlusion;
  uniform vec2 u_rotation;
  uniform float u_roll;
  uniform float u_aspect;
  varying vec3 v_position;
  varying vec3 v_normal;
  varying float v_occlusion;
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
    v_position = p; v_normal = r * a_normal; v_occlusion = a_occlusion;
    float depth = 4.8 - p.z;
    gl_Position = vec4(p.x * 3.6 / u_aspect, p.y * 3.6, depth * 1.002 - .2002, depth);
  }
`;
const fragmentSource = `
  precision highp float;
  varying vec3 v_position;
  varying vec3 v_normal;
  varying float v_occlusion;
  uniform vec3 u_primary;
  uniform vec3 u_background;
  uniform vec3 u_foreground;
  vec3 linearColor(vec3 color) {
    return pow(color, vec3(2.2));
  }
  vec3 studio(vec3 direction, vec3 blue, vec3 white, vec3 dark) {
    float horizon = smoothstep(-.85, .85, direction.y);
    vec3 environment = mix(mix(dark, blue, .45), mix(blue, white, .22), horizon);
    float softbox = pow(smoothstep(.15, .96, dot(direction, normalize(vec3(-.8, 1.4, 1.6)))), 1.4);
    float fill = pow(max(dot(direction, normalize(vec3(1.6, .3, 1.1))), 0.), 7.);
    float lower = 1. - smoothstep(-.8, -.15, direction.y);
    environment = mix(environment, mix(dark, blue, .62), lower * .32);
    return mix(environment, white, clamp(softbox * .76 + fill * .22, 0., .88));
  }
  void main() {
    vec3 blue = linearColor(u_primary);
    vec3 white = linearColor(u_background);
    vec3 dark = linearColor(u_foreground);
    vec3 n = normalize(v_normal);
    vec3 view = normalize(vec3(0., 0., 4.8) - v_position);
    vec3 key = normalize(vec3(-2.4, 3.5, 4.));
    vec3 fill = normalize(vec3(2.6, .3, 2.));
    float keyLight = max(dot(n, key), 0.);
    float fillLight = max(dot(n, fill), 0.);
    float facing = max(dot(n, view), 0.);
    float fresnel = pow(1. - facing, 5.);
    float diffuse = clamp(.28 + keyLight * .55 + fillLight * .13, 0., 1.);
    vec3 base = mix(dark, blue, diffuse);
    vec3 reflection = studio(reflect(-view, n), blue, white, dark);
    vec3 color = mix(base, reflection, .28 + fresnel * .38);
    color = mix(mix(dark, blue, .48), color, v_occlusion);
    float halfAngle = max(dot(n, normalize(key + view)), 0.);
    float broadHighlight = pow(halfAngle, 24.);
    float satinHighlight = pow(halfAngle, 58.);
    float edgeLight = pow(max(dot(n, normalize(vec3(1.8, .7, -.5))), 0.), 14.);
    // Compress highlight energy before mixing, preserving soft tonal transitions.
    float highlight = 1. - exp(-(.34 * broadHighlight + .30 * satinHighlight + .10 * edgeLight));
    color = mix(color, white, highlight * (.8 + .2 * v_occlusion));
    gl_FragColor = vec4(pow(clamp(color, dark, white), vec3(1. / 2.2)), 1.);
  }
`;

type Vector = [number, number, number];
const normalize = (v: Vector): Vector => { const length = Math.hypot(...v) || 1; return v.map(n => n / length) as Vector; };
const subtract = (a: Vector, b: Vector): Vector => a.map((n, i) => n - b[i]) as Vector;
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function knotGeometry() {
  const lengthSegments = 320, tubeSegments = 32, tubeRadius = .185;
  const positions: number[] = [], normals: number[] = [], occlusions: number[] = [], indices: number[] = [];
  const center = (t: number): Vector => {
    const radius = .81 + .27 * Math.cos(3 * t);
    return [radius * Math.cos(2 * t), radius * Math.sin(2 * t), .34 * Math.sin(3 * t)];
  };
  const occluders = Array.from({ length: 96 }, (_, index) => ({ phase: index / 96, position: center(index / 96 * Math.PI * 2) }));
  for (let i = 0; i <= lengthSegments; i++) {
    const t = i / lengthSegments * Math.PI * 2, p = center(t);
    const tangent = normalize(subtract(center(t + .001), center(t - .001)));
    const radial: Vector = [Math.cos(2 * t), Math.sin(2 * t), 0];
    const binormal = normalize(cross(tangent, radial)), normal = normalize(cross(binormal, tangent));
    for (let j = 0; j <= tubeSegments; j++) {
      const angle = j / tubeSegments * Math.PI * 2;
      const n = normal.map((v, axis) => v * Math.cos(angle) + binormal[axis] * Math.sin(angle)) as Vector;
      const surface = p.map((v, axis) => v + n[axis] * tubeRadius) as Vector;
      // Approximate ambient occlusion from distant sections of the actual tube.
      // Local neighbours are excluded so the silhouette stays clean and bright.
      let obstruction = 0;
      for (const occluder of occluders) {
        const separation = Math.abs(i / lengthSegments - occluder.phase);
        if (Math.min(separation, 1 - separation) < .075) continue;
        const dx = occluder.position[0] - surface[0], dy = occluder.position[1] - surface[1], dz = occluder.position[2] - surface[2];
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        const facing = Math.max(0, (n[0] * dx + n[1] * dy + n[2] * dz) / Math.sqrt(Math.max(distanceSquared, 1e-8)));
        obstruction = Math.max(obstruction, facing * tubeRadius * tubeRadius / (distanceSquared + tubeRadius * tubeRadius));
      }
      normals.push(...n); positions.push(...surface); occlusions.push(1 - Math.min(.18, obstruction * .8));
      if (i < lengthSegments && j < tubeSegments) {
        const a = i * (tubeSegments + 1) + j, b = a + tubeSegments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), occlusions: new Float32Array(occlusions), indices: new Uint16Array(indices) };
}
function readColor(name: string): Float32Array {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hex = value.length === 4 ? `#${value.slice(1).split('').map(channel => channel + channel).join('')}` : value;
  return new Float32Array([1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255));
}

export default function LiquidField({ className = '' }: { className?: string }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
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
    for (const [name, data, size] of [['a_position', geometry.positions, 3], ['a_normal', geometry.normals, 3], ['a_occlusion', geometry.occlusions, 1]] as const) {
      const buffer = gl.createBuffer(); if (buffer) buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
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
      if (timestamp - lastDraw >= 1000 / 40 || motion.matches) {
        const step = lastTime ? Math.min((timestamp - lastTime) / 1000, .08) : 1 / 40;
        if (!motion.matches) elapsed += step;
        lastTime = timestamp; lastDraw = timestamp;
        const ease = 1 - Math.exp(-step / .28);
        pointer.x += (target.x - pointer.x) * ease; pointer.y += (target.y - pointer.y) * ease;
        const x = .28 + Math.sin(elapsed * .16) * .035 + pointer.y * .025;
        const y = -.30 + Math.sin(elapsed * .12) * .055 + pointer.x * .05;
        gl.uniform2f(rotation, x, y);
        gl.uniform1f(roll, -.24 + Math.sin(elapsed * .09) * .022);
        fieldRef.current?.style.setProperty('--sculpture-shadow-x', `${((y + .30) * 12).toFixed(2)}px`);
        fieldRef.current?.style.setProperty('--sculpture-shadow-scale', (1 - Math.abs(x) * .1).toFixed(3));
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
      }
      if (!motion.matches) frame = requestAnimationFrame(draw);
    };
    const resume = () => { if (frame) cancelAnimationFrame(frame); lastTime = lastDraw = 0; if (!disposed && !document.hidden && inView) frame = requestAnimationFrame(draw); };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio)); canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height); gl.uniform1f(aspect, canvas.width / canvas.height); resume();
    };
    const move = (event: PointerEvent) => {
      if (motion.matches || event.pointerType === 'touch') return;
      const b = canvas.getBoundingClientRect();
      if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) { target.x = target.y = 0; return; }
      target.x = Math.max(-1, Math.min(1, (event.clientX - b.left) / b.width * 2 - 1)); target.y = Math.max(-1, Math.min(1, (event.clientY - b.top) / b.height * 2 - 1));
    };
    const leave = () => { target.x = target.y = 0; };
    const motionChanged = () => { if (motion.matches) { target.x = target.y = pointer.x = pointer.y = 0; elapsed = 0; } resume(); };
    const lost = (event: Event) => { event.preventDefault(); if (frame) cancelAnimationFrame(frame); frame = 0; setFallback(true); };
    const restored = () => setFallback(true);
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; resume(); }); observer.observe(canvas);
    window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('blur', leave); document.addEventListener('visibilitychange', resume); motion.addEventListener('change', motionChanged);
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored); resize();
    return () => {
      disposed = true; if (frame) cancelAnimationFrame(frame); resizeObserver.disconnect(); observer.disconnect();
      window.removeEventListener('pointermove', move); window.removeEventListener('blur', leave); document.removeEventListener('visibilitychange', resume); motion.removeEventListener('change', motionChanged);
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      buffers.forEach(buffer => gl.deleteBuffer(buffer)); shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program);
    };
  }, []);
  return <div ref={fieldRef} className={`liquid-field ${className}`} aria-hidden="true"><div className="sculpture-ground" /><canvas ref={canvasRef} className={fallback ? 'sculpture-canvas is-unavailable' : 'sculpture-canvas'} />{fallback && <div className="sculpture-fallback"><span /><span /><span /></div>}</div>;
}
