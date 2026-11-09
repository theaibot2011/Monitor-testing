import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Shell } from '../components/Shell';
import { Button, Card, H1, inputClass } from '../components/ui';
import { PatternCanvas } from '../components/PatternCanvas';
import { useApp } from '../state';
import { buildPlan, CYCLE_COLOURS, GROUP_LABEL, questionFor, STATUS_LABEL, type PlanStep, type TestDef } from '../lib/catalogue';
import { drawPattern, drawScan, type ScanOptions } from '../lib/draw';
import { enterFullscreen, exitFullscreen, fullscreenSupported, useFullscreenActive, useNow, useStopwatch, useWakeLock } from '../lib/hooks';
import { addRunPatch, cycleColour, cycleIndex, nextStepIndex, shouldOfferRepeat } from '../lib/flow';
import { addView, maxView, viewProgress } from '../lib/views';
import { isMac } from '../lib/platform';
import { warmupMinutes, type Answer, type MotionStats, type Severity, type Status, type YesNo } from '../lib/session';
import { motionStatsFrom, motionAdvice } from '../lib/motion';

const FULLSCREEN_KINDS = new Set(['patterns', 'cycle', 'scan']);
const minutesText = (secs: number) => (secs < 60 ? 'under 1 minute' : `about ${Math.round(secs / 60)} minute${Math.round(secs / 60) === 1 ? '' : 's'}`);

export default function TestScreen() {
  const { s, update } = useApp();
  const plan = buildPlan(s.purpose, s.runs);
  const step = plan[s.stepIndex];
  const fs = useFullscreenActive();
  const [noFullscreen, setNoFullscreen] = useState(() => !fullscreenSupported());
  useWakeLock(true);

  useEffect(() => {
    if (!step) update({ screen: 'report' });
  }, [step, update]);
  // Leave full screen when we move on to a non-test screen.
  useEffect(() => () => void exitFullscreen(), []);
  if (!step) return null;

  const usesFullscreen = FULLSCREEN_KINDS.has(step.def.kind);
  const inStage = s.phase === 'pattern' && usesFullscreen;
  const paused = inStage && !fs && !noFullscreen;

  const start = async () => {
    if (usesFullscreen) {
      const ok = await enterFullscreen();
      if (!ok) setNoFullscreen(true);
    } else {
      await exitFullscreen();
    }
    update((prev) => {
      const runStartedAt = { ...prev.runStartedAt };
      if (step.run && runStartedAt[String(step.run)] === undefined) runStartedAt[String(step.run)] = Date.now();
      return {
        phase: step.def.kind === 'question' ? 'answer' : 'pattern',
        subStep: 0,
        runStartedAt,
        startedAt: prev.startedAt ?? Date.now(),
      };
    });
  };

  const answer = (status: Status, severity: Severity | null, note: string, photo: string) => {
    update((prev) => {
      const answers: Record<string, Answer> = { ...prev.answers, [step.key]: { status, severity: status === 'problem' ? severity ?? 'serious' : null, note, photo, at: Date.now() } };
      const base = { answers, subStep: 0, phase: 'briefing' as const, nosignalStage: 0, unpluggedAt: null };
      if (prev.redo) return { ...base, redo: false, screen: 'review' };
      const next = nextStepIndex(prev, prev.stepIndex, answers);
      if (next < 0) return { ...base, screen: 'report' };
      return { ...base, stepIndex: next };
    });
  };

  if (paused) return <PausedScreen step={step} onResume={async () => { if (!(await enterFullscreen())) setNoFullscreen(true); }} onWithout={() => setNoFullscreen(true)} />;

  if (s.phase === 'pattern') {
    if (step.def.kind === 'patterns') return <PatternStage step={step} />;
    if (step.def.kind === 'cycle') return <CycleStage step={step} />;
    if (step.def.kind === 'scan') return <ScanStage step={step} />;
    if (step.def.kind === 'nosignal') return <NoSignalFlow step={step} />;
  }
  if (s.phase === 'answer') return <AnswerScreen step={step} onAnswer={answer} />;
  return <Briefing step={step} index={s.stepIndex} total={plan.length} onStart={start} onSkip={() => answer('skipped', null, '', '')} />;
}

