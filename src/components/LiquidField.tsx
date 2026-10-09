import { useEffect, useRef, useState } from 'react';

const vertexSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;
  varying vec2 v_uv;
  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform vec3 u_primary;
  uniform vec3 u_background;
  uniform vec3 u_foreground;

  mat2 rotate(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  // A continuous, inflated ribbon. Its cross-section turns as the ribbon
  // folds back on itself, giving the sculpture distinct surfaces and edges.
  float sculpture(vec3 position) {
    vec3 p = position;
    p.xz = rotate(-0.24 + u_pointer.x * 0.12) * p.xz;
    p.yz = rotate(0.36 + u_pointer.y * 0.10) * p.yz;
    p.xy = rotate(-0.47) * p.xy;
    p.y *= 0.92;
    float angle = atan(p.y, p.x);
    float motion = u_time * 0.12;
    float radius = 0.98 + 0.12 * sin(angle * 3.0 + motion)
                        + 0.045 * cos(angle * 5.0 - motion * 0.7);
    vec2 section = vec2(length(p.xy) - radius,
                        p.z - 0.17 * sin(angle * 2.0 - motion));
    section = rotate(angle * 1.5 + 0.36 * sin(angle + motion) + 0.20) * section;
    vec2 dimensions = vec2(0.335 + 0.05 * cos(angle * 2.0), 0.13);
    // Ellipse distance estimate preserves a smooth, rounded ribbon edge.
    float k0 = length(section / dimensions);
    float k1 = length(section / (dimensions * dimensions));
    return k0 * (k0 - 1.0) / max(k1, 0.0001) * 0.84;
  }

  vec3 surfaceNormal(vec3 p) {
    const float epsilon = 0.0015;
    vec2 e = vec2(epsilon, 0.0);
    return normalize(vec3(
      sculpture(p + e.xyy) - sculpture(p - e.xyy),
      sculpture(p + e.yxy) - sculpture(p - e.yxy),
      sculpture(p + e.yyx) - sculpture(p - e.yyx)
    ));
  }

  vec3 studio(vec3 direction) {
    float sky = smoothstep(-0.65, 0.9, direction.y);
    vec3 environment = mix(mix(u_foreground, u_primary, 0.52), u_background, sky * 0.94);
    float softbox = pow(max(0.0, dot(direction, normalize(vec3(-1.2, 1.4, 1.8)))), 14.0);
    float strip = pow(max(0.0, dot(direction, normalize(vec3(1.6, 0.3, 0.8)))), 42.0);
    float rim = pow(max(0.0, dot(direction, normalize(vec3(-0.2, -0.5, -1.0)))), 28.0);
    environment = mix(environment, u_background, clamp(softbox * 1.15 + strip * 0.9 + rim * 0.66, 0.0, 1.0));
    return environment;
  }

  void main() {
    vec2 uv = (v_uv * 2.0 - 1.0);
    uv.x *= u_resolution.x / max(u_resolution.y, 1.0);
    uv.y += 0.045;
    vec3 origin = vec3(0.0, 0.0, 4.65);
    vec3 ray = normalize(vec3(uv * 1.38, -3.15));
    float distanceTravelled = 0.0;
    float distanceToSurface = 1.0;
    vec3 point = origin;
    bool hit = false;
    for (int i = 0; i < 86; i++) {
      point = origin + ray * distanceTravelled;
      distanceToSurface = sculpture(point);
      if (distanceToSurface < 0.0015) {
        hit = true;
        break;
      }
      distanceTravelled += max(distanceToSurface, 0.001);
      if (distanceTravelled > 7.0) break;
    }

    vec3 color = u_background;
    // A quiet studio floor shadow gives the liquid volume a physical setting.
    float shadow = exp(-pow(uv.x * 1.13, 2.0) - pow((uv.y + 0.96) * 13.0, 2.0));
    color = mix(color, u_foreground, shadow * 0.06);

    if (hit) {
      vec3 normal = surfaceNormal(point);
      vec3 view = -ray;
      vec3 light = normalize(vec3(-2.0, 3.0, 4.0));
      float diffuse = max(dot(normal, light), 0.0);
      float fresnel = pow(1.0 - max(dot(normal, view), 0.0), 3.5);
      vec3 reflection = studio(reflect(ray, normal));
      vec3 base = mix(u_primary, u_background, 0.11 + diffuse * 0.25);
      base = mix(mix(u_foreground, u_primary, 0.72), base, 0.36 + diffuse * 0.64);
      float specular = pow(max(dot(normal, normalize(light + view)), 0.0), 85.0);
      float foldedShade = clamp(sculpture(point + normal * 0.16) / 0.16, 0.0, 1.0);
      color = mix(base, reflection, 0.57 + fresnel * 0.25);
      color = mix(color, u_foreground, (1.0 - foldedShade) * 0.14);
      color = mix(color, u_background, clamp(specular * 0.7 + fresnel * 0.10, 0.0, 1.0));
      // Subtle moving caustics remain part of the material, never particles.
      float caustic = sin(point.x * 8.0 + point.y * 7.0 + u_time * 0.18)
                    * sin(point.z * 11.0 - point.y * 4.0 - u_time * 0.12);
      color = mix(color, u_background, pow(max(caustic, 0.0), 6.0) * diffuse * 0.055);
    }
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Resolve the project's semantic CSS tokens, including browser-supported
 * color formats, into linear RGB values usable by the WebGL material. */
function readColor(names: string[], fallback: string): [number, number, number] {
  const styles = getComputedStyle(document.documentElement);
  const value = names.map((name) => styles.getPropertyValue(name).trim()).find(Boolean) || fallback;
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const context = probe.getContext('2d');
  if (!context) return [1, 1, 1];
  context.fillStyle = fallback;
  context.fillStyle = CSS.supports('color', value) ? value : `hsl(${value})`;
  context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  return [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255];
}

export default function LiquidField({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) {
      setFallback(true);
      return;
    }

    const shaders: WebGLShader[] = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      shaders.push(shader);
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      shaders.forEach((shader) => gl.deleteShader(shader));
      if (program) gl.deleteProgram(program);
      setFallback(true);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach((shader) => gl.deleteShader(shader));
      gl.deleteProgram(program);
      setFallback(true);
      return;
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const pointerUniform = gl.getUniformLocation(program, 'u_pointer');
    const timeUniform = gl.getUniformLocation(program, 'u_time');
    gl.uniform3fv(gl.getUniformLocation(program, 'u_primary'), readColor(['--primary', '--color-primary'], '#2597D0'));
    gl.uniform3fv(gl.getUniformLocation(program, 'u_background'), readColor(['--background', '--color-background'], '#FFFFFF'));
    gl.uniform3fv(gl.getUniformLocation(program, 'u_foreground'), readColor(['--foreground', '--color-foreground'], '#111827'));

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const target = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    let frame = 0;
    let disposed = false;
    let inView = true;
    let elapsed = 0;
    let lastTime = 0;

    const draw = (timestamp = 0) => {
      frame = 0;
      if (disposed || document.hidden || !inView || gl.isContextLost()) return;
      if (!reducedMotion.matches) {
        if (lastTime) elapsed += Math.min((timestamp - lastTime) / 1000, 0.05);
        pointer.x += (target.x - pointer.x) * 0.035;
        pointer.y += (target.y - pointer.y) * 0.035;
      }
      lastTime = timestamp;
      gl.uniform1f(timeUniform, elapsed);
      gl.uniform2f(pointerUniform, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (!document.hidden && inView && !disposed) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.uniform2f(resolution, width, height);
      }
      resume();
    };
    const move = (event: PointerEvent) => {
      if (reducedMotion.matches || event.pointerType === 'touch') return;
      const bounds = canvas.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      target.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
    };
    const resetPointer = () => { target.x = 0; target.y = 0; };
    const contextLost = (event: Event) => {
      event.preventDefault();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      setFallback(true);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      resume();
    }, { threshold: 0.01 });
    intersectionObserver.observe(canvas);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerout', resetPointer);
    document.addEventListener('visibilitychange', resume);
    reducedMotion.addEventListener('change', resume);
    canvas.addEventListener('webglcontextlost', contextLost);
    resize();

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', resetPointer);
      document.removeEventListener('visibilitychange', resume);
      reducedMotion.removeEventListener('change', resume);
      canvas.removeEventListener('webglcontextlost', contextLost);
      if (buffer) gl.deleteBuffer(buffer);
      shaders.forEach((shader) => gl.deleteShader(shader));
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className={`liquid-field ${className}`} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: fallback ? 'none' : 'block' }} />
      {fallback && (
        <div style={{ position: 'absolute', inset: '15% 21%', borderRadius: '48%', transform: 'rotate(-30deg)', border: '45px solid var(--primary)', background: 'var(--background)', boxShadow: 'inset 15px 12px 22px var(--border), 16px 20px 28px var(--border)' }} />
      )}
    </div>
  );
}
