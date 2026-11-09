import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { OUTCOME_RULES } from '../lib/outcome';

type Variant = 'primary' | 'secondary' | 'pass' | 'problem' | 'unsure' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sky-500 hover:bg-sky-400 text-slate-950',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
  pass: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
  problem: 'bg-rose-700 hover:bg-rose-800 text-white',
  unsure: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
  ghost: 'bg-transparent hover:bg-slate-800 text-slate-200 border border-slate-600',
  danger: 'bg-transparent hover:bg-rose-950 text-rose-300 border border-rose-700',
};

export function Button({
  variant = 'primary',
  big = false,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`ui-anim rounded-xl font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 disabled:opacity-40 disabled:cursor-not-allowed ${
        big ? 'px-6 py-5 text-xl min-h-[64px]' : 'px-4 py-3 text-base'
      } ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-slate-800/80 border border-slate-700 p-5 ${className}`}>{children}</div>;
}

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="text-3xl sm:text-4xl font-bold mb-4">{children}</h1>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-lg font-medium mb-1">{label}</span>
      {children}
      {hint && <span className="block text-sm text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-3 text-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-400';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('button')?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary')].filter((el) => !el.hasAttribute('disabled'));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('keydown', k);
      opener?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-start justify-center p-4 overflow-y-auto no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div ref={box} className="ui-fade-in w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-600 p-6 my-8">
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="text-2xl font-bold">{title}</h2>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function HelpContent({ onSelfCheck }: { onSelfCheck?: () => void }) {
  return (
    <div className="space-y-5 text-lg leading-relaxed">
      <section>
        <h3 className="text-xl font-semibold mb-2">Leaving a test</h3>
        <p>Press <b>Esc</b> at any time to leave full screen. Your place is kept, and you can carry on with "Resume full screen". Move the mouse to see the buttons.</p>
      </section>
      <section>
        <h3 className="text-xl font-semibold text-amber-300 mb-2">Things that look like a fault but are not</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Dust, fingerprints or smudges. Wipe gently with a dry soft cloth and look again.</li>
          <li>Phone cameras create fake wavy lines and stripes (called moiré). Judge with your own eyes first.</li>
          <li>Browser zoom that is not 100%. Press Ctrl and 0 (Cmd and 0 on a Mac).</li>
          <li>Night Light (Windows), Night Shift (Mac), blue-light filters, HDR or "dynamic contrast" settings change colours. Switch them off while testing.</li>
          <li>A faint glow in the corners on black, which changes as you move your head, is normal for many monitors (called IPS glow).</li>
          <li>Fine 1-pixel patterns can shimmer slightly when you move your head. That is normal.</li>
          <li>A very faint staircase in the colour fades is normal on most monitors.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-xl font-semibold text-sky-300 mb-2">Things that can hide a real fault</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Bright room light hides faint lines and light leaks. Turn the lights down for the dark tests.</li>
          <li>Looking only at the centre. Check the edges and corners too.</li>
          <li>Testing the wrong screen: make sure this page is on the monitor being tested.</li>
          <li>Some faults only show after the monitor has been on for 30 minutes or more.</li>
          <li>Looking straight on only. Also look from a little to the side and from above.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-xl font-semibold mb-2">How the overall result is decided</h3>
        <ul className="list-disc pl-6 space-y-1">
          {OUTCOME_RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
        <p className="mt-2">You can only choose PASSED after actually looking at every picture for a few seconds.</p>
      </section>
      <section>
        <h3 className="text-xl font-semibold mb-2">Is the app itself drawing correctly?</h3>
        <p>The self-check reads back the pixels this app draws and confirms they are exactly right.</p>
        {onSelfCheck && (
          <Button className="mt-3" variant="secondary" onClick={onSelfCheck}>Run the self-check</Button>
        )}
      </section>
    </div>
  );
}

export function AboutContent() {
  return (
    <div className="space-y-5 text-lg leading-relaxed">
      <section>
        <h3 className="text-xl font-semibold mb-2">What this is</h3>
        <p>MonitorTest is a free, independent tool that guides you through checking a computer monitor with your own eyes: lines, dead pixels, light leaks, evenness, sharpness, motion, burn-in and the physical condition. It was made so that anyone, with no technical knowledge, can check a monitor properly before buying, selling or after a repair.</p>
      </section>
      <section>
        <h3 className="text-xl font-semibold mb-2">Who makes it</h3>
        <p>
          MonitorTest is made and maintained by <b>theaibot2011</b>. Questions, problems or ideas: open an issue on GitHub at{' '}
          <a className="underline text-sky-300" href="https://github.com/theaibot2011/Monitor-testing/issues" target="_blank" rel="noopener noreferrer">github.com/theaibot2011/Monitor-testing</a>.
        </p>
      </section>
      <section>
        <h3 className="text-xl font-semibold mb-2">Your privacy</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Everything runs on your own computer. Nothing you enter is uploaded or sent anywhere.</li>
          <li>No accounts, no cookies, no tracking, no adverts, no outside scripts or fonts.</li>
          <li>Your answers are saved only in this browser, so you can carry on after a refresh. "Start from the beginning" keeps old checks on this computer until you clear your browser data.</li>
          <li>Photos are never taken or uploaded. You can only type a photo’s file name as a note.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-xl font-semibold mb-2">What it can and cannot tell you</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>It shows exact test pictures and helps you judge them. The answers are yours: it is a guided eye check, not a certified inspection.</li>
          <li>It cannot measure colour accuracy or brightness. That needs a hardware colour meter (a colorimeter).</li>
          <li>It cannot detect flicker from dimming (PWM) or measure exact response times.</li>
          <li>A report shows what the tester answered. It is a record, not proof that cannot be changed.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-xl font-semibold mb-2">Flashing and changing colours</h3>
        <p>Two checks change full-screen colour every few seconds and one shows a moving block. Nothing flashes quickly or strobes. If you are sensitive to flashing light, skip those checks.</p>
      </section>
    </div>
  );
}
