/** Every test the app can run, and how a session's plan is built from them. */

export const APP_VERSION = '3.1.0';

export type PatternSpec =
  | { kind: 'solid'; color: string; label: string }
  | { kind: 'hlines' | 'vlines' | 'checker' | 'grid' | 'text' | 'motion'; label: string }
  | { kind: 'gradient'; channel: 'grey' | 'r' | 'g' | 'b'; label: string }
  | { kind: 'steps'; range: 'dark' | 'light'; label: string };

export type StepKind = 'patterns' | 'cycle' | 'nosignal' | 'scan' | 'question';
/** lines = lines-and-stripes checks (repeatable runs in repair mode); main = picture checks; physical = hands-on checks. */
export type Group = 'lines' | 'main' | 'physical';
export type Purpose = 'buying' | 'selling' | 'repair' | 'own';

export interface TestDef {
  id: string;
  title: string;
  group: Group;
  kind: StepKind;
  mandatory: boolean;
  /** Rough time for the whole step, used for the estimate shown on screen. */
  seconds: number;
  intro: string;
  /** What a PASS looks like. */
  normal: string[];
  /** What a PROBLEM looks like, with a hint about serious vs small. */
  problem: string[];
  question: string;
  /** Wording used when checking a monitor after repair. */
  questionRepair?: string;
  patterns?: PatternSpec[];
  /** Minimum time each picture must be on screen before PASSED can be chosen. */
  minViewMs?: number;
  /** Shows the photosensitivity note. */
  changingColours?: boolean;
  repairOnly?: boolean;
}

/** Pure single-channel level at a percentage, rounded to the nearest 8-bit value. */
export const pct = (p: number) => Math.round((255 * p) / 100);
const hex2 = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
export const rgbHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

export const CYCLE_COLOURS: { color: string; name: string }[] = [
  { color: '#000000', name: 'Black' },
  { color: '#FFFFFF', name: 'White' },
  { color: '#FF0000', name: 'Red' },
  { color: '#00FF00', name: 'Green' },
  { color: '#0000FF', name: 'Blue' },
  { color: '#808080', name: 'Grey' },
  { color: '#00FFFF', name: 'Cyan' },
  { color: '#FF00FF', name: 'Magenta' },
  { color: '#FFFF00', name: 'Yellow' },
];

export const SOLIDS_FOR_SELFCHECK = [
  ...CYCLE_COLOURS.map((c) => ({ color: c.color, name: c.name })),
  { color: '#1A1A1A', name: 'Dark grey' },
  { color: '#2E2E2E', name: 'Grey 18%' },
  { color: rgbHex(pct(1), 0, 0), name: 'Red 1%' },
  { color: rgbHex(0, pct(2), 0), name: 'Green 2%' },
  { color: rgbHex(0, 0, pct(1)), name: 'Blue 1%' },
];

export const CYCLE_MIN_VIEW_MS = CYCLE_COLOURS.length * 2000;
export const SCAN_MIN_VIEW_MS = 10000;
export const NOSIGNAL_MIN_VIEW_MS = 30000;

