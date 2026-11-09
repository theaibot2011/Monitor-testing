import { describe, expect, it } from 'vitest';
import { computeOutcome, notChecked } from '../src/lib/outcome';
import { buildPlan } from '../src/lib/catalogue';
import { newSession } from '../src/lib/session';
import { answeredSession } from './helpers';

describe('overall outcome: SERIOUS > NOT FINISHED > MINOR > PASSED', () => {
  it('ALL CHECKS PASSED when every step is PASSED', () => {
    for (const p of ['buying', 'selling', 'repair', 'own'] as const) {
      const r = computeOutcome(answeredSession(p));
      expect(r.outcome).toBe('passed');
      expect([...r.serious, ...r.minor, ...r.unfinished]).toEqual([]);
    }
  });

  it('a serious problem beats everything, even NOT SURE elsewhere', () => {
    const s = answeredSession('buying');
    s.answers['dead'] = { ...s.answers['dead'], status: 'problem', severity: 'serious' };
    s.answers['gradients'].status = 'notsure';
    const r = computeOutcome(s);
    expect(r.outcome).toBe('serious');
    expect(r.serious[0]).toMatch(/Dead and stuck pixels: serious problem/);
    expect(r.unfinished.join()).toMatch(/NOT SURE/);
  });

  it('only small problems gives PASSED WITH MINOR ISSUES', () => {
    const s = answeredSession('selling');
    s.answers['dead'] = { ...s.answers['dead'], status: 'problem', severity: 'minor', note: 'one stuck dot top-left' };
    const r = computeOutcome(s);
    expect(r.outcome).toBe('minor');
    expect(r.minor[0]).toMatch(/one stuck dot top-left/);
  });

  it('a small problem on an optional check is still reported (minor)', () => {
    const s = answeredSession('own');
    s.answers['ofv1.E2'] = { ...s.answers['ofv1.E2'], status: 'problem', severity: 'minor' };
    expect(computeOutcome(s).outcome).toBe('minor');
  });

  it('a serious problem on an optional check is SERIOUS', () => {
    const s = answeredSession('own');
    s.answers['ofv1.E2'] = { ...s.answers['ofv1.E2'], status: 'problem', severity: 'serious' };
    expect(computeOutcome(s).outcome).toBe('serious');
  });

  it('minor problems plus an unfinished check is NOT FINISHED', () => {
    const s = answeredSession('buying');
    s.answers['dead'] = { ...s.answers['dead'], status: 'problem', severity: 'minor' };
    delete s.answers['phys.case'];
    expect(computeOutcome(s).outcome).toBe('unfinished');
  });

  it('NOT FINISHED when a required check is skipped, NOT SURE or unanswered', () => {
    for (const mutate of [
      (s: ReturnType<typeof answeredSession>) => (s.answers['levels'].status = 'skipped'),
      (s: ReturnType<typeof answeredSession>) => (s.answers['ofv1.A'].status = 'notsure'),
      (s: ReturnType<typeof answeredSession>) => delete s.answers['phys.ports'],
    ]) {
      const s = answeredSession('buying');
      mutate(s);
      expect(computeOutcome(s).outcome).toBe('unfinished');
    }
  });

  it('a fresh session is never PASSED', () => {
    expect(computeOutcome(newSession('buying')).outcome).toBe('unfinished');
  });

  it('skipping an optional check does not block PASSED but is listed as not checked', () => {
    const s = answeredSession('buying');
    s.answers['ofv1.E2'].status = 'skipped';
    expect(computeOutcome(s).outcome).toBe('passed');
    expect(notChecked(s)).toEqual(['Slow scan (optional)']);
  });

  it('repair: a fault in run 2 only is SERIOUS and reported as run 2', () => {
    const s = answeredSession('repair', 'passed', 2);
    s.answers['ofv2.B'] = { ...s.answers['ofv2.B'], status: 'problem', severity: 'serious' };
    const r = computeOutcome(s);
    expect(r.outcome).toBe('serious');
    expect(r.faultRuns).toEqual([2]);
    expect(r.serious[0]).toMatch(/^Run 2:/);
  });

  it('lines flagged in the colour cycle but answered PASSED need another look', () => {
    const s = answeredSession('buying');
    s.flags.push({ run: 1, colour: 'White', samePlace: 'yes', at: 0 });
    expect(computeOutcome(s).outcome).toBe('unfinished');
  });

  it('a missing display check makes the result NOT FINISHED', () => {
    const s = answeredSession('buying');
    s.displayCheck = null;
    expect(computeOutcome(s).outcome).toBe('unfinished');
  });
});

describe('plans', () => {
  it('every purpose includes dead pixels, backlight, burn-in, viewing angles and physical checks', () => {
    for (const p of ['buying', 'selling', 'repair', 'own'] as const) {
      const keys = buildPlan(p, 1).map((x) => x.key);
      for (const k of ['dead', 'uniformity', 'gradients', 'levels', 'sharpness', 'angles', 'retention', 'motion', 'phys.case']) expect(keys).toContain(k);
    }
  });
  it('the no-signal unplug check is only in repair checks', () => {
    expect(buildPlan('buying', 1).some((p) => p.def.id === 'D')).toBe(false);
    expect(buildPlan('repair', 1).some((p) => p.def.id === 'D')).toBe(true);
  });
  it('repair runs are appended so earlier step indexes never move; other purposes ignore runs', () => {
    const one = buildPlan('repair', 1).map((p) => p.key);
    const two = buildPlan('repair', 2).map((p) => p.key);
    expect(two.slice(0, one.length)).toEqual(one);
    expect(two[one.length]).toBe('ofv2.A');
    expect(buildPlan('buying', 3).length).toBe(buildPlan('buying', 1).length);
  });
});
