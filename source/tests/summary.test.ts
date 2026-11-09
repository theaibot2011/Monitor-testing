import { describe, expect, it } from 'vitest';
import { buildSummary, testedRange } from '../src/lib/summary';
import { isolationHints } from '../src/lib/isolation';
import { refreshWarning } from '../src/lib/flow';
import type { Combo } from '../src/lib/session';
import { answeredSession, T0 } from './helpers';

const combo = (cable: Combo['cable'], port: string, refresh: string, lines: Combo['lines']): Combo => ({ id: port + refresh + cable, cable, port, refresh, lines });

describe('summary text', () => {
  it('includes purpose, monitor, tested time, overall result, every section and the honesty line', () => {
    const t = buildSummary(answeredSession('buying'), 'example.test');
    expect(t).toMatch(/Purpose: I’m buying a monitor/);
    expect(t).toMatch(/Monitor: AOC 24G2 \(serial SN1\)/);
    expect(t).toMatch(/Tested: /);
    expect(t).toMatch(/OVERALL: ALL CHECKS PASSED/);
    expect(t).toMatch(/Lines and stripes:/);
    expect(t).toMatch(/Picture checks:/);
    expect(t).toMatch(/Hands-on checks:/);
    expect(t).toMatch(/Dead and stuck pixels: PASSED/);
    expect(t).toMatch(/not a certified inspection/);
    expect(t).toMatch(/Made with MonitorTest 3\.1\.0: example\.test/);
    expect(t).not.toMatch(/QUICK/i);
    expect(t).not.toMatch(/repair|original fault|Combinations/i);
  });

  it('lists severity, not-checked items and refresh mismatch', () => {
    const s = answeredSession('selling');
    s.answers['dead'] = { ...s.answers['dead'], status: 'problem', severity: 'minor', note: '1 dot top-left' };
    s.answers['levels'].status = 'skipped';
    s.details.advertisedHz = '144';
    s.displayCheck!.refreshEstimate = 60;
    const t = buildSummary(s);
    expect(t).toMatch(/Dead and stuck pixels: PROBLEM FOUND \(small\) \(1 dot top-left\)/);
    expect(t).toMatch(/Not checked:\n- Dark and bright detail/);
    expect(t).toMatch(/advertised as 144 Hz but is running at about 60 Hz/);
    expect(t).toMatch(/OVERALL: NOT FINISHED/);
  });

  it('repair: shows warm-up per run, run-2-only note, combinations and hints', () => {
    const s = answeredSession('repair', 'passed', 2);
    s.answers['ofv2.A'] = { ...s.answers['ofv2.A'], status: 'problem', severity: 'serious' };
    s.flags.push({ run: 1, colour: 'Red', samePlace: 'yes', at: 0 });
    s.combos.push(combo('DP', 'USB-C left', '165', 'yes'), combo('HDMI', 'HDMI', '60', 'no'));
    const t = buildSummary(s);
    expect(t).toMatch(/run 2 \(monitor on for 35 min\)/);
    expect(t).toMatch(/did not show in run 1 but did show in run 2/);
    expect(t).toMatch(/OVERALL: SERIOUS PROBLEM FOUND/);
    expect(t).toMatch(/Lines flagged in colour cycle: 1 \(1 stayed in the same place/);
    expect(t).toMatch(/DisplayPort, socket USB-C left, 165 Hz: lines SEEN/);
    expect(t).toMatch(/hints only, not a diagnosis/i);
  });

  it('tested range shows start and end, or one time when they are the same minute', () => {
    const s = answeredSession('own');
    expect(testedRange(s)).toMatch(/–/);
    const same = { ...s, startedAt: T0 + 60000 + 5000 };
    for (const k of Object.keys(same.answers)) same.answers[k] = { ...same.answers[k], at: T0 + 60000 + 20000 };
    expect(testedRange(same)).not.toMatch(/–/);
    expect(testedRange({ ...s, startedAt: null, answers: {} })).toBe('Not started');
    expect(T0).toBeGreaterThan(0);
  });
});

describe('refresh rate check', () => {
  it('warns only when clearly below the advertised rate', () => {
    expect(refreshWarning('144', 60)).toMatch(/advertised as 144 Hz/);
    expect(refreshWarning('144', 143)).toBeNull();
    expect(refreshWarning('', 60)).toBeNull();
    expect(refreshWarning('165', null)).toBeNull();
  });
});

describe('fault-isolation hints (repair)', () => {
  it('needs at least two combinations unless no-signal showed lines', () => {
    expect(isolationHints([combo('DP', 'a', '165', 'yes')], null)).toEqual([]);
    expect(isolationHints([], true).join()).toMatch(/toward the monitor itself/);
  });
  it('every combination plus no-signal points toward the monitor', () => {
    expect(isolationHints([combo('DP', 'a', '165', 'yes'), combo('HDMI', 'b', '60', 'yes')], true).join(' ')).toMatch(/toward the monitor itself/);
  });
  it('one cable only points toward the cable', () => {
    expect(isolationHints([combo('DP', 'a', '165', 'yes'), combo('HDMI', 'a', '165', 'no')], false).join(' ')).toMatch(/only showed with the DisplayPort cable/);
  });
  it('one refresh rate only points toward cable, graphics card or setting', () => {
    const h = isolationHints([combo('DP', 'a', '165', 'yes'), combo('DP', 'a', '60', 'no')], false).join(' ');
    expect(h).toMatch(/only showed at 165 Hz/);
    expect(h).toMatch(/graphics card/);
  });
  it('no lines anywhere says so', () => {
    expect(isolationHints([combo('DP', 'a', '165', 'no'), combo('HDMI', 'b', '60', 'no')], false).join()).toMatch(/No lines were seen/);
  });
});

describe('motion frame timing', () => {
  it('measures pictures per second and late frames', async () => {
    const { motionStatsFrom, motionAdvice } = await import('../src/lib/motion');
    const even = Array.from({ length: 200 }, (_, i) => i * (1000 / 144));
    expect(motionStatsFrom(even)).toEqual({ fps: 144, latePct: 0 });
    const stutter = [...even];
    for (let i = 10; i < 200; i += 10) for (let j = i; j < 200; j++) stutter[j] += 1000 / 144;
    const m = motionStatsFrom(stutter)!;
    expect(m.latePct).toBeGreaterThan(8);
    expect(motionAdvice(m)).toMatch(/computer being busy/);
    expect(motionAdvice({ fps: 60, latePct: 0.5 })).toMatch(/smooth/);
    expect(motionStatsFrom([1, 2, 3])).toBeNull();
  });
  it('shows in the summary', () => {
    const s = answeredSession('buying');
    s.motion = { fps: 165, latePct: 1.2 };
    expect(buildSummary(s)).toMatch(/Motion and smearing: PASSED \[165 pictures per second, 1.2% late\]/);
  });
});
