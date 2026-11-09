import { Shell } from '../components/Shell';
import { Button, Card, H1 } from '../components/ui';
import { useApp } from '../state';
import { INTRO_KEY, type Setup } from '../lib/session';
import { isMac, zoomKeys } from '../lib/platform';
import { radioKeys } from '../components/radio';

export function screenSteps(setup: Setup, mac: boolean): [string, string][] {
  const items: [string, string][] = [];
  if (setup === 'laptop') {
    items.push(['Put this page on the MONITOR', 'The monitor you are testing, not the laptop’s own screen. Drag this browser window onto the monitor if needed.']);
    if (mac) {
      items.push(['Make the monitor the main screen', 'On a Mac: open System Settings → Displays, select the monitor and set "Use as" to "Main display". Or simply drag this window onto the monitor. Then look only at the monitor.']);
    } else {
      items.push(['Press Win+P and choose "Second screen only"', 'Hold the Windows key, tap P, then pick "Second screen only". The laptop screen goes dark and only the monitor shows a picture. (If you don’t see this option, drag this window onto the monitor instead.)']);
    }
  } else {
    items.push(['Use the monitor being tested', 'This page should be on the monitor you are checking. If the computer has more than one screen, drag this window onto the right one.']);
  }
  items.push([`Press ${zoomKeys()}`, 'This sets the browser zoom to 100%, so every pixel is exact.']);
  return items;
}

export function BeforeYouStart() {
  const { s, update, store } = useApp();
  const mac = isMac();
  const next = () => {
    try {
      store.kv.setItem(INTRO_KEY, '1');
    } catch {
      /* ignore */
    }
    update({ screen: 'prep' });
  };
  const choice = (value: Setup, title: string, text: string) => (
    <button
      type="button"
      role="radio"
      data-value={value}
      tabIndex={s.setup === value ? 0 : -1}
      aria-checked={s.setup === value}
      onClick={() => update({ setup: value })}
      className={`text-left rounded-2xl border-2 p-4 ui-anim focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 ${
        s.setup === value ? 'border-sky-400 bg-sky-950/60' : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
      }`}
    >
      <div className="text-lg font-bold">{title}</div>
      <div className="text-slate-300">{text}</div>
    </button>
  );
  const items = screenSteps(s.setup, mac);
  return (
    <Shell>
      <H1>Before you start</H1>
      <h2 className="text-xl font-semibold mb-3">What is the monitor plugged into?</h2>
      <div className="grid sm:grid-cols-2 gap-3 mb-8" role="radiogroup" aria-label="What is the monitor plugged into?" onKeyDown={radioKeys(['laptop', 'desktop'] as const, s.setup, (v) => update({ setup: v }))}>
        {choice('laptop', 'A laptop', 'The laptop has its own screen as well.')}
        {choice('desktop', 'A desktop computer', 'The monitor is the computer’s screen.')}
      </div>
      <p className="text-xl text-slate-300 mb-4">Then do these {items.length} things:</p>
      <ol className="space-y-4 mb-8">
        {items.map(([t, d], i) => (
          <li key={t}>
            <Card className="flex gap-4 items-start">
              <span className="text-3xl font-bold text-sky-400 w-10 shrink-0">{i + 1}</span>
              <span>
                <span className="block text-2xl font-semibold">{t}</span>
                <span className="block text-lg text-slate-300 mt-1">{d}</span>
              </span>
            </Card>
          </li>
        ))}
      </ol>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button big className="flex-1" onClick={next}>I have done these</Button>
        <Button big variant="ghost" onClick={() => update({ screen: 'home' })}>Back</Button>
      </div>
    </Shell>
  );
}

export function Preparation() {
  const { s, update } = useApp();
  const mac = isMac();
  const steps: [string, string][] = [
    ['Use Chrome, Edge or Firefox', 'Safari works too, but full screen is most reliable in Chrome and Edge.'],
    ['Check this page is on the monitor and the zoom is 100%', `${s.setup === 'laptop' ? (mac ? 'Drag this window onto the monitor.' : 'Win+P → "Second screen only".') : 'This page should be on the monitor being tested.'} Then press ${mac ? 'Cmd (⌘) and 0' : 'Ctrl and 0'}.`],
    ['Clean the screen gently', 'Dust and smudges look like dead pixels or marks. Use a dry, soft cloth.'],
    ['Dim the room lights', 'Faint lines and light leaks are only visible in a darker room. Some checks will remind you.'],
    ['Turn off colour filters', mac ? 'Switch off Night Shift and True Tone (System Settings → Displays). Leave the monitor’s own settings as they are.' : 'Switch off Night Light and HDR (Settings → Display). Leave the monitor’s own settings as they are.'],
    ['Plug in the laptop charger', 'So the computer does not dim the screen or sleep during the check.'],
  ];
  if (s.purpose === 'repair') {
    steps.push(['Note the time the monitor was switched on', 'Some faults only appear after 30 minutes of warm-up. The app keeps track and suggests a second run later.']);
    steps.push(['One check involves unplugging the cable', s.setup === 'laptop' && !mac
      ? 'For the "No signal" check you will switch to Win+P → Extend first, then unplug the cable for 30 seconds. The page may jump to the laptop screen. That is fine: look at the MONITOR.'
      : 'For the "No signal" check you will unplug the cable for 30 seconds. The picture goes away, which is expected: look at the MONITOR’s own "No signal" message.']);
  }
  return (
    <Shell>
      <H1>Getting ready</H1>
      <p className="text-lg text-slate-300 mb-6">About 2 minutes. Go down the list:</p>
      <ul className="space-y-3 mb-8">
        {steps.map(([t, d]) => (
          <li key={t}>
            <Card>
              <div className="text-xl font-semibold">{t}</div>
              <div className="text-lg text-slate-300 mt-1">{d}</div>
            </Card>
          </li>
        ))}
      </ul>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button big className="flex-1" onClick={() => update({ screen: 'details' })}>Ready, next</Button>
        <Button big variant="ghost" onClick={() => update({ screen: 'before' })}>Back</Button>
      </div>
    </Shell>
  );
}
