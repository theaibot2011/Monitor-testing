import { useState } from 'react';
import { Shell } from '../components/Shell';
import { Button, Card, inputClass } from '../components/ui';
import { useApp } from '../state';
import { APP_VERSION, buildPlan, GROUP_LABEL, PURPOSE_TEXT, type PlanStep } from '../lib/catalogue';
import { computeOutcome, notChecked, OUTCOME_RULES, OUTCOME_TEXT } from '../lib/outcome';
import { HINT_DISCLAIMER, isolationHints, noSignalLinesFrom } from '../lib/isolation';
import { answerText, buildSummary, runWarmup, SELF_REPORTED, testedRange } from '../lib/summary';
import { exportFilename, exportResults } from '../lib/exportfile';
import { downloadText, useNow } from '../lib/hooks';
import { addRunPatch, refreshWarning, shouldOfferRepeat } from '../lib/flow';
import { viewProgress } from '../lib/views';
import { fmtDateTime } from '../lib/format';
import { downloadReportCard } from '../lib/reportImage';
import { newId, warmupMinutes, type Combo, type Session } from '../lib/session';

const statusClass = (s: Session, key: string) => {
  const a = s.answers[key];
  if (!a) return 'text-slate-400';
  if (a.status === 'problem') return a.severity === 'minor' ? 'text-amber-300 font-bold' : 'text-rose-300 font-bold';
  return { passed: 'text-emerald-300', notsure: 'text-amber-300', skipped: 'text-slate-400' }[a.status];
};

const OUTCOME_CLASS = {
  serious: 'bg-rose-950 border-rose-500',
  unfinished: 'bg-amber-950 border-amber-400',
  minor: 'bg-sky-950 border-sky-400',
  passed: 'bg-emerald-950 border-emerald-500',
};

