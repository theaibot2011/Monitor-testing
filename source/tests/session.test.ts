import { describe, expect, it } from 'vitest';
import { LEGACY_STORAGE_KEY, migrate, newSession, SCHEMA_VERSION, STORAGE_KEY } from '../src/lib/session';
import { createStore, memoryKV, type KV } from '../src/lib/storage';
import { exportResults, parseResults } from '../src/lib/exportfile';
import { cycleColour, cycleIndex, nextStepIndex, shouldOfferRepeat } from '../src/lib/flow';
import { DEF_BY_ID } from '../src/lib/catalogue';
import { viewProgress, addView } from '../src/lib/views';
import { answeredSession, T0 } from './helpers';

/** A saved session exactly as MonitorTest 1/2 stored it. */
const v1Session = (mode: 'quick' | 'full') => ({
  schemaVersion: 1, id: 'old1', createdAt: T0, updatedAt: T0, mode, screen: 'report', stepIndex: 3, subStep: 0, phase: 'briefing',
  redo: false, displayReturn: false, nosignalStage: 0, unpluggedAt: null, runs: 2, runStartedAt: { '1': T0 },
  details: { operator: 'Ali', model: 'Dell P2419H', serial: 'X1', jobRef: 'R9', monitorOnAt: T0 },
  displayCheck: null,
  answers: { 'ofv1.A': { status: 'problem', note: 'top line', photo: '', at: T0 }, 'phys.power': { status: 'passed', note: '', photo: '', at: T0 } },
  flags: [], combos: [], evidence: 'old notes',
});

