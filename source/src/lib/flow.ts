import { buildPlan, CYCLE_COLOURS } from './catalogue';
import { warmupMinutes, type Session } from './session';

/** Index of the next unanswered step after `from`, else the first unanswered anywhere, else -1 (go to report). */
export function nextStepIndex(session: Session, from: number, answers = session.answers): number {
  const plan = buildPlan(session.purpose, session.runs);
  for (let i = from + 1; i < plan.length; i++) if (!answers[plan[i].key]) return i;
  for (let i = 0; i < plan.length; i++) if (!answers[plan[i].key]) return i;
  return -1;
}

/** Repair checks only: true once the monitor has warmed up 30 minutes and the latest run was done before that. */
export function shouldOfferRepeat(session: Session, now: number): boolean {
  if (session.purpose !== 'repair') return false;
  if (warmupMinutes(session, now) < 30) return false;
  const run = session.runs;
  const plan = buildPlan(session.purpose, run).filter((p) => p.run === run);
  if (!plan.every((p) => session.answers[p.key])) return false;
  const started = session.runStartedAt[String(run)];
  return typeof started === 'number' && warmupMinutes(session, started) < 30;
}

/** Adds another repair run and returns the patch that jumps to its first step. */
export function addRunPatch(session: Session): Partial<Session> {
  const runs = session.runs + 1;
  const plan = buildPlan(session.purpose, runs);
  const idx = plan.findIndex((p) => p.run === runs);
  return { runs, stepIndex: idx, subStep: 0, phase: 'briefing', screen: 'test', nosignalStage: 0, redo: false };
}

/** Which colour of the cycle is showing. Safe for negative, NaN or huge elapsed times. */
export function cycleIndex(elapsedMs: number, secondsPerColour: number): number {
  const i = Math.floor(elapsedMs / (secondsPerColour * 1000));
  return Number.isFinite(i) && i > 0 ? i : 0;
}

/** The colour for a cycle index; always a real colour, never undefined. */
export function cycleColour(idx: number) {
  const total = CYCLE_COLOURS.length * 2;
  const i = Math.min(Math.max(0, Math.floor(idx) || 0), total - 1) % CYCLE_COLOURS.length;
  return CYCLE_COLOURS[i];
}

/** Advertised vs measured refresh rate. Returns a plain warning, or null when they agree. */
export function refreshWarning(advertised: string, measured: number | null): string | null {
  const adv = parseInt(advertised, 10);
  if (!measured || !Number.isFinite(adv) || adv <= 0) return null;
  if (measured >= adv * 0.9) return null;
  return `The monitor is advertised as ${adv} Hz but is running at about ${measured} Hz right now. This is usually a setting or the cable, not a fault: in Windows open Settings → Display → Advanced display and choose ${adv} Hz, and use the cable that came with the monitor (often DisplayPort). Check again afterwards.`;
}