function StepTable({ steps, session }: { steps: PlanStep[]; session: Session }) {
  return (
    <table className="w-full text-left mb-2">
      <thead>
        <tr className="border-b border-slate-600 text-slate-400">
          <th className="py-2 pr-3 font-medium">Check</th>
          <th className="py-2 pr-3 font-medium">Result</th>
          <th className="py-2 pr-3 font-medium">Time on screen</th>
          <th className="py-2 font-medium">Notes</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((st) => {
          const a = session.answers[st.key];
          const vp = viewProgress(st.def, session.views[st.key]);
          return (
            <tr key={st.key} className="border-b border-slate-700 align-top">
              <td className="py-2 pr-3">
                {st.def.title}
                {!st.def.mandatory && <span className="text-slate-400"> (optional)</span>}
              </td>
              <td className={`py-2 pr-3 ${statusClass(session, st.key)}`}>{answerText(a).replace(/^not answered$/, 'Not answered')}</td>
              <td className="py-2 pr-3 whitespace-nowrap text-slate-300">{vp.seconds === null ? '—' : `${vp.seconds} s`}</td>
              <td className="py-2 break-words">
                {st.def.id === 'motion' && session.motion && <span className="block text-slate-400">{session.motion.fps} pictures per second, {session.motion.latePct}% late</span>}
                {a?.note}
                {a?.photo && <span className="block text-slate-400">Photo: {a.photo}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CombosEditor({ session, readOnly }: { session: Session; readOnly: boolean }) {
  const app = useApp();
  const [draft, setDraft] = useState<Omit<Combo, 'id'>>({ cable: 'DP', port: '', refresh: '', lines: 'no' });
  const add = () => {
    app.update((prev) => ({ combos: [...prev.combos, { ...draft, id: newId() }] }));
    setDraft((d) => ({ ...d, port: '', refresh: '' }));
  };
  const remove = (id: string) => app.update((prev) => ({ combos: prev.combos.filter((c) => c.id !== id) }));
  return (
    <>
      {session.combos.length > 0 ? (
        <table className="w-full text-left mb-4">
          <thead>
            <tr className="border-b border-slate-600 text-slate-400">
              <th className="py-2 pr-3 font-medium">Cable</th>
              <th className="py-2 pr-3 font-medium">Computer socket</th>
              <th className="py-2 pr-3 font-medium">Refresh rate</th>
              <th className="py-2 pr-3 font-medium">Lines seen?</th>
              {!readOnly && <th className="no-print" />}
            </tr>
          </thead>
          <tbody>
            {session.combos.map((c) => (
              <tr key={c.id} className="border-b border-slate-700">
                <td className="py-2 pr-3">{c.cable === 'DP' ? 'DisplayPort' : c.cable}</td>
                <td className="py-2 pr-3 break-words">{c.port || '—'}</td>
                <td className="py-2 pr-3">{c.refresh ? `${c.refresh} Hz` : '—'}</td>
                <td className={`py-2 pr-3 ${c.lines === 'yes' ? 'text-rose-300 font-bold' : ''}`}>{c.lines === 'yes' ? 'Yes' : c.lines === 'no' ? 'No' : 'Not sure'}</td>
                {!readOnly && (
                  <td className="no-print text-right">
                    <button className="underline text-slate-400" onClick={() => remove(c.id)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-slate-400 mb-4">No combinations recorded yet.</p>
      )}
      {!readOnly && (
        <div className="no-print grid sm:grid-cols-5 gap-2 items-end">
          <label>
            <span className="block text-sm mb-1">Cable</span>
            <select className={inputClass} value={draft.cable} onChange={(e) => setDraft({ ...draft, cable: e.target.value as Combo['cable'] })}>
              <option value="DP">DisplayPort</option>
              <option value="HDMI">HDMI</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span className="block text-sm mb-1">Computer socket</span>
            <input className={inputClass} placeholder="e.g. left USB-C" value={draft.port} maxLength={100} onChange={(e) => setDraft({ ...draft, port: e.target.value })} />
          </label>
          <label>
            <span className="block text-sm mb-1">Refresh rate (Hz)</span>
            <input className={inputClass} placeholder="165" inputMode="numeric" value={draft.refresh} maxLength={20} onChange={(e) => setDraft({ ...draft, refresh: e.target.value })} />
          </label>
          <label>
            <span className="block text-sm mb-1">Lines seen?</span>
            <select className={inputClass} value={draft.lines} onChange={(e) => setDraft({ ...draft, lines: e.target.value as Combo['lines'] })}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
              <option value="notsure">Not sure</option>
            </select>
          </label>
          <Button variant="secondary" onClick={add}>Add row</Button>
        </div>
      )}
    </>
  );
}

export default function Report({ session, readOnly = false, onClose }: { session: Session; readOnly?: boolean; onClose?: () => void }) {
  const app = useApp();
  const now = useNow(30000);
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const [showSummary, setShowSummary] = useState(false);
  const res = computeOutcome(session);
  const plan = buildPlan(session.purpose, session.runs);
  const site = typeof location !== 'undefined' ? location.host : 'monitortesting.netlify.app';
  const summary = buildSummary(session, site);
  const repair = session.purpose === 'repair';
  const hints = repair ? isolationHints(session.combos, noSignalLinesFrom(session)) : [];
  const missing = notChecked(session);
  const d = session.details;
  const o = OUTCOME_TEXT[res.outcome];
  const hzWarning = refreshWarning(d.advertisedHz, session.displayCheck?.refreshEstimate ?? null);
  const runs = repair ? session.runs : 1;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied('yes');
      setTimeout(() => setCopied('no'), 2500);
    } catch {
      setCopied('failed');
      setShowSummary(true);
    }
  };

  return (
    <Shell wide>
      <div className="print-plain">
        {readOnly && (
          <Card className="no-print mb-6 border-sky-500">
            <p className="text-lg mb-3">You are viewing a saved results file. It is read-only.</p>
            <Button variant="secondary" onClick={onClose}>Close and go home</Button>
          </Card>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold mb-1">Monitor check report</h1>
        <p className="text-lg text-slate-300">{PURPOSE_TEXT[session.purpose].title}</p>
        <p className="text-slate-300 mb-6" data-testid="tested-range">Tested: {testedRange(session)}</p>

        <section className={`avoid-break rounded-2xl border-2 p-5 mb-8 ${OUTCOME_CLASS[res.outcome]}`} data-testid="overall">
          <div className="text-sm uppercase tracking-wide text-slate-300">Overall result</div>
          <div className="text-3xl font-bold my-1">{o.title}</div>
          <p className="text-lg mb-2">{o.plain}</p>
          {[...res.serious, ...res.unfinished, ...res.minor].length > 0 && (
            <ul className="list-disc pl-6 space-y-1" data-testid="overall-reasons">
              {[...res.serious, ...res.unfinished.slice(0, 3), ...res.minor].map((r) => <li key={r}>{r}</li>)}
              {res.unfinished.length > 3 && <li>and {res.unfinished.length - 3} more not finished (listed under "Not checked" below)</li>}
            </ul>
          )}
          {repair && res.faultRuns.length > 0 && !res.faultRuns.includes(1) && (
            <p className="mt-2 font-semibold">The original fault did not show in run 1 but did show in run {res.faultRuns.join(', ')}, after warm-up.</p>
          )}
          <details className="mt-3 text-sm text-slate-300">
            <summary className="cursor-pointer no-print">How this result is decided</summary>
            <ul className="list-disc pl-6 mt-1">
              {OUTCOME_RULES.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </details>
        </section>

        {!readOnly && shouldOfferRepeat(session, now) && (
          <Card className="no-print mb-8 border-sky-500">
            <p className="text-lg mb-3">The monitor has been on for {warmupMinutes(session, now)} minutes. Repeating the fault check now can catch faults that only appear when warm.</p>
            <Button onClick={() => app.update(addRunPatch(session))}>Repeat the fault check (run {session.runs + 1})</Button>
          </Card>
        )}

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">Monitor</h2>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-lg">
            <div><dt className="inline text-slate-400">Model: </dt><dd className="inline">{d.model || 'Not given'}</dd></div>
            <div><dt className="inline text-slate-400">Serial: </dt><dd className="inline">{d.serial || 'Not given'}</dd></div>
            <div><dt className="inline text-slate-400">Tested by: </dt><dd className="inline">{d.operator || 'Not given'}</dd></div>
            {d.jobRef && <div><dt className="inline text-slate-400">{repair ? 'Job: ' : 'Reference: '}</dt><dd className="inline">{d.jobRef}</dd></div>}
            {repair && <div><dt className="inline text-slate-400">Switched on at: </dt><dd className="inline">{fmtDateTime(d.monitorOnAt)}</dd></div>}
            {session.displayCheck && (
              <div>
                <dt className="inline text-slate-400">Refresh rate: </dt>
                <dd className="inline">
                  {session.displayCheck.refreshEstimate ? `about ${session.displayCheck.refreshEstimate} Hz` : 'not measured'}
                  {d.advertisedHz ? ` (advertised ${d.advertisedHz} Hz)` : ''}
                </dd>
              </div>
            )}
          </dl>
          {hzWarning && <p className="text-amber-200 mt-2">{hzWarning}</p>}
        </section>

        {missing.length > 0 && (
          <section className="mb-8 avoid-break" data-testid="not-checked">
            <h2 className="text-2xl font-semibold mb-2">Not checked</h2>
            <ul className="list-disc pl-6 text-amber-200">
              {missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </section>
        )}

        {Array.from({ length: runs }, (_, i) => i + 1).map((run) => {
          const w = repair ? runWarmup(session, run) : null;
          const flags = session.flags.filter((f) => f.run === run);
          return (
            <section key={run} className="mb-8">
              <h2 className="text-2xl font-semibold mb-3">
                {GROUP_LABEL('lines', session.purpose)}
                {repair && `, run ${run}`}
                {w !== null && <span className="text-slate-400 font-normal"> (monitor on for {w} min)</span>}
              </h2>
              <StepTable steps={plan.filter((p) => p.run === run)} session={session} />
              {flags.length > 0 && (
                <div className="mt-3">
                  <div className="font-semibold">Lines flagged in the colour cycle: {flags.length}</div>
                  <ul className="list-disc pl-6">
                    {flags.map((f, i) => (
                      <li key={i}>
                        On {f.colour}. Stayed in the same place when the colour changed: {f.samePlace === 'yes' ? 'Yes (a strong sign of a fault in the screen)' : f.samePlace === 'no' ? 'No' : 'Not sure'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}

        {(['main', 'physical'] as const).map((g) => (
          <section key={g} className="mb-8">
            <h2 className="text-2xl font-semibold mb-3">{GROUP_LABEL(g, session.purpose)}</h2>
            <StepTable steps={plan.filter((p) => p.def.group === g)} session={session} />
          </section>
        ))}

        {repair && (
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-1">Finding the cause: combinations tried</h2>
            <p className="text-slate-300 mb-3">Optional. Add a row for each cable, computer socket and refresh rate you tried, and whether the lines showed.</p>
            <CombosEditor session={session} readOnly={readOnly} />
            {hints.length > 0 && (
              <div className="avoid-break mt-4 rounded-xl border border-slate-600 p-4">
                <div className="font-semibold mb-1">Hints</div>
                <p className="text-amber-200 mb-2">{HINT_DISCLAIMER}</p>
                <ul className="list-disc pl-6 space-y-1">
                  {hints.map((h) => <li key={h}>{h}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        {session.displayCheck && (
          <section className="mb-8 avoid-break">
            <h2 className="text-2xl font-semibold mb-3">Screen set-up</h2>
            <p className="text-lg">
              {session.displayCheck.viewport}, scaling {Math.round(session.displayCheck.dpr * 100)}%. Checked at {fmtDateTime(session.displayCheck.at)}.
            </p>
            {session.displayCheck.warnings.length > 0 && (
              <ul className="list-disc pl-6 text-amber-200 mt-2">
                {session.displayCheck.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
          </section>
        )}

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">Evidence notes</h2>
          {readOnly ? (
            <p className="whitespace-pre-wrap break-words">{session.evidence || 'None.'}</p>
          ) : (
            <>
              <label className="block no-print">
                <span className="block mb-1">Took phone photos of anything odd? Note the file names here.</span>
                <textarea className={inputClass} rows={3} maxLength={5000} value={session.evidence} onChange={(e) => app.update({ evidence: e.target.value })} />
              </label>
              <p className="hidden print:block whitespace-pre-wrap">{session.evidence || 'None.'}</p>
              <p className="text-sm text-slate-400 mt-1 no-print">Photos are not uploaded or stored. A phone camera can create fake wavy lines (moir{'é'}), so judge with your own eyes first.</p>
            </>
          )}
        </section>

        <section className="no-print mb-8">
          <h2 className="text-2xl font-semibold mb-3">Save or share</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Button big onClick={() => window.print()}>Print or save as PDF</Button>
            <Button big variant="secondary" onClick={() => downloadReportCard(session, site, exportFilename(session).replace(/\.json$/, '.png'))} data-testid="save-png">Save report as a picture</Button>
            <Button big variant="secondary" onClick={() => downloadText(exportFilename(session), exportResults(session))} data-testid="save-json">Save results file</Button>
            <Button big variant="secondary" onClick={copy}>{copied === 'yes' ? 'Copied ✓' : 'Copy summary text'}</Button>
            <a
              className="ui-anim rounded-xl font-semibold px-6 py-5 text-xl text-center bg-emerald-700 hover:bg-emerald-800 text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
              href={`https://wa.me/?text=${encodeURIComponent(summary)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Send summary on WhatsApp
            </a>
          </div>
          {copied === 'failed' && <p className="text-amber-200 mt-2" role="alert">Couldn{'’'}t copy automatically. Select the text below and copy it instead.</p>}
          <p className="text-slate-400 mt-2">"Save report as a picture" makes one image you can send in any chat or marketplace message. "Print or save as PDF" makes a tidy document. The results file holds every detail; anyone can open it with "Open a results file someone sent you" on this site.</p>
          <details className="mt-4" open={showSummary} onToggle={(e) => setShowSummary((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-slate-300">Show the summary text</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words bg-slate-900 rounded-lg p-3 text-sm select-all" data-testid="summary-text">{summary}</pre>
          </details>
        </section>

        <footer className="text-sm text-slate-400 border-t border-slate-700 pt-4 mb-8">
          <p>{SELF_REPORTED}</p>
          <p>Made with MonitorTest {APP_VERSION} at {site}. Report last changed {fmtDateTime(session.updatedAt)}.</p>
        </footer>

        {!readOnly && (
          <div className="no-print flex flex-col sm:flex-row gap-3">
            <Button big variant="secondary" className="flex-1" onClick={() => app.update({ screen: 'review' })}>Review or redo answers</Button>
            <Button big variant="ghost" className="flex-1" onClick={() => app.update({ screen: 'home' })}>Home</Button>
          </div>
        )}
      </div>
    </Shell>
  );
}
