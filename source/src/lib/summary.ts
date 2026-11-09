import { APP_VERSION, buildPlan, GROUP_LABEL, PURPOSE_TEXT, STATUS_LABEL } from './catalogue';
import { computeOutcome, notChecked, OUTCOME_TEXT } from './outcome';
import { HINT_DISCLAIMER, isolationHints, noSignalLinesFrom } from './isolation';
import { refreshWarning } from './flow';
import { fmtDateTime, fmtTime } from './format';
import { warmupMinutes, type Answer, type Session } from './session';

export { fmtDateTime };

export const SELF_REPORTED =
  'Results were entered by the person testing. This is a guided eye check, not a certified inspection, and it cannot measure colour accuracy.';

/** Warm-up minutes at the start of a repair run, or null if it has not started. */
export function runWarmup(session: Session, run: number): number | null {
  const started = session.runStartedAt[String(run)];
  return typeof started === 'number' ? warmupMinutes(session, started) : null;
}

/** "9 Nov 2026, 11:41 – 11:56": first start to last answer. */
export function testedRange(session: Session): string {
  const times = Object.values(session.answers).map((a) => a.at).filter((t) => t > 0);
  const start = session.startedAt ?? (times.length ? Math.min(...times) : null);
  if (start === null) return 'Not started';
  const end = times.length ? Math.max(...times) : null;
  if (!end || end <= start) return fmtDateTime(start);
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
  if (sameDay && fmtTime(start) === fmtTime(end)) return fmtDateTime(start);
  return `${fmtDateTime(start)} – ${sameDay ? fmtTime(end) : fmtDateTime(end)}`;
}

export const answerText = (a: Answer | undefined) =>
  !a ? 'not answered' : a.status === 'problem' ? `PROBLEM FOUND (${a.severity === 'minor' ? 'small' : 'serious'})` : STATUS_LABEL[a.status];

/** Plain-text summary for WhatsApp / copying. */
export function buildSummary(session: Session, siteUrl = 'monitortesting.netlify.app'): string {
  const res = computeOutcome(session);
  const plan = buildPlan(session.purpose, session.runs);
  const d = session.details;
  const repair = session.purpose === 'repair';
  const L: string[] = [];
  L.push('MonitorTest report');
  L.push(`Purpose: ${PURPOSE_TEXT[session.purpose].title}`);
  L.push(`Monitor: ${d.model || 'not given'}${d.serial ? ` (serial ${d.serial})` : ''}`);
  if (d.jobRef) L.push(`${repair ? 'Job' : 'Reference'}: ${d.jobRef}`);
  L.push(`Tested by: ${d.operator || 'not given'}`);
  L.push(`Tested: ${testedRange(session)}`);
  L.push('');
  L.push(`OVERALL: ${OUTCOME_TEXT[res.outcome].title}`);
  for (const r of [...res.serious, ...res.unfinished, ...res.minor]) L.push(`- ${r}`);
  if (repair && res.faultRuns.length && !res.faultRuns.includes(1)) {
    L.push(`- Note: the original fault did not show in run 1 but did show in run ${res.faultRuns.join(', ')} (after warm-up).`);
  }

  const runs = repair ? session.runs : 1;
  for (let run = 1; run <= runs; run++) {
    const w = repair ? runWarmup(session, run) : null;
    L.push('');
    L.push(`${GROUP_LABEL('lines', session.purpose)}${repair ? `, run ${run}` : ''}${w !== null ? ` (monitor on for ${w} min)` : ''}:`);
    for (const s of plan.filter((p) => p.run === run)) {
      const a = session.answers[s.key];
      L.push(`- ${s.def.title}: ${answerText(a)}${a?.note ? ` (${a.note})` : ''}`);
    }
    const flags = session.flags.filter((f) => f.run === run);
    if (flags.length) {
      const stayed = flags.filter((f) => f.samePlace === 'yes').length;
      L.push(`- Lines flagged in colour cycle: ${flags.length} (${stayed} stayed in the same place when the colour changed)`);
    }
  }
  for (const g of ['main', 'physical'] as const) {
    L.push('');
    L.push(`${GROUP_LABEL(g, session.purpose)}:`);
    for (const s of plan.filter((p) => p.def.group === g)) {
      const a = session.answers[s.key];
      L.push(`- ${s.def.title}: ${answerText(a)}${a?.note ? ` (${a.note})` : ''}${s.def.id === 'motion' && session.motion ? ` [${session.motion.fps} pictures per second, ${session.motion.latePct}% late]` : ''}`);
    }
  }
  const missing = notChecked(session);
  if (missing.length) {
    L.push('');
    L.push('Not checked:');
    for (const m of missing) L.push(`- ${m}`);
  }
  if (repair) {
    if (session.combos.length) {
      L.push('');
      L.push('Combinations tried:');
      for (const c of session.combos) {
        L.push(`- ${c.cable === 'DP' ? 'DisplayPort' : c.cable}, socket ${c.port || '?'}, ${c.refresh || '?'} Hz: lines ${c.lines === 'yes' ? 'SEEN' : c.lines === 'no' ? 'not seen' : 'not sure'}`);
      }
    }
    const hints = isolationHints(session.combos, noSignalLinesFrom(session));
    if (hints.length) {
      L.push('');
      L.push(`Hints (${HINT_DISCLAIMER})`);
      for (const h of hints) L.push(`- ${h}`);
    }
  }
  if (session.displayCheck) {
    const dc = session.displayCheck;
    L.push('');
    L.push(`Display: ${dc.viewport}, scaling ${Math.round(dc.dpr * 100)}%${dc.refreshEstimate ? `, running at about ${dc.refreshEstimate} Hz` : ''}${d.advertisedHz ? ` (advertised ${d.advertisedHz} Hz)` : ''}`);
    const rw = refreshWarning(d.advertisedHz, dc.refreshEstimate);
    if (rw) L.push(`- ${rw}`);
    for (const w of dc.warnings) L.push(`- Note: ${w}`);
  }
  const photos = plan.map((p) => session.answers[p.key]?.photo).filter(Boolean);
  if (session.evidence || photos.length) {
    L.push('');
    L.push('Evidence notes:');
    if (session.evidence) L.push(session.evidence);
    for (const p of photos) L.push(`- Photo: ${p}`);
  }
  L.push('');
  L.push(SELF_REPORTED);
  L.push(`Made with MonitorTest ${APP_VERSION}: ${siteUrl}`);
  return L.join('\n');
}
