import type { Combo, Session } from './session';

export const HINT_DISCLAIMER = 'These are hints only, not a diagnosis. Always confirm with a technician.';

/** Plain-language hints from the combinations tried (repair checks). Never a verdict. */
export function isolationHints(combos: Combo[], noSignalLines: boolean | null): string[] {
  const known = combos.filter((c) => c.lines !== 'notsure');
  const hints: string[] = [];
  if (noSignalLines) {
    hints.push('Lines were seen on the monitor’s own "No signal" screen. The computer and cable are not involved there, so this points toward the monitor itself.');
  }
  if (known.length < 2) return hints;
  const withLines = known.filter((c) => c.lines === 'yes');
  if (withLines.length === 0) {
    hints.push('No lines were seen on any combination tried.');
    return hints;
  }
  if (withLines.length === known.length) {
    hints.push(
      noSignalLines
        ? 'Lines showed on every combination tried and on the "No signal" screen. Together this points toward the monitor itself.'
        : 'Lines showed on every combination tried. This leans toward the monitor itself, but the "No signal" screen did not show lines, so keep an open mind.'
    );
    return hints;
  }
  const only = (field: 'cable' | 'port' | 'refresh') => {
    const norm = (c: Combo) => (field === 'port' || field === 'refresh' ? c[field].trim().toLowerCase() : c[field]);
    const bad = new Set(withLines.map(norm));
    const good = new Set(known.filter((c) => c.lines === 'no').map(norm));
    if (bad.size !== 1) return null;
    const [v] = [...bad];
    if (!v || good.has(v)) return null;
    return withLines.find((c) => norm(c) === v)![field];
  };
  const cable = only('cable');
  const port = only('port');
  const refresh = only('refresh');
  if (cable) hints.push(`Lines only showed with the ${cable === 'DP' ? 'DisplayPort' : cable} cable. This points toward that cable (or its socket).`);
  if (port) hints.push(`Lines only showed on the computer socket "${port}". This points toward that socket or cable.`);
  if (refresh) hints.push(`Lines only showed at ${refresh} Hz. This points toward a cable, graphics card or setting issue rather than the screen itself.`);
  if (!cable && !port && !refresh) hints.push('Lines showed on some combinations but not others, with no clear pattern. Try changing one thing at a time.');
  return hints;
}

export function noSignalLinesFrom(session: Session): boolean | null {
  const keys = Object.keys(session.answers).filter((k) => /^ofv\d+\.D$/.test(k));
  if (!keys.length) return null;
  return keys.some((k) => session.answers[k].status === 'problem');
}
