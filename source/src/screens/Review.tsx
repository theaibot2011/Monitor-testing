import { Shell } from '../components/Shell';
import { Button, H1 } from '../components/ui';
import { useApp } from '../state';
import { buildPlan } from '../lib/catalogue';
import { answerText } from '../lib/summary';

const STATUS_CLASS: Record<string, string> = {
  passed: 'text-emerald-300',
  problem: 'text-rose-300',
  notsure: 'text-amber-300',
  skipped: 'text-slate-400',
};

export default function Review() {
  const { s, update } = useApp();
  const plan = buildPlan(s.purpose, s.runs);
  return (
    <Shell>
      <H1>Review all answers</H1>
      <p className="text-lg text-slate-300 mb-6">Press "Do again" on any check to look at it again and change the answer. Nothing else is lost.</p>
      <ul className="space-y-2 mb-8">
        {plan.map((p, i) => {
          const a = s.answers[p.key];
          return (
            <li key={p.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-800/70 border border-slate-700 px-4 py-3">
              <span className="text-lg">
                {p.run && s.purpose === 'repair' ? <span className="text-slate-400">Run {p.run}: </span> : null}
                {p.def.title}
                {!p.def.mandatory && <span className="text-slate-400"> (optional)</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className={`font-semibold ${a ? STATUS_CLASS[a.status] : 'text-slate-500'}`}>{a ? answerText(a) : 'Not answered'}</span>
                <Button
                  variant="ghost"
                  onClick={() => update({ screen: 'test', stepIndex: i, phase: 'briefing', subStep: 0, nosignalStage: 0, redo: true })}
                >
                  {a ? 'Do again' : 'Do it now'}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button big className="flex-1" onClick={() => update({ screen: 'report' })}>See the report</Button>
        <Button big variant="ghost" onClick={() => update({ screen: 'home' })}>Home</Button>
      </div>
    </Shell>
  );
}
