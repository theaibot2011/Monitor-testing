import { buildPlan, type PlanStep } from './catalogue';
import type { Session } from './session';

export type Outcome = 'serious' | 'unfinished' | 'minor' | 'passed';

export const OUTCOME_TEXT: Record<Outcome, { title: string; plain: string }> = {
  serious: { title: 'SERIOUS PROBLEM FOUND', plain: 'At least one check found a serious problem.' },
  unfinished: { title: 'NOT FINISHED', plain: 'Some checks were not answered, were skipped or were answered NOT SURE, so there is no overall verdict yet.' },
  minor: { title: 'PASSED WITH MINOR ISSUES', plain: 'No serious problems. Small issues are listed below so everyone knows about them.' },
  passed: { title: 'ALL CHECKS PASSED', plain: 'Every check was looked at properly and answered PASSED.' },
};

export const OUTCOME_RULES = [
  'SERIOUS PROBLEM FOUND: any check answered PROBLEM FOUND and marked serious.',
  'NOT FINISHED: any required check not answered, skipped or NOT SURE, or lines flagged during the colour cycle but that check answered PASSED.',
  'PASSED WITH MINOR ISSUES: every required check done, and only small problems found.',
  'ALL CHECKS PASSED: every required check looked at properly and answered PASSED.',
];

export interface OutcomeResult {
  outcome: Outcome;
  serious: string[];
  minor: string[];
  unfinished: string[];
  /** Repair mode: lines runs where a problem was reported. */
  faultRuns: number[];
}

const label = (s: PlanStep) => (s.run && s.run > 1 ? `Run ${s.run}: ${s.def.title}` : s.def.title);

/** Precedence: SERIOUS > NOT FINISHED > MINOR > PASSED. Nothing is ever passed automatically. */
export function computeOutcome(session: Session): OutcomeResult {
  const plan = buildPlan(session.purpose, session.runs);
  const serious: string[] = [];
  const minor: string[] = [];
  const unfinished: string[] = [];
  const faultRuns = new Set<number>();

  for (const step of plan) {
    const a = session.answers[step.key];
    if (a?.status === 'problem') {
      if (step.run) faultRuns.add(step.run);
      const where = a.note ? ` (${a.note})` : '';
      if (a.severity === 'minor') minor.push(`${label(step)}: small problem${where}`);
      else serious.push(`${label(step)}: serious problem${where}`);
      continue;
    }
    if (!step.def.mandatory) continue;
    if (!a) unfinished.push(`${label(step)}: not answered`);
    else if (a.status === 'skipped') unfinished.push(`${label(step)}: skipped`);
    else if (a.status === 'notsure') unfinished.push(`${label(step)}: answered NOT SURE`);
    else if (step.def.id === 'B') {
      const flagged = session.flags.filter((f) => f.run === (step.run ?? 1)).length;
      if (flagged > 0) unfinished.push(`${label(step)}: ${flagged} line(s) were flagged but the check was answered PASSED`);
    }
  }
  if (!session.displayCheck) unfinished.push('Display check was not completed');

  const outcome: Outcome = serious.length ? 'serious' : unfinished.length ? 'unfinished' : minor.length ? 'minor' : 'passed';
  return { outcome, serious, minor, unfinished, faultRuns: [...faultRuns].sort((a, b) => a - b) };
}

/** Required checks that were skipped or never answered: listed on the report as "Not checked". */
export function notChecked(session: Session): string[] {
  return buildPlan(session.purpose, session.runs)
    .filter((p) => !session.answers[p.key] || session.answers[p.key].status === 'skipped')
    .map((p) => `${label(p)}${p.def.mandatory ? '' : ' (optional)'}`);
}
