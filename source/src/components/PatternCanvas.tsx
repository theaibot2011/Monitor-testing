import { useEffect, useRef } from 'react';
import { sizeCanvasToViewport } from '../lib/draw';

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, t: number) => void;

/**
 * Full-viewport canvas whose backing store is exactly round(viewport x devicePixelRatio),
 * so one canvas pixel is one screen pixel. Redraws on resize and DPR change.
 */
export function PatternCanvas({ draw, animate = false, version, onFrame }: { draw: DrawFn; animate?: boolean; version: string | number; onFrame?: (t: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d', { alpha: false });
    if (!ctx) return;
    const render = (t: number) => {
      const { w, h, dpr } = sizeCanvasToViewport(c);
      drawRef.current(ctx, w, h, dpr, t);
    };
    render(performance.now());
    let raf = 0;
    if (animate) {
      const loop = (t: number) => {
        render(t);
        frameRef.current?.(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    const onResize = () => render(performance.now());
    window.addEventListener('resize', onResize);
    const mq = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq?.addEventListener?.('change', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      mq?.removeEventListener?.('change', onResize);
    };
  }, [animate, version]);

  return <canvas ref={ref} data-testid="pattern-canvas" />;
}