function Progress({ index, total }: { index: number; total: number }) {
  const { s } = useApp();
  const left = buildPlan(s.purpose, s.runs)
    .filter((p) => !s.answers[p.key])
    .reduce((t, p) => t + p.def.seconds, 0);
  const mins = Math.max(1, Math.round(left / 60));
  return (
    <div className="mb-6">
      <div className="text-slate-400 mb-1" data-testid="progress-text">
        Step {index + 1} of {total} · about {mins} minute{mins === 1 ? '' : 's'} left · your progress is saved, so you can stop and carry on later
      </div>
      <div className="h-2 rounded bg-slate-700 overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1} aria-label="Progress">
        <div className="h-full bg-sky-400" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>
    </div>
  );
}

function WarmupLine({ run }: { run?: number }) {
  const { s } = useApp();
  const now = useNow(15000);
  if (!run || s.purpose !== 'repair') return null;
  return (
    <p className="text-lg text-sky-200 mb-4">
      Run {run} of the fault check. The monitor has been on for <b>{warmupMinutes(s, now)} min</b>.
    </p>
  );
}

function RepeatPrompt() {
  const { s, update } = useApp();
  const now = useNow(30000);
  if (!shouldOfferRepeat(s, now)) return null;
  return (
    <Card className="mb-6 border-sky-500 bg-sky-950/40">
      <p className="text-lg mb-3">The monitor has now been on for {warmupMinutes(s, now)} minutes. Some faults only show once it is warm, so repeating the fault check now is a good idea.</p>
      <Button variant="secondary" onClick={() => update(addRunPatch(s))}>Repeat the fault check now</Button>
    </Card>
  );
}

