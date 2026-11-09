import type { MotionStats } from './session';

/**
 * Frame timing from requestAnimationFrame timestamps. A frame is "late" when it arrives more
 * than 1.5x the typical (median) gap after the previous one: the picture skipped a beat.
 */
export function motionStatsFrom(times: number[]): MotionStats | null {
  if (times.length < 30) return null;
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const g = times[i] - times[i - 1];
    if (g > 0 && g < 1000) gaps.push(g);
  }
  if (gaps.length < 20) return null;
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const late = gaps.filter((g) => g > median * 1.5).length;
  return { fps: Math.round(1000 / median), latePct: Math.round((1000 * late) / gaps.length) / 10 };
}

/** Plain-language reading of the stats. */
export function motionAdvice(m: MotionStats): string {
  const base = `The browser drew about ${m.fps} pictures per second, and ${m.latePct}% of them arrived late.`;
  if (m.latePct <= 2) return `${base} That is smooth. If the block still looked jumpy, that is worth noting.`;
  if (m.latePct <= 8) return `${base} A little uneven. Close other programs and run this check again before blaming the monitor.`;
  return `${base} That is a lot of stutter, usually caused by the computer being busy, not the monitor. Close other programs, plug in the charger and run this check again.`;
}
