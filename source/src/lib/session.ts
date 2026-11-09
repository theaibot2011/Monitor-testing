import type { Purpose } from './catalogue';

/** v3 keeps its own keys so older versions on the same web address (e.g. GitHub Pages /v2/) can never delete its data. */
export const STORAGE_KEY = 'monitortest.session.v3';
export const ARCHIVE_KEY = 'monitortest.archive.v3';
/** Keys used by versions 1 and 2. Read once to bring old checks across; never written or deleted. */
export const LEGACY_STORAGE_KEY = 'monitortest.session.v1';
export const LEGACY_ARCHIVE_KEY = 'monitortest.archive.v1';
export const INTRO_KEY = 'monitortest.seenIntro.v1';
export const SCHEMA_VERSION = 2;

export type Status = 'passed' | 'problem' | 'notsure' | 'skipped';
export type Severity = 'minor' | 'serious';
export type Screen = 'home' | 'before' | 'prep' | 'details' | 'display' | 'test' | 'report' | 'review';
export type Phase = 'briefing' | 'pattern' | 'answer';
export type YesNo = 'yes' | 'no' | 'notsure';
export type Setup = 'laptop' | 'desktop';

export interface Answer {
  status: Status;
  /** Only for PROBLEM FOUND. */
  severity: Severity | null;
  note: string;
  photo: string;
  at: number;
}

export interface LineFlag {
  run: number;
  colour: string;
  samePlace: YesNo | null;
  at: number;
}

export interface Combo {
  id: string;
  cable: 'DP' | 'HDMI' | 'other';
  port: string;
  refresh: string;
  lines: YesNo;
}

export interface DisplayCheck {
  at: number;
  viewport: string;
  dpr: number;
  canvas: string;
  screen: string;
  refreshEstimate: number | null;
  warnings: string[];
}

export interface Details {
  operator: string;
  model: string;
  serial: string;
  jobRef: string;
  monitorOnAt: number;
  /** Refresh rate on the box or listing, e.g. "144". */
  advertisedHz: string;
}

export interface Session {
  schemaVersion: number;
  id: string;
  createdAt: number;
  updatedAt: number;
  /** When the person pressed Start; null until then. */
  startedAt: number | null;
  purpose: Purpose;
  setup: Setup;
  screen: Screen;
  stepIndex: number;
  subStep: number;
  phase: Phase;
  redo: boolean;
  displayReturn: boolean;
  nosignalStage: number;
  unpluggedAt: number | null;
  runs: number;
  runStartedAt: Record<string, number>;
  details: Details;
  displayCheck: DisplayCheck | null;
  answers: Record<string, Answer>;
  /** Milliseconds each picture of a step was actually on screen, by step key. */
  views: Record<string, number[]>;
  flags: LineFlag[];
  combos: Combo[];
  evidence: string;
  /** Frame timing measured during the motion check. */
  motion: MotionStats | null;
}

export interface MotionStats {
  /** Average frames drawn per second. */
  fps: number;
  /** Percentage of frames that arrived late (stutter). */
  latePct: number;
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function newSession(purpose: Purpose = 'buying', now = Date.now()): Session {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    purpose,
    setup: 'laptop',
    screen: 'home',
    stepIndex: 0,
    subStep: 0,
    phase: 'briefing',
    redo: false,
    displayReturn: false,
    nosignalStage: 0,
    unpluggedAt: null,
    runs: 1,
    runStartedAt: {},
    details: { operator: '', model: '', serial: '', jobRef: '', monitorOnAt: now, advertisedHz: '' },
    displayCheck: null,
    answers: {},
    views: {},
    flags: [],
    combos: [],
    evidence: '',
    motion: null,
  };
}

// ---------- strict validation helpers (never trust stored or imported data) ----------
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

const SCREENS: Screen[] = ['home', 'before', 'prep', 'details', 'display', 'test', 'report', 'review'];
const PHASES: Phase[] = ['briefing', 'pattern', 'answer'];
const STATUSES: Status[] = ['passed', 'problem', 'notsure', 'skipped'];
const PURPOSES: Purpose[] = ['buying', 'selling', 'repair', 'own'];
const YN: YesNo[] = ['yes', 'no', 'notsure'];
const KEY_RE = /^(ofv\d{1,2}\.[A-Z0-9]{1,3}|phys\.[a-z]{1,20}|[a-z]{1,20})$/;

