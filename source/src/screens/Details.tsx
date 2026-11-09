import { Shell } from '../components/Shell';
import { Button, Field, H1, inputClass } from '../components/ui';
import { useApp } from '../state';
import { useNow } from '../lib/hooks';
import type { Details as D } from '../lib/session';

const toHHMM = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Turn "HH:MM" into a timestamp today, or yesterday if that would be in the future. */
export function fromHHMM(v: string, now = Date.now()): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() > now + 60000) d.setDate(d.getDate() - 1);
  return d.getTime();
}

const REF_LABEL = {
  buying: ['Seller or listing', 'e.g. the seller’s name or the advert link'],
  selling: ['Listing or buyer', 'e.g. where you are selling it'],
  repair: ['Repair job or reference', 'e.g. the repair shop’s job number'],
  own: ['Note', 'anything you want on the report'],
} as const;

export default function Details() {
  const { s, update } = useApp();
  const now = useNow(15000);
  const d = s.details;
  const set = (patch: Partial<D>) => update((prev) => ({ details: { ...prev.details, ...patch } }));
  const mins = Math.max(0, Math.floor((now - d.monitorOnAt) / 60000));
  const [refLabel, refHint] = REF_LABEL[s.purpose];

  return (
    <Shell>
      <H1>About this monitor</H1>
      <p className="text-lg text-slate-300 mb-6">About 1 minute. These go on the report. All are optional, but the model and serial number make the report much more useful.</p>
      <Field label="Your name">
        <input className={inputClass} value={d.operator} maxLength={100} onChange={(e) => set({ operator: e.target.value })} autoComplete="name" />
      </Field>
      <Field label="Monitor make and model" hint="On a sticker on the back, e.g. 'AOC 24G2'">
        <input className={inputClass} value={d.model} maxLength={100} onChange={(e) => set({ model: e.target.value })} />
      </Field>
      <Field label="Serial number" hint="On the same sticker, often marked S/N">
        <input className={inputClass} value={d.serial} maxLength={100} onChange={(e) => set({ serial: e.target.value })} />
      </Field>
      <Field label="Advertised refresh rate (optional)" hint="How many times a second the picture updates, shown as Hz on the box or listing, e.g. 60, 144 or 165. The app checks the monitor is really running at it. Leave blank if you don't know.">
        <input className={inputClass} inputMode="numeric" placeholder="e.g. 144" value={d.advertisedHz} maxLength={4} onChange={(e) => set({ advertisedHz: e.target.value.replace(/[^0-9]/g, '') })} />
      </Field>
      <Field label={`${refLabel} (optional)`} hint={refHint}>
        <input className={inputClass} value={d.jobRef} maxLength={100} onChange={(e) => set({ jobRef: e.target.value })} />
      </Field>
      {s.purpose === 'repair' && (
        <Field label="Monitor switched on at" hint={`That is ${mins} minute${mins === 1 ? '' : 's'} ago. Change it if the monitor was switched on earlier.`}>
          <input
            type="time"
            className={inputClass}
            value={toHHMM(d.monitorOnAt)}
            onChange={(e) => {
              const t = fromHHMM(e.target.value);
              if (t !== null) set({ monitorOnAt: t });
            }}
          />
        </Field>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Button big className="flex-1" onClick={() => update({ screen: 'display', displayReturn: false })}>Next: check the screen set-up</Button>
        <Button big variant="ghost" onClick={() => update({ screen: 'prep' })}>Back</Button>
      </div>
    </Shell>
  );
}
