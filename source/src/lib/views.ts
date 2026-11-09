import { CYCLE_COLOURS, CYCLE_MIN_VIEW_MS, NOSIGNAL_MIN_VIEW_MS, SCAN_MIN_VIEW_MS, type TestDef } from './catalogue';

export const DEFAULT_VIEW_MS = 2000;

export interface ViewProgress {
  /** True when PASSED may be chosen. */
  ok: boolean;
  /** Plain-language reason when not ok. */
  reason: string;
  /** Total seconds actually looked at, or null for checks with no pictures. */
  seconds: number | null;
}

/**
 * PASSED is only allowed once the person has actually looked: every picture on screen for
 * a minimum time (or the timed checks run long enough). Guards against a false
 * "ALL CHECKS PASSED" from clicking straight through.
 */
export function viewProgress(def: TestDef, views: number[] | undefined): ViewProgress {
  const v = views ?? [];
  const total = v.reduce((a, b) => a + b, 0);
  const seconds = def.kind === 'question' ? null : Math.round(total / 1000);
  if (def.kind === 'question') return { ok: true, reason: '', seconds };
  if (def.kind === 'patterns') {
    const min = def.minViewMs ?? DEFAULT_VIEW_MS;
    const pats = def.patterns ?? [];
    const missing = pats.findIndex((_, i) => (v[i] ?? 0) < min);
    if (missing < 0) return { ok: true, reason: '', seconds };
    return {
      ok: false,
      reason: `Look at every picture for at least ${Math.round(min / 1000)} seconds before choosing PASSED. Picture ${missing + 1} (${pats[missing].label}) has not been looked at long enough yet.`,
      seconds,
    };
  }
  if (def.kind === 'cycle') {
    // [0] = ms watched, [1] = how many colours were shown.
    const watchedMs = v[0] ?? 0;
    const colours = v[1] ?? 0;
    const sec = Math.round(watchedMs / 1000);
    if (colours >= CYCLE_COLOURS.length && watchedMs >= CYCLE_MIN_VIEW_MS) return { ok: true, reason: '', seconds: sec };
    return { ok: false, reason: 'Watch the colour cycle through every colour before choosing PASSED.', seconds: sec };
  }
  const need = def.kind === 'scan' ? SCAN_MIN_VIEW_MS : NOSIGNAL_MIN_VIEW_MS;
  if (total >= need) return { ok: true, reason: '', seconds };
  const what = def.kind === 'scan' ? 'Watch the slow scan for at least 10 seconds' : 'Wait the full 30 seconds with the cable unplugged';
  return { ok: false, reason: `${what} before choosing PASSED.`, seconds };
}

/** Adds `ms` to picture `index` of a step's view log, returning a new array. */
export function addView(prev: number[] | undefined, index: number, ms: number): number[] {
  const next = [...(prev ?? [])];
  while (next.length <= index) next.push(0);
  next[index] += Math.max(0, ms);
  return next;
}

/** Keeps the larger value at `index` (used for "how many colours were shown"). */
export function maxView(prev: number[] | undefined, index: number, value: number): number[] {
  const next = [...(prev ?? [])];
  while (next.length <= index) next.push(0);
  next[index] = Math.max(next[index], value);
  return next;
}