/** What a PASS and a PROBLEM look like, shown on the briefing and again on the answer card. */
function NormalVsProblem({ def }: { def: TestDef }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-6">
      <Card className="border-emerald-600">
        <div className="font-semibold text-lg mb-2 text-emerald-300">{'✓'} Normal (PASSED)</div>
        <ul className="list-disc pl-6 space-y-1">
          {def.normal.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </Card>
      <Card className="border-rose-600">
        <div className="font-semibold text-lg mb-2 text-rose-300">{'✗'} A problem (PROBLEM FOUND)</div>
        <ul className="list-disc pl-6 space-y-1">
          {def.problem.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </Card>
    </div>
  );
}

function Briefing({ step, index, total, onStart, onSkip }: { step: PlanStep; index: number; total: number; onStart: () => void; onSkip: () => void }) {
  const { s, update } = useApp();
  const d = step.def;
  const [confirmSkip, setConfirmSkip] = useState(false);
  return (
    <Shell>
      <Progress index={index} total={total} />
      {d.group !== 'lines' && <RepeatPrompt />}
      <div className="text-sky-300 font-semibold uppercase tracking-wide mb-1">
        {GROUP_LABEL(d.group, s.purpose)}{d.mandatory ? '' : ' · optional'}
      </div>
      <H1>{d.title}</H1>
      <WarmupLine run={step.run} />
      <p className="text-slate-300 text-lg mb-2">Time: {minutesText(d.seconds)}</p>
      <p className="text-xl mb-5">{d.intro}</p>
      <NormalVsProblem def={d} />
      {d.changingColours && (
        <p className="text-amber-200 mb-4">This check shows {d.kind === 'cycle' ? 'full-screen colours changing every few seconds' : 'a moving block'}. Nothing flashes quickly. If you are sensitive to flashing light, skip it.</p>
      )}
      {FULLSCREEN_KINDS.has(d.kind) && (
        <p className="text-slate-300 mb-6">
          The screen goes full screen.{' '}
          {d.kind === 'patterns' ? <>Click anywhere, or press <b>Space</b> or <b>{'→'}</b>, for the next picture; <b>{'←'}</b> goes back. </> : <>Press <b>Enter</b> when you have finished watching. </>}
          Move the mouse to see the buttons, including <b>{'✕'} Exit full screen</b>. You can also press <b>Esc</b> at any time; your place is kept.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button big onClick={onStart} data-testid="start-step">{d.kind === 'question' ? 'Answer this check' : 'Start'}</Button>
        <div className="flex flex-wrap gap-3">
          {index > 0 && <Button variant="ghost" onClick={() => update({ stepIndex: index - 1, phase: 'briefing', subStep: 0, nosignalStage: 0 })}>Back to previous step</Button>}
          <Button variant="ghost" onClick={() => setConfirmSkip(true)} data-testid="skip-step">Skip this check</Button>
          <Button variant="ghost" onClick={() => update({ screen: 'home' })}>Home</Button>
          {s.redo && <Button variant="ghost" onClick={() => update({ screen: 'review', redo: false })}>Back to review</Button>}
        </div>
        {confirmSkip && (
          <Card className="border-amber-400" >
            <p className="text-lg mb-3">
              Skip "{d.title}"? It will be listed as "Not checked" on the report{d.mandatory ? ', and the overall result will say NOT FINISHED until you do it' : ''}. You can come back to it later from "Review all answers".
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={onSkip} data-testid="confirm-skip">Yes, skip it</Button>
              <Button variant="ghost" onClick={() => setConfirmSkip(false)}>No, go back</Button>
            </div>
          </Card>
        )}
      </div>
    </Shell>
  );
}

function PausedScreen({ step, onResume, onWithout }: { step: PlanStep; onResume: () => void; onWithout: () => void }) {
  const { s, update } = useApp();
  return (
    <Shell>
      <H1>Testing paused</H1>
      <p className="text-xl mb-4">Full screen switched off. This happens when you press Esc, refresh the page, plug or unplug a cable, or change screen settings.</p>
      <p className="text-lg text-slate-300 mb-8">Your place is kept: <b>{step.def.title}</b>{step.def.patterns ? `, picture ${s.subStep + 1} of ${step.def.patterns.length}` : ''}.</p>
      <div className="flex flex-col gap-3">
        <Button big onClick={onResume}>Resume full screen</Button>
        <Button big variant="secondary" onClick={onWithout}>Carry on without full screen</Button>
        <Button variant="ghost" onClick={() => update({ phase: 'briefing' })}>Back to the instructions</Button>
      </div>
    </Shell>
  );
}

/** Records how long picture `index` of a step is on screen while the page is visible. */
function useRecordView(key: string, index: number, getMs?: () => number) {
  const { update } = useApp();
  const getRef = useRef(getMs);
  getRef.current = getMs;
  useEffect(() => {
    let start: number | null = document.visibilityState === 'visible' ? performance.now() : null;
    let acc = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden' && start !== null) {
        acc += performance.now() - start;
        start = null;
      } else if (document.visibilityState === 'visible' && start === null) start = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (start !== null) acc += performance.now() - start;
      // Timed checks report their own paused-aware time.
      const ms = getRef.current ? getRef.current() : acc;
      if (ms > 0) update((prev) => ({ views: { ...prev.views, [key]: addView(prev.views[key], index, ms) } }));
    };
  }, [key, index, update]);
}

/** Auto-hiding control bar for full-screen patterns. */
function useControlsVisible() {
  const [visible, setVisible] = useState(true);
  const timer = useRef(0);
  const poke = useCallback(() => {
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), 2500);
  }, []);
  useEffect(() => {
    poke();
    const onKey = (e: KeyboardEvent) => e.key === 'Tab' && poke();
    window.addEventListener('mousemove', poke);
    window.addEventListener('touchstart', poke);
    window.addEventListener('keydown', onKey);
    window.addEventListener('focusin', poke);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener('mousemove', poke);
      window.removeEventListener('touchstart', poke);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('focusin', poke);
    };
  }, [poke]);
  return visible;
}

/** Always-available way out of full screen (also Esc). Keeps the person's place. */
function ExitButton() {
  const { update } = useApp();
  return (
    <Button
      variant="ghost"
      aria-label="Exit full screen"
      onClick={async () => {
        await exitFullscreen();
        update({ phase: 'briefing' });
      }}
    >
      <span className="sm:hidden">✕ Exit</span>
      <span className="hidden sm:inline">✕ Exit full screen</span>
    </Button>
  );
}