const DEFS: TestDef[] = [
  {
    id: 'A', group: 'lines', kind: 'patterns', mandatory: true, seconds: 60,
    title: 'Plain screens',
    intro: 'Plain black, white and grey screens. Lines and stripes are easiest to see here.',
    normal: ['Each screen is one even colour from edge to edge.'],
    problem: ['Thin lines across or down the screen, straight or broken.', 'Stripes or bands of a slightly different shade.', 'Lines that flicker or come and go.'],
    question: 'Did you see any lines, stripes or bands on these screens?',
    questionRepair: 'Did you see the original fault (lines) on any of these screens?',
    patterns: [
      { kind: 'solid', color: '#000000', label: 'Black' },
      { kind: 'solid', color: '#FFFFFF', label: 'White' },
      { kind: 'solid', color: '#808080', label: 'Mid grey' },
    ],
  },
  {
    id: 'B', group: 'lines', kind: 'cycle', mandatory: true, seconds: 90, changingColours: true,
    title: 'Colour cycle',
    intro: 'The screen changes colour by itself every few seconds. If you see a line, press L on the keyboard, or move the mouse and click the red "I see a line" button. Keep watching; the colours keep changing.',
    normal: ['Every colour fills the whole screen evenly.'],
    problem: ['A line or stripe on any colour.', 'A line that stays in exactly the same place when the colour changes is a strong sign of a fault in the screen itself.'],
    question: 'Did you see any lines or stripes during the colour cycle?',
    questionRepair: 'Did you see the original fault (lines) during the colour cycle?',
  },
  {
    id: 'C', group: 'lines', kind: 'patterns', mandatory: true, seconds: 120,
    title: 'Very dark colours',
    intro: 'Faint lines often only show on very dark colours. These screens are nearly black on purpose. Turn the room lights off or down for this.',
    normal: ['Most of these look black or very dark and even. That is normal.', 'The last three screens are bright red, green and blue, each even.'],
    problem: ['Faint lines or stripes on the near-black screens.', 'One area clearly lighter or a different colour from the rest.'],
    question: 'Did you see lines or odd patches on the very dark colours?',
    questionRepair: 'Did you see the original fault (lines) or odd patches on the very dark colours?',
    patterns: [
      { kind: 'solid', color: rgbHex(pct(1), 0, 0), label: 'Red 1%' },
      { kind: 'solid', color: rgbHex(pct(2), 0, 0), label: 'Red 2%' },
      { kind: 'solid', color: rgbHex(0, pct(1), 0), label: 'Green 1%' },
      { kind: 'solid', color: rgbHex(0, pct(2), 0), label: 'Green 2%' },
      { kind: 'solid', color: rgbHex(0, 0, pct(1)), label: 'Blue 1%' },
      { kind: 'solid', color: rgbHex(0, 0, pct(2)), label: 'Blue 2%' },
      { kind: 'solid', color: rgbHex(pct(2), pct(2), pct(2)), label: 'Grey 2%' },
      { kind: 'solid', color: rgbHex(pct(5), pct(5), pct(5)), label: 'Grey 5%' },
      { kind: 'solid', color: '#FF0000', label: 'Red only' },
      { kind: 'solid', color: '#00FF00', label: 'Green only' },
      { kind: 'solid', color: '#0000FF', label: 'Blue only' },
    ],
  },
  {
    id: 'D', group: 'lines', kind: 'nosignal', mandatory: true, seconds: 120, repairOnly: true,
    title: 'The monitor’s own "No signal" screen',
    intro: 'You will unplug the video cable for 30 seconds. The monitor then shows its own "No signal" message, drawn by the monitor itself, not the computer. If lines show there too, the fault is inside the monitor.',
    normal: ['The monitor’s "No signal" message looks clean, with no lines.'],
    problem: ['Lines on the "No signal" message or box.'],
    question: 'Were there lines on the monitor’s own "No signal" screen?',
  },
  {
    id: 'E', group: 'lines', kind: 'patterns', mandatory: true, seconds: 60,
    title: 'Fine line patterns',
    intro: 'Patterns made of 1-pixel lines. From a normal distance they look like even grey. The last one is a grid with a thin border around the very edge of the screen.',
    normal: ['Each pattern looks even across the whole screen.', 'Moving your head can make fine patterns shimmer slightly. That is normal.', 'On the grid, the thin border is visible on all four edges.'],
    problem: ['One area looks different, blurred or wavy while you keep still.', 'Extra lines that do not belong to the pattern.', 'The border is missing on an edge: the picture is cut off (common on TVs; fix it with the TV’s "Just scan" or "Screen fit" setting).'],
    question: 'Did you see lines, odd areas or a missing edge on the fine patterns?',
    questionRepair: 'Did you see the original fault or anything odd on the fine patterns?',
    patterns: [
      { kind: 'hlines', label: 'Horizontal 1-pixel lines' },
      { kind: 'vlines', label: 'Vertical 1-pixel lines' },
      { kind: 'checker', label: '1-pixel checkerboard' },
      { kind: 'grid', label: 'Grid with edge border' },
    ],
  },
  {
    id: 'E2', group: 'lines', kind: 'scan', mandatory: false, seconds: 90,
    title: 'Slow scan',
    intro: 'A thin line slowly moves across the screen. If it jumps, breaks or a glitch appears at one spot, note where. You choose the speed and can pause.',
    normal: ['The line moves smoothly and stays straight the whole way.'],
    problem: ['The line breaks, bends or jumps at one place.', 'A glitch that always shows in the same strip of the screen.'],
    question: 'Did the slow scan show a glitch in any part of the screen?',
    questionRepair: 'Did the slow scan show a glitch in any part of the screen?',
  },
  {
    id: 'dead', group: 'main', kind: 'patterns', mandatory: true, seconds: 180, minViewMs: 4000,
    title: 'Dead and stuck pixels',
    intro: 'Plain full colours. Look slowly over the whole screen, section by section, from about arm’s length. Each picture needs at least 4 seconds.',
    normal: ['No dots that differ from the background on any colour.', 'A dot that disappears when you wipe the screen was dust.'],
    problem: ['A dot that is always black (dead pixel).', 'A dot that is always one colour, such as red, green or white (stuck pixel).', 'Small issue: 1 or 2 single dots near the edge. Many makers accept this; check their pixel policy.', 'Serious: dots near the middle, several dots, or a cluster.'],
    question: 'Did you find dead or stuck dots?',
    patterns: [
      { kind: 'solid', color: '#000000', label: 'Black' },
      { kind: 'solid', color: '#FFFFFF', label: 'White' },
      { kind: 'solid', color: '#FF0000', label: 'Red' },
      { kind: 'solid', color: '#00FF00', label: 'Green' },
      { kind: 'solid', color: '#0000FF', label: 'Blue' },
    ],
  },
  {
    id: 'uniformity', group: 'main', kind: 'patterns', mandatory: true, seconds: 120,
    title: 'Backlight and evenness',
    intro: 'Dark and grey screens to check the light behind the picture (the backlight). Turn the room lights off for this one; it matters.',
    normal: ['On black, a faint glow in one or two corners that changes when you move your head. This is normal, especially on IPS screens.', 'Grey and white look even, give or take a little.'],
    problem: ['Bright patches of light leaking in from the edges that stay put when you move your head (backlight bleed).', 'Large cloudy or blotchy areas on dark grey.', 'One part of the screen clearly brighter or a different tint on grey or white.', 'Small issue: mild bleed only visible on black in a dark room. Serious: bleed or patches you notice in normal use.'],
    question: 'Did you see light leaking, cloudy patches or uneven areas?',
    patterns: [
      { kind: 'solid', color: '#000000', label: 'Black' },
      { kind: 'solid', color: '#1A1A1A', label: 'Dark grey' },
      { kind: 'solid', color: '#808080', label: 'Mid grey' },
      { kind: 'solid', color: '#FFFFFF', label: 'White' },
    ],
  },
  {
    id: 'gradients', group: 'main', kind: 'patterns', mandatory: true, seconds: 90,
    title: 'Smooth colour fades',
    intro: 'Each screen fades from dark on the left to bright on the right.',
    normal: ['A smooth fade. A very faint staircase of steps is normal on most monitors.', 'The grey fade stays grey all the way.'],
    problem: ['Big jumps or wide, obvious bands.', 'Coloured stripes (pink, green) inside the grey fade.', 'Lines across the fade.'],
    question: 'Did you see big jumps, coloured stripes or lines in the fades?',
    patterns: [
      { kind: 'gradient', channel: 'grey', label: 'Grey fade' },
      { kind: 'gradient', channel: 'r', label: 'Red fade' },
      { kind: 'gradient', channel: 'g', label: 'Green fade' },
      { kind: 'gradient', channel: 'b', label: 'Blue fade' },
    ],
  },
  {
    id: 'levels', group: 'main', kind: 'patterns', mandatory: true, seconds: 60,
    title: 'Dark and bright detail',
    intro: 'Numbered squares, each a tiny bit different from the background. They get easier to see as the numbers go up.',
    normal: ['Dark screen: squares from about number 6 onwards look different from the black background. Squares 1 to 5 often look black. That is normal.', 'Bright screen: the same, from about number 6 onwards.'],
    problem: ['Squares 1 to 10 all look exactly like the background on either screen. Dark or bright detail is being lost.'],
    question: 'Did squares 1 to 10 all look the same as the background?',
    patterns: [
      { kind: 'steps', range: 'dark', label: 'Dark squares' },
      { kind: 'steps', range: 'light', label: 'Bright squares' },
    ],
  },
  {
    id: 'sharpness', group: 'main', kind: 'patterns', mandatory: true, seconds: 60,
    title: 'Text and sharpness',
    intro: 'Text at several sizes, then a grid. Everything should look crisp.',
    normal: ['Text is crisp and easy to read, even the small sizes.', 'Grid lines are thin and sharp.'],
    problem: ['Blurry, fuzzy or doubled text. This often means the wrong resolution; check Windows display settings before blaming the monitor.', 'Coloured fringes around letters.'],
    question: 'Did text or lines look blurry, doubled or fringed?',
    patterns: [
      { kind: 'text', label: 'Text' },
      { kind: 'grid', label: 'Grid with edge border' },
    ],
  },
  {
    id: 'angles', group: 'main', kind: 'patterns', mandatory: true, seconds: 60,
    title: 'Viewing angles',
    intro: 'On each screen, look from the left, the right, from above and from below, about 45 degrees (halfway to the side).',
    normal: ['Colours and brightness fade or shift a little from the side. That is normal for every LCD.', 'Cheaper "TN" screens change a lot from above or below. That is also normal for that type.'],
    problem: ['One area changes very differently from the rest of the screen.', 'Lines or patches that only appear from an angle.'],
    question: 'Did one area or lines appear only from an angle?',
    patterns: [
      { kind: 'solid', color: '#FFFFFF', label: 'White' },
      { kind: 'solid', color: '#808080', label: 'Mid grey' },
      { kind: 'solid', color: '#000000', label: 'Black' },
    ],
  },
  {
    id: 'retention', group: 'main', kind: 'patterns', mandatory: true, seconds: 60,
    title: 'Burn-in and ghost images',
    intro: 'Plain grey screens. Look for faint shapes left behind by things that were on screen for a long time, such as a taskbar, logos or a game’s on-screen display. This is most common on OLED screens.',
    normal: ['Even grey with no shapes.'],
    problem: ['Faint outlines of a taskbar, windows, logos or icons.', 'Small issue: very faint and fades away after a few minutes. Serious: clearly visible and permanent (burn-in).'],
    question: 'Did you see any faint shapes left behind?',
    patterns: [
      { kind: 'solid', color: '#2E2E2E', label: 'Dark grey (18%)' },
      { kind: 'solid', color: '#808080', label: 'Mid grey (50%)' },
    ],
  },
  {
    id: 'motion', group: 'main', kind: 'patterns', mandatory: true, seconds: 60, minViewMs: 5000, changingColours: true,
    title: 'Motion and smearing',
    intro: 'A white block moves across a grey background. Watch it with your eyes following it, for at least 5 seconds.',
    normal: ['The block looks fairly sharp. A short, faint trail is normal on all monitors.', 'Movement is smooth.'],
    problem: ['Long dark or coloured trails behind the block (ghosting).', 'The block jumps or stutters all the time.'],
    question: 'Did the moving block leave long trails or stutter badly?',
    patterns: [{ kind: 'motion', label: 'Moving block' }],
  },
  {
    id: 'power', group: 'physical', kind: 'question', mandatory: true, seconds: 30,
    title: 'Power and standby light',
    intro: 'Look at the power light on the monitor.',
    normal: ['The light is on while working.', 'It changes (often to orange) or blinks when the monitor has no signal.'],
    problem: ['No light at all, or it flickers while the picture is on.'],
    question: 'Does the power light behave normally?',
  },
  {
    id: 'buttons', group: 'physical', kind: 'question', mandatory: true, seconds: 60,
    title: 'Buttons and on-screen menu',
    intro: 'Press the monitor’s menu button and move through a few options. Do not change settings; just open and close the menu.',
    normal: ['Every button does something.', 'The menu looks clean, with no lines.'],
    problem: ['A button that does nothing or sticks.', 'Lines on the monitor’s own menu (a fault inside the monitor).'],
    question: 'Do the buttons and on-screen menu work normally, with no lines on the menu?',
  },
  {
    id: 'ports', group: 'physical', kind: 'question', mandatory: true, seconds: 30,
    title: 'Cable sockets',
    intro: 'Gently wiggle the video cable at the monitor end while looking at the screen.',
    normal: ['The plug sits firmly and the picture stays steady.'],
    problem: ['The picture flickers or drops when the cable moves.', 'A loose or damaged socket.'],
    question: 'Do the cable sockets feel firm, with a steady picture when the cable is moved?',
  },
  {
    id: 'noise', group: 'physical', kind: 'question', mandatory: true, seconds: 30,
    title: 'Sounds and smells',
    intro: 'Listen close to the monitor for a few seconds while it shows something bright.',
    normal: ['Silent, or a very faint hum you can only hear with your ear right next to it.'],
    problem: ['Buzzing, whining or clicking you can hear from where you sit.', 'Any burning smell. Switch off straight away.'],
    question: 'Is the monitor quiet, with no burning smell?',
  },
  {
    id: 'case', group: 'physical', kind: 'question', mandatory: true, seconds: 60,
    title: 'Case, stand and screen surface',
    intro: 'Look over the outside of the monitor with the screen switched off or black.',
    normal: ['No cracks. The stand holds the screen steady.', 'The screen surface has no scratches or marks.'],
    problem: ['Cracks, gaps or loose panels.', 'Scratches, dents or pressure marks on the screen.', 'A wobbly or broken stand.'],
    question: 'Are the case, stand and screen surface in good condition?',
  },
];

