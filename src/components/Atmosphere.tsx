import { useEffect, useRef } from 'react';

/** Decorative field: no tracking, network requests or pointer capture. */
export default function Atmosphere({ paused = false }: { paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const resumeRef = useRef<(() => void) | null>(null);
  useEffect(() => { pausedRef.current = paused; resumeRef.current?.(); }, [paused]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const context = canvas.getContext('2d'); if (!context) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    let width = 0, height = 0, frame = 0, disposed = false, elapsed = 0, previous = 0, lastDraw = 0;
    const pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
    const draw = (time: number) => {
      frame = 0; if (disposed || document.hidden) return;
      if (time - lastDraw > 1000 / 24 || motion.matches || pausedRef.current) {
        if (!motion.matches && !pausedRef.current && previous) elapsed += Math.min((time - previous) / 1000, .1);
        lastDraw = previous = time; pointer.x += (target.x - pointer.x) * .035; pointer.y += (target.y - pointer.y) * .035;
        context.clearRect(0, 0, width, height); context.strokeStyle = context.fillStyle = color;
        const shift = Math.min(window.scrollY, 4000) * .025;
        for (let line = 0; line < 19; line++) {
          context.beginPath(); context.lineWidth = .65; context.globalAlpha = .055 + line / 19 * .025;
          for (let step = 0; step <= 100; step++) {
            const x = step / 100 * (width + 120) - 60;
            const wave = Math.sin(x / width * Math.PI * 1.7 + elapsed * .13 + line * .10);
            const y = height * .26 + line * 27 + wave * height * .21 + Math.cos(x / width * Math.PI * 2.5 - elapsed * .09) * 32 + pointer.y * 16 + shift;
            if (step === 0) context.moveTo(x + pointer.x * 14, y); else context.lineTo(x + pointer.x * 14, y);
          }
          context.stroke();
        }
        for (let i = 0; i < 14; i++) {
          const x = ((i * .173 + elapsed * .006) % 1) * width;
          const y = height * .2 + (i % 7) * height * .105 + Math.sin(elapsed * .3 + i) * 14;
          context.globalAlpha = .12; context.beginPath(); context.arc(x, y, i % 3 === 0 ? 1.7 : 1, 0, Math.PI * 2); context.fill();
        }
        context.globalAlpha = 1;
      }
      if (!motion.matches && !pausedRef.current) frame = requestAnimationFrame(draw);
    };
    const resume = () => { if (frame) cancelAnimationFrame(frame); lastDraw = previous = 0; if (!disposed && !document.hidden) frame = requestAnimationFrame(draw); };
    resumeRef.current = resume;
    const resize = () => {
      width = window.innerWidth; height = window.innerHeight; const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); context.setTransform(ratio, 0, 0, ratio, 0, 0); resume();
    };
    const move = (event: PointerEvent) => { if (!motion.matches && !pausedRef.current && event.pointerType !== 'touch') { target.x = event.clientX / width - .5; target.y = event.clientY / height - .5; } };
    window.addEventListener('resize', resize, { passive: true }); window.addEventListener('pointermove', move, { passive: true }); document.addEventListener('visibilitychange', resume); motion.addEventListener('change', resume); resize();
    return () => { disposed = true; resumeRef.current = null; if (frame) cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', resume); motion.removeEventListener('change', resume); };
  }, []);
  return <div className="atmosphere" aria-hidden="true"><div className="atmosphere-light atmosphere-light-one" /><div className="atmosphere-light atmosphere-light-two" /><canvas ref={canvasRef} /></div>;
}
