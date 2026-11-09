import { useEffect, useState } from 'react';
import { Shell } from '../components/Shell';
import { Button, Card, H1 } from '../components/ui';
import { runSelfCheck, type CheckResult } from '../lib/selfcheck';

export default function SelfCheck({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const run = () => {
    setResults(null);
    // Let the "running" state paint first.
    setTimeout(() => setResults(runSelfCheck()), 50);
  };
  useEffect(run, []);
  const failed = results?.filter((r) => !r.pass) ?? [];
  const counted = results?.filter((r) => !r.info) ?? [];
  const groups = results ? [...new Set(results.map((r) => r.group))] : [];
  return (
    <Shell wide>
      <H1>Self-check: is the app drawing correctly?</H1>
      <p className="text-lg text-slate-300 mb-6">
        The app draws each test picture, then reads the pixels back and compares them with the exact values. This proves the app itself is not causing any lines. It cannot test the monitor itself; only your eyes can.
      </p>
      {!results ? (
        <p className="text-xl">Running…</p>
      ) : (
        <>
          <Card className={`mb-6 border-2 ${failed.length ? 'border-rose-500 bg-rose-950/50' : 'border-emerald-500 bg-emerald-950/50'}`}>
            <div className="text-3xl font-bold" data-testid="selfcheck-summary">
              {failed.length ? `${failed.length} of ${counted.length} checks FAILED` : `All ${counted.length} checks PASSED`}
            </div>
            <p className="text-lg mt-2">
              {failed.length
                ? 'This browser changed some of the pixels the app drew. Try the zoom at 100% (Ctrl+0, or Cmd+0 on a Mac) and switch off colour-changing browser extensions, then run the self-check again. Fine-line results may not be exact until it passes.'
                : 'The app draws every colour, line and fade exactly. Settings outside the browser can still change what reaches the monitor: Night Light or Night Shift, HDR, colour filters, graphics-card settings and some browser extensions. Switch those off for testing.'}
            </p>
          </Card>
          {groups.map((g) => (
            <section key={g} className="mb-6">
              <h2 className="text-xl font-semibold mb-2">{g}</h2>
              <table className="w-full text-left">
                <tbody>
                  {results
                    .filter((r) => r.group === g)
                    .map((r) => (
                      <tr key={r.name} className="border-b border-slate-700 align-top">
                        <td className={`py-2 pr-3 font-bold w-16 ${r.info ? 'text-sky-300' : r.pass ? 'text-emerald-300' : 'text-rose-300'}`}>{r.info ? 'NOTE' : r.pass ? 'PASS' : 'FAIL'}</td>
                        <td className="py-2 pr-3">{r.name}</td>
                        <td className="py-2 text-slate-400 break-words">{r.detail}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
          ))}
        </>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mt-6 no-print">
        <Button big variant="secondary" onClick={run}>Run again</Button>
        <Button big onClick={onClose}>Close</Button>
      </div>
    </Shell>
  );
}