function sanitiseV2(raw: Record<string, unknown>): Session {
  const purpose = raw.purpose;
  if (!PURPOSES.includes(purpose as Purpose)) throw new Error('purpose');
  const base = newSession(purpose as Purpose, num(raw.createdAt, Date.now()));
  const d = isObj(raw.details) ? raw.details : {};
  const answers: Record<string, Answer> = {};
  if (isObj(raw.answers)) {
    for (const [k, v] of Object.entries(raw.answers)) {
      if (!KEY_RE.test(k) || !isObj(v) || !STATUSES.includes(v.status as Status)) continue;
      const status = v.status as Status;
      answers[k] = {
        status,
        severity: status === 'problem' ? oneOf(v.severity, ['minor', 'serious'] as const, 'serious') : null,
        note: str(v.note),
        photo: str(v.photo, 300),
        at: num(v.at, 0),
      };
    }
  }
  const views: Record<string, number[]> = {};
  if (isObj(raw.views)) {
    for (const [k, v] of Object.entries(raw.views)) {
      if (!KEY_RE.test(k) || !Array.isArray(v)) continue;
      views[k] = v.slice(0, 50).map((n) => Math.max(0, num(n, 0)));
    }
  }
  const flags: LineFlag[] = Array.isArray(raw.flags)
    ? raw.flags.filter(isObj).slice(0, 500).map((f) => ({
        run: Math.max(1, Math.floor(num(f.run, 1))),
        colour: str(f.colour, 40),
        samePlace: f.samePlace === null ? null : oneOf(f.samePlace, YN, 'notsure'),
        at: num(f.at, 0),
      }))
    : [];
  const combos: Combo[] = Array.isArray(raw.combos)
    ? raw.combos.filter(isObj).slice(0, 100).map((c) => ({
        id: str(c.id, 40) || newId(),
        cable: oneOf(c.cable, ['DP', 'HDMI', 'other'] as const, 'other'),
        port: str(c.port, 100),
        refresh: str(c.refresh, 20),
        lines: oneOf(c.lines, YN, 'notsure'),
      }))
    : [];
  let displayCheck: DisplayCheck | null = null;
  if (isObj(raw.displayCheck)) {
    const dc = raw.displayCheck;
    displayCheck = {
      at: num(dc.at, 0),
      viewport: str(dc.viewport, 40),
      dpr: num(dc.dpr, 1),
      canvas: str(dc.canvas, 40),
      screen: str(dc.screen, 40),
      refreshEstimate: typeof dc.refreshEstimate === 'number' && Number.isFinite(dc.refreshEstimate) ? dc.refreshEstimate : null,
      warnings: Array.isArray(dc.warnings) ? dc.warnings.map((w) => str(w, 500)).filter(Boolean).slice(0, 20) : [],
    };
  }
  const runStartedAt: Record<string, number> = {};
  if (isObj(raw.runStartedAt)) {
    for (const [k, v] of Object.entries(raw.runStartedAt)) if (/^\d{1,2}$/.test(k) && typeof v === 'number') runStartedAt[k] = v;
  }
  return {
    ...base,
    id: str(raw.id, 40) || base.id,
    updatedAt: num(raw.updatedAt, base.createdAt),
    startedAt: typeof raw.startedAt === 'number' && Number.isFinite(raw.startedAt) ? raw.startedAt : null,
    setup: oneOf(raw.setup, ['laptop', 'desktop'] as const, 'laptop'),
    screen: oneOf(raw.screen, SCREENS, 'home'),
    stepIndex: Math.max(0, Math.floor(num(raw.stepIndex, 0))),
    subStep: Math.max(0, Math.floor(num(raw.subStep, 0))),
    phase: oneOf(raw.phase, PHASES, 'briefing'),
    redo: raw.redo === true,
    displayReturn: raw.displayReturn === true,
    nosignalStage: Math.min(3, Math.max(0, Math.floor(num(raw.nosignalStage, 0)))),
    unpluggedAt: typeof raw.unpluggedAt === 'number' ? raw.unpluggedAt : null,
    runs: Math.min(20, Math.max(1, Math.floor(num(raw.runs, 1)))),
    runStartedAt,
    details: {
      operator: str(d.operator, 100),
      model: str(d.model, 100),
      serial: str(d.serial, 100),
      jobRef: str(d.jobRef, 100),
      monitorOnAt: num(d.monitorOnAt, base.createdAt),
      advertisedHz: str(d.advertisedHz, 10),
    },
    displayCheck,
    answers,
    views,
    flags,
    combos,
    evidence: str(raw.evidence, 5000),
    motion:
      isObj(raw.motion) && typeof raw.motion.fps === 'number' && typeof raw.motion.latePct === 'number'
        ? { fps: Math.max(0, Math.min(1000, Math.round(raw.motion.fps))), latePct: Math.max(0, Math.min(100, Math.round(raw.motion.latePct * 10) / 10)) }
        : null,
  };
}

/** v1 (MonitorTest 1 and 2) had Quick/Full modes and was built for repair checks. */
function upgradeV1toV2(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.mode !== 'quick' && raw.mode !== 'full') throw new Error('mode');
  const { mode: _mode, ...rest } = raw;
  void _mode;
  return {
    ...rest,
    schemaVersion: 2,
    purpose: 'repair',
    setup: 'laptop',
    startedAt: typeof raw.createdAt === 'number' ? raw.createdAt : null,
    views: {},
  };
}

/**
 * Upgrade stored or imported data to the current schema, one version at a time.
 * Returns null when the data is not a valid MonitorTest session.
 */
export function migrate(raw: unknown): Session | null {
  try {
    if (!isObj(raw)) return null;
    let data: Record<string, unknown> = { ...raw };
    if (data.schemaVersion === 1) data = upgradeV1toV2(data);
    if (data.schemaVersion !== SCHEMA_VERSION) return null;
    return sanitiseV2(data);
  } catch {
    return null;
  }
}

export function warmupMinutes(session: Session, at: number) {
  return Math.max(0, Math.floor((at - session.details.monitorOnAt) / 60000));
}