export const DEF_BY_ID: Record<string, TestDef> = Object.fromEntries(DEFS.map((d) => [d.id, d]));
export const ALL_DEFS = DEFS;

export interface PlanStep {
  key: string;
  def: TestDef;
  run?: number;
}

const MAIN = ['dead', 'uniformity', 'gradients', 'levels', 'sharpness', 'angles', 'retention', 'motion'];
const PHYSICAL = ['power', 'buttons', 'ports', 'noise', 'case'];

export function linesIdsFor(purpose: Purpose) {
  return DEFS.filter((d) => d.group === 'lines' && (!d.repairOnly || purpose === 'repair')).map((d) => d.id);
}

/** Lines checks come first; extra repair runs are appended at the end so step indexes never shift. */
export function buildPlan(purpose: Purpose, runs: number): PlanStep[] {
  const lines = (run: number) => linesIdsFor(purpose).map((id) => ({ key: `ofv${run}.${id}`, def: DEF_BY_ID[id], run }));
  const plan: PlanStep[] = [...lines(1)];
  plan.push(...MAIN.map((id) => ({ key: id, def: DEF_BY_ID[id] })));
  plan.push(...PHYSICAL.map((id) => ({ key: `phys.${id}`, def: DEF_BY_ID[id] })));
  if (purpose === 'repair') for (let r = 2; r <= runs; r++) plan.push(...lines(r));
  return plan;
}

