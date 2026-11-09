import { buildPlan, type Purpose } from '../src/lib/catalogue';
import { newSession, type Session, type Status } from '../src/lib/session';

export const T0 = new Date(2026, 0, 10, 10, 0).getTime();

/** A session with every step answered `status`, a completed display check and run start times. */
export function answeredSession(purpose: Purpose, status: Status = 'passed', runs = 1): Session {
  const s = newSession(purpose, T0);
  s.runs = runs;
  s.startedAt = T0;
  s.details = { operator: 'Sam', model: 'AOC 24G2', serial: 'SN1', jobRef: 'J42', monitorOnAt: T0, advertisedHz: '' };
  s.displayCheck = { at: T0, viewport: '1920×1080', dpr: 1, canvas: '1920×1080', screen: '1920×1080', refreshEstimate: 165, warnings: [] };
  for (let r = 1; r <= runs; r++) s.runStartedAt[String(r)] = T0 + (r - 1) * 35 * 60000;
  for (const p of buildPlan(purpose, runs)) {
    s.answers[p.key] = { status, severity: status === 'problem' ? 'serious' : null, note: '', photo: '', at: T0 + 60000 };
  }
  return s;
}
