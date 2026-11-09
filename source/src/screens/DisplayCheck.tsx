import { useEffect, useRef, useState } from 'react';
import { Shell } from '../components/Shell';
import { Button, Card, H1 } from '../components/ui';
import { useApp } from '../state';
import { deviceSize } from '../lib/draw';
import { zoomKeys } from '../lib/platform';
import { refreshWarning } from '../lib/flow';
import type { DisplayCheck } from '../lib/session';

interface Measure {
  cssW: number;
  cssH: number;
  dpr: number;
  canvasW: number;
  canvasH: number;
  rectW: number;
  rectH: number;
  screenW: number;
  screenH: number;
  extended: boolean | null;
}

function measure(probe: HTMLCanvasElement | null): Measure {
  const dpr = window.devicePixelRatio || 1;
  let rectW = window.innerWidth;
  let rectH = window.innerHeight;
  if (probe) {
    const r = probe.getBoundingClientRect();
    rectW = r.width || rectW;
    rectH = r.height || rectH;
  }
  const { w, h } = deviceSize(rectW, rectH, dpr);
  if (probe) {
    probe.width = w;
    probe.height = h;
  }
  const scr = window.screen as Screen & { isExtended?: boolean };
  return {
    cssW: window.innerWidth,
    cssH: window.innerHeight,
    dpr,
    canvasW: w,
    canvasH: h,
    rectW,
    rectH,
    screenW: Math.round(scr.width * dpr),
    screenH: Math.round(scr.height * dpr),
    extended: typeof scr.isExtended === 'boolean' ? scr.isExtended : null,
  };
}

export function displayWarnings(m: Measure): string[] {
  const w: string[] = [];
  if (Math.abs(m.dpr - Math.round(m.dpr)) > 0.001) {
    w.push(`Scaling is ${Math.round(m.dpr * 100)}%. This is normal on many laptops and the tests still work. If fine 1-pixel patterns look wavy, set the browser zoom to 100% (${zoomKeys()}).`);
  }
  if (Math.abs(m.rectW * m.dpr - m.canvasW) > 1 || Math.abs(m.rectH * m.dpr - m.canvasH) > 1) {
    w.push(`The test picture does not line up exactly with the screen\u2019s pixels. Fine 1-pixel patterns may show false waves. Set the zoom to 100% (${zoomKeys()}).`);
  }
  if (m.extended === true) {
    w.push('More than one screen is switched on. Make sure this page is on the monitor being tested, and look only at that screen.');
  }
  return w;
}

export default function DisplayCheckScreen() {
  const { s, update } = useApp();
  const probe = useRef<HTMLCanvasElement>(null);
  const [m, setM] = useState<Measure | null>(null);
  const [hz, setHz] = useState<number | null>(null);
  const [measured, setMeasured] = useState(false);
  // Never wait forever: some browsers slow animation frames down.
  useEffect(() => {
    const t = window.setTimeout(() => setMeasured(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const run = () => setM(measure(probe.current));
    run();
    window.addEventListener('resize', run);
    const mq = window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq?.addEventListener?.('change', run);
    return () => {
      window.removeEventListener('resize', run);
      mq?.removeEventListener?.('change', run);
    };
  }, []);

  // Estimate the refresh rate from frame timestamps over about one second.
  useEffect(() => {
    let raf = 0;
    const times: number[] = [];
    const tick = (t: number) => {
      times.push(t);
      if (t - times[0] < 1000) raf = requestAnimationFrame(tick);
      else {
        const gaps = times.slice(1).map((v, i) => v - times[i]).sort((a, b) => a - b);
        const median = gaps[Math.floor(gaps.length / 2)];
        if (median > 0) setHz(Math.round(1000 / median));
        setMeasured(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const warnings = m ? displayWarnings(m) : [];
  const hzWarning = refreshWarning(s.details.advertisedHz, hz);

  const confirm = () => {
    if (!m) return;
    const dc: DisplayCheck = {
      at: Date.now(),
      viewport: `${m.cssW}×${m.cssH} (${m.canvasW}×${m.canvasH} pixels)`,
      dpr: Math.round(m.dpr * 1000) / 1000,
      canvas: `${m.canvasW}×${m.canvasH}`,
      screen: `${m.screenW}×${m.screenH}`,
      refreshEstimate: hz,
      warnings: hzWarning ? [...warnings, hzWarning] : warnings,
    };
    if (s.displayReturn) update({ displayCheck: dc, displayReturn: false, screen: 'test', phase: 'answer' });
    else update({ displayCheck: dc, screen: 'test' });
  };

  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-700 last:border-0">
      <span className="text-slate-300">{k}</span>
      <span className="font-mono text-right">{v}</span>
    </div>
  );

  return (
    <Shell>
      {/* Invisible probe canvas sized exactly like the test patterns. */}
      <canvas ref={probe} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', opacity: 0, pointerEvents: 'none' }} />
      <H1>Screen set-up check</H1>
      {s.displayReturn && (
        <Card className="mb-6 border-sky-500">
          <p className="text-lg">Welcome back. Make sure the picture is back and this page is on the monitor being tested{s.setup === 'laptop' ? ' (on Windows: Win+P → "Second screen only")' : ''}.</p>
        </Card>
      )}
      <p className="text-xl mb-4">Look at the <b>repaired monitor</b>. Can you see this page on it?</p>
      <Card className="mb-6">
        {m ? (
          <>
            {row('Page size', `${m.cssW} × ${m.cssH}`)}
            {row('Pixels drawn', `${m.canvasW} × ${m.canvasH}`)}
            {row('Screen (whole)', `${m.screenW} × ${m.screenH}`)}
            {row('Scaling', `${Math.round(m.dpr * 100)}%`)}
            {row('Refresh rate (updates per second)', hz ? `about ${hz} Hz${s.details.advertisedHz ? ` (advertised ${s.details.advertisedHz} Hz)` : ''}` : 'measuring…')}
          </>
        ) : (
          <p>Measuring…</p>
        )}
        <p className="text-sm text-slate-400 mt-3">"Pixels drawn" should match the monitor’s resolution (for example 1920 × 1080) when full screen. The refresh rate is measured by the browser and can read a little low on a busy computer.</p>
      </Card>
      {warnings.length > 0 || hzWarning ? (
        <div className="space-y-3 mb-6" role="alert">
          {[...warnings, ...(hzWarning ? [hzWarning] : [])].map((w) => (
            <Card key={w} className="border-amber-400 bg-amber-950/40 text-amber-100 text-lg">{w}</Card>
          ))}
        </div>
      ) : (
        m && <p className="text-emerald-300 text-lg mb-6">{'✓'} Everything looks right for exact testing.</p>
      )}
      <div className="flex flex-col gap-3">
        <Button big onClick={confirm} disabled={!m || !measured}>{measured ? 'Yes, this page is on the monitor' : 'Measuring the screen…'}</Button>
        <Button big variant="ghost" onClick={() => update({ screen: s.displayReturn ? 'test' : 'details', displayReturn: false })}>Back</Button>
      </div>
    </Shell>
  );
}