export function estimateMinutes(purpose: Purpose) {
  const secs = buildPlan(purpose, 1).reduce((t, p) => t + p.def.seconds, 0) + 240; // + set-up screens
  return Math.round(secs / 60);
}

export const PURPOSE_TEXT: Record<Purpose, { title: string; text: string }> = {
  buying: { title: 'I’m buying a monitor', text: 'Check it before you pay. Bring the report home as a record.' },
  selling: { title: 'I’m selling a monitor', text: 'Show a buyer it works, and keep a report you can send them.' },
  repair: { title: 'It has just been repaired', text: 'Check the fault is really fixed, including after it warms up.' },
  own: { title: 'Checking my own monitor', text: 'Something looks odd, or you just want peace of mind.' },
};

export const GROUP_LABEL = (group: Group, purpose: Purpose) =>
  group === 'lines' ? (purpose === 'repair' ? 'The fault it was repaired for' : 'Lines and stripes') : group === 'main' ? 'Picture checks' : 'Hands-on checks';

export const questionFor = (def: TestDef, purpose: Purpose) => (purpose === 'repair' && def.questionRepair ? def.questionRepair : def.question);

export const shortTitle = (def: TestDef) => def.title;

export const STATUS_LABEL: Record<string, string> = {
  passed: 'PASSED',
  problem: 'PROBLEM FOUND',
  notsure: 'NOT SURE',
  skipped: 'SKIPPED',
};
