import { useEffect, useRef } from 'react';

/** A quiet, decorative light field around the hero sculpture. */
export default function Atmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = canvas?.parentElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !wrapper || !context) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    let width = 0;
    let height = 0;
    let frame = 0;
    let elapsed = 0;
    let previous = 0;
    let lastDraw = 0;
    let visible = true;
    let disposed = false;

    const paint = () => {
      context.clearRect(0, 0, width, height);
      context.strokeStyle = color;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      // Wide contours stay beside the sculpture, leaving the copy in clear space.
      const centerX = width * .92;
      const centerY = height * .42;
      const breath = Math.sin(elapsed * .12);
      for (let contour = 0; contour < 4; contour++) {
        const radiusX = width * (.31 + contour * .037);
        const radiusY = height * (.23 + contour * .039);
        context.beginPath();
        context.lineWidth = contour === 1 ? .9 : .65;
        context.globalAlpha = .038 + Math.sin(elapsed * .09 + contour * .7) * .01;
        for (let step = 0; step <= 90; step++) {
          const angle = -.94 * Math.PI + step / 90 * Math.PI * 1.86;
          const fold = Math.sin(angle * 2 + elapsed * .07 + contour * .16);
          const x = centerX + Math.cos(angle) * radiusX + fold * width * .022;
          const y = centerY + Math.sin(angle) * radiusY + Math.cos(angle * 3 + contour * .2) * height * .035 + breath * height * .013;
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
      }
      context.globalAlpha = 1;
    };

    const draw = (time: number) => {
      frame = 0;
      if (disposed || document.hidden || !visible || width === 0 || height === 0) return;
      if (!lastDraw || time - lastDraw >= 1000 / 20 || motion.matches) {
        if (!motion.matches && previous) elapsed += Math.min((time - previous) / 1000, .1);
        previous = lastDraw = time;
        paint();
      }
      if (!motion.matches) frame = requestAnimationFrame(draw);
    };

    const resume = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previous = lastDraw = 0;
      if (!disposed && !document.hidden && visible) frame = requestAnimationFrame(draw);
    };

    const resize = () => {
      const bounds = wrapper.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      resume();
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    resizeObserver.observe(wrapper);
    intersectionObserver.observe(wrapper);
    document.addEventListener('visibilitychange', resume);
    motion.addEventListener('change', resume);
    window.addEventListener('resize', resize, { passive: true });
    resize();

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', resume);
      motion.removeEventListener('change', resume);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="atmosphere-light atmosphere-light-one" />
      <div className="atmosphere-light atmosphere-light-two" />
      <canvas ref={canvasRef} />
    </div>
  );
}
