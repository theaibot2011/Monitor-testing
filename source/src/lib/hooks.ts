import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A stopwatch driven by performance.now() timestamps (never by counting setInterval ticks).
 * It pauses itself when the tab is hidden or when frames stall for over a second
 * (browser throttling), and reports that so the UI can show a notice.
 */
export function useStopwatch(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const [interrupted, setInterrupted] = useState(false);
  const acc = useRef(0);
  const since = useRef<number | null>(null);
  const last = useRef(0);
  const active = running && !interrupted;

  useEffect(() => {
    if (!active) return;
    since.current = performance.now();
    last.current = since.current;
    let raf = 0;
    const tick = (now: number) => {
      if (since.current === null) return;
      if (now - last.current > 1000) {
        // Frames stalled (throttled or hidden): don't count the gap, pause and tell the operator.
        acc.current += Math.max(0, last.current - since.current);
        since.current = null;
        setElapsed(acc.current);
        setInterrupted(true);
        return;
      }
      last.current = now;
      // A frame timestamp can be slightly earlier than the start time, so never count backwards.
      setElapsed(acc.current + Math.max(0, now - since.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onVis = () => {
      if (document.visibilityState === 'hidden' && since.current !== null) {
        acc.current += performance.now() - since.current;
        since.current = null;
        setElapsed(acc.current);
        setInterrupted(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      if (since.current !== null) {
        acc.current += performance.now() - since.current;
        since.current = null;
      }
    };
  }, [active]);

  const resume = useCallback(() => setInterrupted(false), []);
  const reset = useCallback(() => {
    acc.current = 0;
    since.current = active ? performance.now() : null;
    last.current = performance.now();
    setElapsed(0);
  }, [active]);
  return { elapsed, interrupted, resume, reset };
}

/** Re-renders every `ms` so wall-clock displays (warm-up time, countdowns) stay current. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

export function useFullscreenActive() {
  const [fs, setFs] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  return fs;
}

export const fullscreenSupported = () =>
  typeof document !== 'undefined' && !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false;

export async function enterFullscreen(): Promise<boolean> {
  try {
    if (!fullscreenSupported()) return false;
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}

interface WakeLockLike {
  release(): Promise<void>;
}

/** Keeps the screen awake while active, re-acquiring after the tab becomes visible again. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockLike> } };
    if (!nav.wakeLock) return;
    let lock: WakeLockLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const l = await nav.wakeLock!.request('screen');
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      } catch {
        /* not allowed right now; ignore */
      }
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