describe('session migration', () => {
  it('round-trips a valid v2 session unchanged', () => {
    const s = answeredSession('selling');
    s.flags.push({ run: 1, colour: 'Red', samePlace: 'no', at: 5 });
    s.views['dead'] = [4000, 4100, 4200, 4300, 4400];
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
    expect(back?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('upgrades v1 (Quick or Full) to v2 as a repair check, keeping every answer', () => {
    for (const mode of ['quick', 'full'] as const) {
      const s = migrate(v1Session(mode))!;
      expect(s.schemaVersion).toBe(2);
      expect(s.purpose).toBe('repair');
      expect(s.runs).toBe(2);
      expect(s.details.model).toBe('Dell P2419H');
      expect(s.details.advertisedHz).toBe('');
      expect(s.answers['ofv1.A']).toEqual({ status: 'problem', severity: 'serious', note: 'top line', photo: '', at: T0 });
      expect(s.answers['phys.power'].severity).toBeNull();
      expect(s.evidence).toBe('old notes');
      expect(s.views).toEqual({});
    }
  });

  it('rejects non-objects, unknown versions, bad modes and purposes', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('x')).toBeNull();
    expect(migrate([])).toBeNull();
    expect(migrate({ ...newSession(), schemaVersion: 99 })).toBeNull();
    expect(migrate({ ...v1Session('full'), mode: 'turbo' })).toBeNull();
    expect(migrate({ ...newSession(), purpose: 'stealing' })).toBeNull();
  });

  it('drops invalid answers and clamps bad fields instead of crashing', () => {
    const raw = {
      ...newSession('buying'),
      screen: 'nowhere',
      stepIndex: -4,
      answers: { 'ofv1.A': { status: 'passed', note: 1 }, '<script>': { status: 'passed' }, 'phys.power': { status: 'great' } },
      details: 'nope',
      views: { dead: ['x', -5, 3000], '<bad>': [1] },
      combos: [{ cable: 'VGA', lines: 'maybe' }],
    };
    const s = migrate(raw)!;
    expect(s.screen).toBe('home');
    expect(s.stepIndex).toBe(0);
    expect(Object.keys(s.answers)).toEqual(['ofv1.A']);
    expect(s.answers['ofv1.A'].note).toBe('');
    expect(s.details.model).toBe('');
    expect(s.views).toEqual({ dead: [0, 0, 3000] });
    expect(s.motion).toBeNull();
    expect(s.combos[0]).toMatchObject({ cable: 'other', lines: 'notsure' });
  });
});

describe('viewing gate: PASSED only after actually looking', () => {
  it('pattern checks need every picture on screen long enough', () => {
    const dead = DEF_BY_ID['dead'];
    expect(viewProgress(dead, undefined).ok).toBe(false);
    expect(viewProgress(dead, [4000, 4000, 4000, 4000]).reason).toMatch(/Picture 5 \(Blue\)/);
    expect(viewProgress(dead, [4000, 4000, 4000, 4000, 3999]).ok).toBe(false);
    expect(viewProgress(dead, [4000, 4000, 4000, 4000, 4000]).ok).toBe(true);
    expect(viewProgress(DEF_BY_ID['A'], [2000, 2000, 2000]).ok).toBe(true);
    expect(viewProgress(DEF_BY_ID['motion'], [4999]).ok).toBe(false);
  });
  it('colour cycle needs every colour shown; scan 10 s; no-signal 30 s; questions never gated', () => {
    expect(viewProgress(DEF_BY_ID['B'], [40000, 8]).ok).toBe(false);
    expect(viewProgress(DEF_BY_ID['B'], [18000, 9]).ok).toBe(true);
    expect(viewProgress(DEF_BY_ID['E2'], [9999]).ok).toBe(false);
    expect(viewProgress(DEF_BY_ID['E2'], [10000]).ok).toBe(true);
    expect(viewProgress(DEF_BY_ID['D'], [29000]).ok).toBe(false);
    expect(viewProgress(DEF_BY_ID['D'], [30000]).ok).toBe(true);
    expect(viewProgress(DEF_BY_ID['power'], undefined)).toEqual({ ok: true, reason: '', seconds: null });
  });
  it('addView accumulates per picture', () => {
    expect(addView(addView(undefined, 2, 500), 2, 700)).toEqual([0, 0, 1200]);
  });
});

describe('storage', () => {
  it('saves and loads through the key monitortest.session.v1', () => {
    const kv = memoryKV();
    const store = createStore(kv);
    const s = answeredSession('buying');
    store.save(s);
    expect(kv.getItem(STORAGE_KEY)).toContain('"schemaVersion":2');
    expect(createStore(kv).load().session).toEqual(s);
  });

  it('uses its own key, so older versions on the same address cannot delete its data', () => {
    expect(STORAGE_KEY).toBe('monitortest.session.v3');
    expect(LEGACY_STORAGE_KEY).toBe('monitortest.session.v1');
  });

  it('brings across a check saved by version 1 or 2 without touching the old copy', () => {
    const kv = memoryKV();
    const old = JSON.stringify(v1Session('quick'));
    kv.setItem(LEGACY_STORAGE_KEY, old);
    const store = createStore(kv);
    const s = store.load().session!;
    expect(s.purpose).toBe('repair');
    store.save(s);
    expect(kv.getItem(LEGACY_STORAGE_KEY)).toBe(old);
    expect(JSON.parse(kv.getItem(STORAGE_KEY)!).schemaVersion).toBe(2);
  });

  it('never deletes unreadable data under the old key, and prefers the v3 key', () => {
    const kv = memoryKV();
    kv.setItem(LEGACY_STORAGE_KEY, '{garbage');
    const res = createStore(kv).load();
    expect(res).toEqual({ session: null, message: null });
    expect(kv.getItem(LEGACY_STORAGE_KEY)).toBe('{garbage');
    const v3 = answeredSession('own');
    kv.setItem(STORAGE_KEY, JSON.stringify(v3));
    expect(createStore(kv).load().session?.purpose).toBe('own');
  });

  it('discards corrupt data with a short message', () => {
    const kv = memoryKV();
    kv.setItem(STORAGE_KEY, '{not json');
    const res = createStore(kv).load();
    expect(res.session).toBeNull();
    expect(res.message).toMatch(/fresh start/);
    expect(kv.getItem(STORAGE_KEY)).toBeNull();
  });

  it('falls back to memory when storage throws (e.g. private mode)', () => {
    const broken: KV = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const store = createStore(broken);
    expect(store.persistent).toBe(false);
    const s = newSession('own');
    store.save(s);
    expect(store.load().session).toEqual(s);
  });

  it('falls back to memory when saving starts failing (quota full)', () => {
    let full = false;
    const inner = memoryKV();
    const flaky: KV = { ...inner, setItem: (k, v) => { if (full) throw new Error('quota'); inner.setItem(k, v); } };
    const store = createStore(flaky);
    expect(store.persistent).toBe(true);
    full = true;
    const s = newSession('selling');
    store.save(s);
    expect(store.persistent).toBe(false);
    expect(store.load().session).toEqual(s);
  });

  it('falls back to memory when there is no storage at all', () => {
    expect(createStore(null).persistent).toBe(false);
  });
});

describe('results file', () => {
  it('exports and strictly re-imports', () => {
    const s = answeredSession('repair');
    const res = parseResults(exportResults(s));
    expect('session' in res && res.session).toEqual(s);
  });
  it('imports a results file saved by version 1 or 2', () => {
    const res = parseResults(JSON.stringify({ format: 'monitortest-results', session: v1Session('full') }));
    expect('session' in res && res.session.purpose).toBe('repair');
  });
  it('rejects other JSON and garbage', () => {
    expect(parseResults('{"a":1}')).toHaveProperty('error');
    expect(parseResults('not json')).toHaveProperty('error');
    expect(parseResults(JSON.stringify({ format: 'monitortest-results', session: { schemaVersion: 7 } }))).toHaveProperty('error');
  });
});

describe('flow', () => {
  it('moves to the next unanswered step, wrapping to earlier gaps, then the report', () => {
    const s = answeredSession('buying');
    delete s.answers['ofv1.B'];
    delete s.answers['phys.noise'];
    const keys = ['ofv1.A', 'ofv1.B'];
    expect(keys.length).toBe(2);
    const plan = Object.keys(s.answers);
    expect(plan.length).toBeGreaterThan(5);
    const iNoise = nextStepIndex(s, 2);
    expect(iNoise).toBeGreaterThan(2);
    expect(nextStepIndex(s, iNoise)).toBe(1);
    expect(nextStepIndex(answeredSession('buying'), 0)).toBe(-1);
  });
  it('offers a repeat run only for repair checks after 30 minutes of warm-up', () => {
    const s = answeredSession('repair');
    expect(shouldOfferRepeat(s, T0 + 29 * 60000)).toBe(false);
    expect(shouldOfferRepeat(s, T0 + 31 * 60000)).toBe(true);
    expect(shouldOfferRepeat(answeredSession('buying'), T0 + 31 * 60000)).toBe(false);
  });
});

describe('colour cycle index (crash regression)', () => {
  it('never returns an undefined colour, even for a slightly negative first-frame time', () => {
    for (const t of [-0.3, -5000, NaN, 0, 3999, 4000, 1e9]) {
      const c = cycleColour(cycleIndex(t, 4));
      expect(c).toBeDefined();
      expect(c.color).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(cycleIndex(-0.3, 4)).toBe(0);
    expect(cycleColour(cycleIndex(4000, 4)).name).toBe('White');
  });
});
