import { useRef, useState } from 'react';
import { Shell } from '../components/Shell';
import { Button, Card, H1 } from '../components/ui';
import { useApp } from '../state';
import { INTRO_KEY, ARCHIVE_KEY, LEGACY_ARCHIVE_KEY, migrate, type Session } from '../lib/session';
import { exportFilename, exportResults, MAX_FILE_BYTES, parseResults } from '../lib/exportfile';
import { downloadText } from '../lib/hooks';
import { estimateMinutes, PURPOSE_TEXT, type Purpose } from '../lib/catalogue';
import { isTouchOnly } from '../lib/platform';
import { fmtDateTime } from '../lib/format';
import { radioKeys } from '../components/radio';

function readArchive(get: (k: string) => string | null): Session[] {
  const read = (key: string): Session[] => {
    try {
      const arr: unknown = JSON.parse(get(key) || '[]');
      return Array.isArray(arr) ? (arr.map(migrate).filter(Boolean) as Session[]) : [];
    } catch {
      return [];
    }
  };
  // Current checks first, then any kept by versions 1 and 2 (read-only).
  const seen = new Set<string>();
  return [...read(ARCHIVE_KEY), ...read(LEGACY_ARCHIVE_KEY)].filter((s) => !seen.has(s.id) && seen.add(s.id)).slice(0, 10);
}

const PURPOSES: Purpose[] = ['buying', 'selling', 'repair', 'own'];

export default function Home() {
  const { s, update, store, startOver, showImported, openSelfCheck } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const started = Object.keys(s.answers).length > 0 || s.displayCheck !== null;
  const archive = readArchive((k) => store.kv.getItem(k));
  const phone = isTouchOnly();

  const begin = () => {
    let seen = false;
    try {
      seen = store.kv.getItem(INTRO_KEY) === '1';
    } catch {
      seen = false;
    }
    const now = Date.now();
    update((prev) => ({ screen: seen ? 'prep' : 'before', startedAt: now, createdAt: now, details: { ...prev.details, monitorOnAt: now } }));
  };

  const resume = () => {
    const screen = s.screen === 'home' ? (s.displayCheck ? 'test' : 'details') : s.screen;
    update({ screen });
  };

  const onFile = async (file: File | undefined) => {
    setImportError(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setImportError('This file is too large to be a MonitorTest results file.');
    try {
      const res = parseResults(await file.text());
      if ('error' in res) setImportError(res.error);
      else showImported(res.session);
    } catch {
      setImportError('This file could not be opened.');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Shell>
      <H1>Check a monitor properly</H1>
      <p className="text-xl text-slate-300 mb-6">
        A free, detailed check you can do with your own eyes. It guides you one step at a time, in plain language, and gives you a report at the end. Nothing is ever marked as passed unless you looked and said so.
      </p>

      {phone && (
        <Card className="mb-6 border-amber-400 bg-amber-950/40">
          <p className="text-lg font-semibold mb-1">You are on a phone or tablet</p>
          <p className="text-lg">This checks the screen in your hand, not a monitor. To check a monitor, open <b>monitortesting.netlify.app</b> on the computer the monitor is plugged into.</p>
        </Card>
      )}

      {!started && (
        <>
          <h2 className="text-xl font-semibold mb-3">Why are you checking?</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-3" role="radiogroup" aria-label="Why are you checking?" onKeyDown={radioKeys(PURPOSES, s.purpose, (p) => update({ purpose: p }))}>
            {PURPOSES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                data-value={p}
                tabIndex={s.purpose === p ? 0 : -1}
                aria-checked={s.purpose === p}
                onClick={() => update({ purpose: p })}
                className={`text-left rounded-2xl border-2 p-5 ui-anim focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 ${
                  s.purpose === p ? 'border-sky-400 bg-sky-950/60' : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                }`}
              >
                <div className="text-xl font-bold">{PURPOSE_TEXT[p].title}</div>
                <div className="text-slate-300 mt-1">{PURPOSE_TEXT[p].text}</div>
              </button>
            ))}
          </div>
          <p className="text-slate-300 mb-6">The full check takes about {estimateMinutes(s.purpose)} minutes. Every check is included, because a short check can miss real problems.</p>
        </>
      )}

      <div className="flex flex-col gap-3 mt-2">
        {started ? (
          <>
            <Card className="mb-2">
              <p className="text-lg">Check in progress: <b>{PURPOSE_TEXT[s.purpose].title}</b>{s.details.model ? `, ${s.details.model}` : ''}.</p>
            </Card>
            <Button big onClick={resume}>Continue where you left off</Button>
            <Button big variant="secondary" onClick={() => update({ screen: 'review' })}>Review all answers</Button>
            <Button big variant="secondary" onClick={() => update({ screen: 'report' })}>See the report</Button>
          </>
        ) : (
          <Button big onClick={begin}>Start the check</Button>
        )}
        <Button big variant="ghost" onClick={() => fileRef.current?.click()}>Open a results file someone sent you</Button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid="import-input" />
        {importError && <p className="text-rose-300 text-lg" role="alert">{importError}</p>}
      </div>

      {started && (
        <Card className="mt-8">
          {!confirmReset ? (
            <Button big variant="danger" className="w-full" onClick={() => setConfirmReset(true)}>Start from the beginning</Button>
          ) : (
            <div>
              <p className="text-lg mb-4">Your current answers will be kept on this computer as a previous check, and you can download them below. Start a new check?</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => downloadText(exportFilename(s), exportResults(s))}>Save the current results file first</Button>
                <Button variant="danger" onClick={() => { setConfirmReset(false); startOver(); }}>Yes, start again</Button>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {archive.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Previous checks on this computer</h2>
          <ul className="space-y-2">
            {archive.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-300">{a.details.model || 'Monitor'}, {fmtDateTime(a.updatedAt)}</span>
                <span className="flex gap-2">
                  <Button variant="ghost" onClick={() => showImported(a)}>View</Button>
                  <Button variant="ghost" onClick={() => downloadText(exportFilename(a), exportResults(a))}>Download</Button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-10 text-slate-400 space-y-2">
        <p>Free. Nothing is uploaded: everything stays on this computer. Works offline after the first load.</p>
        <p>
          Want proof the app draws correctly?{' '}
          <button className="underline text-sky-300" onClick={openSelfCheck}>Run the self-check</button>
        </p>
      </div>
    </Shell>
  );
}