function StageBar({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <div
      // Hidden controls are taken out of the keyboard order (Tab shows them first).
      ref={(el) => el?.toggleAttribute('inert', !visible)}
      data-testid="stage-bar"
      className={`ui-anim fixed left-1/2 -translate-x-1/2 bottom-3 sm:bottom-6 z-50 flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-2xl bg-slate-900/90 border border-slate-600 px-2 py-2 sm:px-4 sm:py-3 text-white w-max max-w-[96vw] text-sm sm:text-base [&_button]:max-sm:px-3 [&_button]:max-sm:py-2 [&_button]:max-sm:text-sm ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {children}
    </div>
  );
}

function useKeys(map: Record<string, () => void>) {
  const ref = useRef(map);
  ref.current = map;
  // Layout effect: the key listener is in place before the first picture is painted.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key === ' ' ? 'Space' : e.key;
      const fn = ref.current[k] ?? ref.current[k.toLowerCase()];
      if (fn) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function PatternStage({ step }: { step: PlanStep }) {
  const { s, update } = useApp();
  const patterns = step.def.patterns!;
  const i = Math.min(s.subStep, patterns.length - 1);
  const spec = patterns[i];
  const visible = useControlsVisible();
  useRecordView(step.key, i);
  // Motion check: measure frame timing so stutter from a busy computer is not blamed on the monitor.
  const frames = useRef<number[]>([]);
  useEffect(() => {
    if (spec.kind !== 'motion') return;
    frames.current = [];
    return () => {
      const stats: MotionStats | null = motionStatsFrom(frames.current);
      if (stats) update({ motion: stats });
    };
  }, [spec.kind, update]);
  // Functional updates so rapid key presses never read a stale picture index.
  const next = () =>
    update((prev) => {
      if (prev.phase !== 'pattern') return {};
      const cur = Math.min(prev.subStep, patterns.length - 1);
      return cur + 1 < patterns.length ? { subStep: cur + 1 } : { phase: 'answer' };
    });
  const back = () =>
    update((prev) => {
      if (prev.phase !== 'pattern') return {};
      const cur = Math.min(prev.subStep, patterns.length - 1);
      return cur > 0 ? { subStep: cur - 1 } : { phase: 'briefing' };
    });
  useKeys({ ArrowRight: next, Space: next, Enter: next, ArrowLeft: back });
  return (
    <div className={`pattern-stage ${visible ? 'show-cursor' : ''}`}>
      <PatternCanvas
        version={`${step.key}-${i}`}
        animate={spec.kind === 'motion'}
        draw={(ctx, w, h, dpr, t) => drawPattern(ctx, w, h, spec, t, dpr)}
        onFrame={spec.kind === 'motion' ? (t) => void (frames.current.length < 5000 && frames.current.push(t)) : undefined}
      />
      {/* Click anywhere on the picture for the next one. */}
      <div className="fixed inset-0 z-40" onClick={next} data-testid="next-area" aria-hidden="true" />
      <StageBar visible={visible}>
        <Button variant="secondary" onClick={back}>← Back</Button>
        <span className="px-1 sm:px-2 sm:text-lg" data-testid="pattern-label">{i + 1} of {patterns.length}: {spec.label}</span>
        <Button onClick={next} data-testid="pattern-next">{i + 1 < patterns.length ? 'Next →' : 'Finished →'}</Button>
        <ExitButton />
        <span className="hidden sm:block basis-full text-center text-sm text-slate-300">Click anywhere or press Space for the next picture · Esc to leave</span>
      </StageBar>
    </div>
  );
}

function InterruptedOverlay({ onResume }: { onResume: () => void }) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/80 p-6">
      <Card className="max-w-lg text-center">
        <p className="text-2xl font-bold mb-2">Timed check paused</p>
        <p className="text-lg mb-5">The page was hidden or the browser slowed it down, so the timer stopped to keep the check fair.</p>
        <Button big onClick={onResume}>Resume</Button>
      </Card>
    </div>
  );
}

function CycleStage({ step }: { step: PlanStep }) {
  const { update } = useApp();
  const [speed, setSpeed] = useState(4);
  const [pending, setPending] = useState<{ idx: number; colour: string } | null>(null);
  const [asking, setAsking] = useState<{ colour: string } | null>(null);
  const [done, setDone] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [flagCount, setFlagCount] = useState(0);
  const sw = useStopwatch(!asking && !done && !userPaused);
  const watched = useRef(0);
  const visible = useControlsVisible();
  const total = CYCLE_COLOURS.length * 2;
  const idx = cycleIndex(sw.elapsed, speed);
  const colour = cycleColour(idx);
  // Real watching time, excluding pauses.
  watched.current = Math.max(watched.current, sw.elapsed);
  useRecordView(step.key, 0, () => watched.current);
  const coloursSeen = useRef(0);
  coloursSeen.current = Math.max(coloursSeen.current, Math.min(idx + 1, total));
  useEffect(
    () => () => {
      const n = coloursSeen.current;
      update((prev) => ({ views: { ...prev.views, [step.key]: maxView(prev.views[step.key], 1, n) } }));
    },
    [step.key, update]
  );

  useEffect(() => {
    if (!done && idx >= total) setDone(true);
  }, [idx, total, done]);
  useEffect(() => {
    if (pending && (done || sw.elapsed >= (pending.idx + 1) * speed * 1000 + 1500)) {
      setAsking({ colour: pending.colour });
      setPending(null);
    }
  }, [pending, sw.elapsed, speed, done]);

  const flag = () => {
    if (pending || asking || done) return;
    setPending({ idx, colour: colour.name });
  };
  const record = (samePlace: YesNo) => {
    const c = asking!.colour;
    update((prev) => ({ flags: [...prev.flags, { run: step.run ?? 1, colour: c, samePlace, at: Date.now() }] }));
    setFlagCount((n) => n + 1);
    setAsking(null);
  };
  const finish = () => update({ phase: 'answer' });
  useKeys({ l: flag, Space: () => setUserPaused((p) => !p), Enter: finish });

  return (
    <div className={`pattern-stage ${visible || asking || done ? 'show-cursor' : ''}`}>
      <PatternCanvas version={colour.color} draw={(ctx, w, h) => drawPattern(ctx, w, h, { kind: 'solid', color: colour.color, label: colour.name })} />
      {/* A click on the colour only brings the buttons back; lines are flagged with the button or L, never by accident. */}
      {!done && !asking && <div className="fixed inset-0 z-40" data-testid="cycle-area" aria-hidden="true" />}
      {sw.interrupted && <InterruptedOverlay onResume={sw.resume} />}
      {pending && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-slate-900/90 text-white text-lg px-5 py-3 pointer-events-none">
          Line noted. Watch whether it stays in the same place on the next colour{'…'}
        </div>
      )}
      {asking && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-6">
          <Card className="max-w-xl">
            <p className="text-2xl font-bold mb-2">Line noted (on {asking.colour})</p>
            <p className="text-xl mb-5">Did it stay in the same place when the colour changed?</p>
            <div className="grid gap-3">
              <Button big variant="secondary" onClick={() => record('yes')}>Yes, same place</Button>
              <Button big variant="secondary" onClick={() => record('no')}>No, it moved or went away</Button>
              <Button big variant="secondary" onClick={() => record('notsure')}>Not sure</Button>
            </div>
          </Card>
        </div>
      )}
      {done && !asking && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-6">
          <Card className="max-w-xl">
            <p className="text-2xl font-bold mb-2">Colour cycle finished</p>
            <p className="text-lg mb-5">You flagged {flagCount} line{flagCount === 1 ? '' : 's'} this time.</p>
            <div className="grid gap-3">
              <Button big onClick={finish}>Answer the question</Button>
              <Button big variant="secondary" onClick={() => { sw.reset(); setDone(false); }}>Watch it again</Button>
            </div>
          </Card>
        </div>
      )}
      {!done && !asking && (
        <StageBar visible={visible}>
          <span className="text-lg">{colour.name} {'·'} {Math.min(idx + 1, total)} of {total}</span>
          <Button variant="problem" onClick={flag} disabled={!!pending}>I see a line (L)</Button>
          <Button variant="secondary" onClick={() => setUserPaused((p) => !p)}>{userPaused ? 'Play' : 'Pause'}</Button>
          <label className="flex items-center gap-2">
            Seconds per colour
            <select className="bg-slate-800 rounded px-2 py-2" value={speed} onChange={(e) => { setSpeed(Number(e.target.value)); sw.reset(); }}>
              {[2, 4, 6, 8].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <Button onClick={finish}>Finished →</Button>
          <ExitButton />
          <span className="hidden sm:block basis-full text-center text-sm text-slate-300">See a line? Press L or the red button · Enter when finished · Esc to leave</span>
        </StageBar>
      )}
    </div>
  );
}

function ScanStage({ step }: { step: PlanStep }) {
  const { update } = useApp();
  const [opts, setOpts] = useState<ScanOptions>({ direction: 'horizontal', background: 'black', secondsPerPass: 30 });
  const [userPaused, setUserPaused] = useState(false);
  const sw = useStopwatch(!userPaused);
  const visible = useControlsVisible();
  const elapsedRef = useRef(0);
  elapsedRef.current = sw.elapsed;
  const watched = useRef(0);
  watched.current = Math.max(watched.current, sw.elapsed);
  useRecordView(step.key, 0, () => watched.current);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const pos = ((sw.elapsed % (opts.secondsPerPass * 1000)) / (opts.secondsPerPass * 1000)) * 100;
  const finish = () => update({ phase: 'answer' });
  useKeys({ Space: () => setUserPaused((p) => !p), Enter: finish });
  const set = (p: Partial<ScanOptions>) => {
    setOpts((o) => ({ ...o, ...p }));
    watched.current = Math.max(watched.current, sw.elapsed);
    sw.reset();
  };
  return (
    <div className={`pattern-stage ${visible ? 'show-cursor' : ''}`}>
      <PatternCanvas version="scan" animate draw={(ctx, w, h) => void drawScan(ctx, w, h, optsRef.current, elapsedRef.current)} />
      {sw.interrupted && <InterruptedOverlay onResume={sw.resume} />}
      <StageBar visible={visible || userPaused}>
        <span className="text-lg w-52">Line at {Math.round(pos)}% from the {opts.direction === 'horizontal' ? 'top' : 'left'}</span>
        <Button variant="secondary" onClick={() => setUserPaused((p) => !p)}>{userPaused ? 'Play' : 'Pause'}</Button>
        <select className="bg-slate-800 rounded px-2 py-2" value={opts.direction} onChange={(e) => set({ direction: e.target.value as ScanOptions['direction'] })} aria-label="Direction">
          <option value="horizontal">Line moves down</option>
          <option value="vertical">Line moves across</option>
        </select>
        <select className="bg-slate-800 rounded px-2 py-2" value={opts.background} onChange={(e) => set({ background: e.target.value as ScanOptions['background'] })} aria-label="Background">
          <option value="black">On black</option>
          <option value="white">On white</option>
        </select>
        <label className="flex items-center gap-2">
          {opts.secondsPerPass} s per pass
          <input type="range" min={10} max={60} step={5} value={opts.secondsPerPass} onChange={(e) => set({ secondsPerPass: Number(e.target.value) })} aria-label="Seconds per pass" />
        </label>
        <Button onClick={finish}>Finished →</Button>
        <ExitButton />
      </StageBar>
    </div>
  );
}

function NoSignalFlow({ step }: { step: PlanStep }) {
  const { s, update } = useApp();
  const winLaptop = s.setup === 'laptop' && !isMac();
  // Windows laptops switch to Extend first; everyone else starts at "unplug".
  const stage = !winLaptop && s.nosignalStage === 0 ? 1 : s.nosignalStage;
  const sw = useStopwatch(stage === 2);
  const watched = useRef(0);
  watched.current = Math.max(watched.current, sw.elapsed);
  useRecordView(step.key, 0, () => watched.current);
  const remaining = Math.max(0, 30 - Math.floor(sw.elapsed / 1000));
  useEffect(() => void exitFullscreen(), []);

  return (
    <Shell>
      <div className="text-sky-300 font-semibold uppercase tracking-wide mb-1">{GROUP_LABEL('lines', s.purpose)}</div>
      <H1>{step.def.title}</H1>
      <WarmupLine run={step.run} />
      {stage === 0 && (
        <>
          <Card className="mb-6 text-xl space-y-3">
            <p><b>First, switch to Extend.</b> Press <b>Win+P</b> and choose <b>Extend</b>.</p>
            <p className="text-lg text-slate-300">This stops Windows getting confused when you unplug the cable. When you unplug, this page may jump to the laptop screen. That is fine.</p>
          </Card>
          <Button big className="w-full" onClick={() => update({ nosignalStage: 1 })}>Done, I chose Extend</Button>
        </>
      )}
      {stage === 1 && (
        <>
          <Card className="mb-6 text-xl space-y-3">
            <p><b>Unplug the video cable</b> from the monitor. Leave the monitor{'’'}s power on.</p>
            <p className="text-lg text-slate-300">
              {winLaptop
                ? 'Then look at the MONITOR, not the laptop. After a few seconds it shows its own "No signal" message.'
                : 'This page will disappear from the monitor. That is expected. After a few seconds the monitor shows its own "No signal" message. Wait about 30 seconds, then plug the cable back in.'}
            </p>
          </Card>
          <Button big className="w-full" onClick={() => update({ nosignalStage: 2, unpluggedAt: Date.now() })}>I am unplugging it now</Button>
        </>
      )}
      {stage === 2 && (
        <>
          <Card className="mb-6 text-xl space-y-3">
            <p className="text-5xl font-bold text-center tabular-nums" aria-live="polite">{remaining}s</p>
            <p>Look at the <b>MONITOR</b>. Watch its "No signal" message for the full 30 seconds.</p>
            <p>Are there any lines on it? Remember what you see.</p>
          </Card>
          {sw.interrupted && (
            <Card className="mb-4 border-amber-400">
              <p className="text-lg mb-3">The timer paused because this page was hidden. That can happen when the cable is unplugged.</p>
              <Button onClick={sw.resume}>Carry on with the timer</Button>
            </Card>
          )}
          <Button big className="w-full" disabled={remaining > 0} onClick={() => update({ nosignalStage: 3 })}>I have plugged it back in</Button>
          {remaining > 0 && (
            <button className="mt-3 underline text-slate-400" onClick={() => update({ nosignalStage: 3 })}>Skip the wait (you will not be able to choose PASSED)</button>
          )}
        </>
      )}
      {stage === 3 && (
        <>
          <Card className="mb-6 text-xl space-y-3">
            {winLaptop ? (
              <p>Good. Now press <b>Win+P</b> and choose <b>Second screen only</b> again.</p>
            ) : (
              <p>Good. Wait for the picture to come back on the monitor.</p>
            )}
            <p className="text-lg text-slate-300">Make sure this page is back on the monitor. A quick set-up check confirms everything is right again.</p>
          </Card>
          <Button big className="w-full" onClick={() => update({ screen: 'display', displayReturn: true })}>Run the set-up check again</Button>
        </>
      )}
      <div className="flex gap-3 mt-6">
        {stage > (winLaptop ? 0 : 1) && <Button variant="ghost" onClick={() => update({ nosignalStage: stage - 1 })}>Back</Button>}
        <Button variant="ghost" onClick={() => update({ phase: 'briefing', nosignalStage: 0 })}>Back to the instructions</Button>
      </div>
    </Shell>
  );
}

function AnswerScreen({ step, onAnswer }: { step: PlanStep; onAnswer: (st: Status, sev: Severity | null, note: string, photo: string) => void }) {
  const { s, update } = useApp();
  const existing = s.answers[step.key];
  const [note, setNote] = useState(existing?.note ?? '');
  const [photo, setPhoto] = useState(existing?.photo ?? '');
  const [askSeverity, setAskSeverity] = useState(false);
  const flags = step.def.id === 'B' ? s.flags.filter((f) => f.run === (step.run ?? 1)) : [];
  const canRepeat = step.def.kind !== 'question';
  const progress = viewProgress(step.def, s.views[step.key]);

  if (askSeverity) {
    return (
      <Shell>
        <div className="text-sky-300 font-semibold uppercase tracking-wide mb-1">{step.def.title}</div>
        <H1>How serious is it?</H1>
        <ul className="list-disc pl-6 space-y-1 text-lg mb-6">
          {step.def.problem.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <div className="grid gap-4 mb-6">
          <Button big variant="unsure" onClick={() => onAnswer('problem', 'minor', note, photo)} data-testid="severity-minor">
            Small problem <span className="block text-base font-normal">Easy to miss in normal use, e.g. 1 or 2 dots near the edge, or faint glow only in a dark room</span>
          </Button>
          <Button big variant="problem" onClick={() => onAnswer('problem', 'serious', note, photo)} data-testid="severity-serious">
            Serious problem <span className="block text-base font-normal">Noticeable in normal use, e.g. lines, several dots, patches or the fault is still there</span>
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setAskSeverity(false)}>Back</Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-sky-300 font-semibold uppercase tracking-wide mb-1">{step.def.title}</div>
      <H1>{questionFor(step.def, s.purpose)}</H1>
      {existing && <p className="text-slate-400 mb-4">Earlier answer: {STATUS_LABEL[existing.status]}. Choose again to change it.</p>}
      {flags.length > 0 && (
        <Card className="mb-4 border-amber-400">
          You flagged {flags.length} line{flags.length === 1 ? '' : 's'} during the colour cycle
          {flags.some((f) => f.samePlace === 'yes') ? ', and at least one stayed in the same place when the colour changed (a strong sign of a fault in the screen)' : ''}.
        </Card>
      )}
      {step.def.id === 'motion' && s.motion && (
        <Card className="mb-4 border-sky-500" >
          <p className="text-lg" data-testid="motion-stats">{motionAdvice(s.motion)}</p>
        </Card>
      )}
      <NormalVsProblem def={step.def} />
      <div className="grid gap-4 mb-4" role="group" aria-label="Your answer">
        <Button big variant="pass" disabled={!progress.ok} onClick={() => onAnswer('passed', null, note, photo)} data-testid="answer-passed">
          PASSED <span className="block text-base font-normal">I looked carefully and it looked normal</span>
        </Button>
        {!progress.ok && (
          <p className="text-amber-200 text-lg" data-testid="pass-locked">
            {progress.reason}{' '}
            {canRepeat && <button className="underline" onClick={() => update({ phase: 'briefing', subStep: 0, nosignalStage: 0 })}>Show me the check</button>}
          </p>
        )}
        <Button big variant="problem" onClick={() => setAskSeverity(true)} data-testid="answer-problem">
          PROBLEM FOUND <span className="block text-base font-normal">I saw a problem</span>
        </Button>
        <Button big variant="unsure" onClick={() => onAnswer('notsure', null, note, photo)} data-testid="answer-notsure">
          NOT SURE <span className="block text-base font-normal">I could not tell</span>
        </Button>
      </div>
      <details className="mb-6" open={!!(note || photo)}>
        <summary className="cursor-pointer text-lg text-slate-300">Add a note or photo name (optional)</summary>
        <div className="mt-3 space-y-4">
          <label className="block">
            <span className="block mb-1">Note, e.g. where on the screen</span>
            <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          </label>
          <label className="block">
            <span className="block mb-1">Took a phone photo of anything odd? Note the file name here.</span>
            <input className={inputClass} value={photo} onChange={(e) => setPhoto(e.target.value)} maxLength={300} placeholder="e.g. IMG_2041.jpg" />
            <span className="block text-sm text-slate-400 mt-1">Photos are not uploaded or stored. A phone camera can create fake wavy lines (moir{'é'}), so judge with your own eyes first.</span>
          </label>
        </div>
      </details>
      <div className="flex flex-wrap gap-3">
        {canRepeat && <Button variant="ghost" onClick={() => update({ phase: 'briefing', subStep: 0, nosignalStage: 0 })}>Look at it again</Button>}
        <Button variant="ghost" onClick={() => onAnswer('skipped', null, note, photo)}>Skip this check</Button>
        <Button variant="ghost" onClick={() => update({ screen: 'home' })}>Home</Button>
      </div>
    </Shell>
  );
}
