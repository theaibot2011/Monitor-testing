import { APP_VERSION, buildPlan, GROUP_LABEL, PURPOSE_TEXT } from './catalogue';
import { computeOutcome, notChecked, OUTCOME_TEXT } from './outcome';
import { answerText, SELF_REPORTED, testedRange } from './summary';
import { viewProgress } from './views';
import type { Session } from './session';

const OUTCOME_FILL = { serious: '#B91C1C', unfinished: '#B45309', minor: '#0369A1', passed: '#047857' };

/** Draws the report as a single tall image (a "report card") for sharing in chats and marketplaces. */
export function drawReportCard(session: Session, site: string): HTMLCanvasElement {
  const W = 1200;
  const pad = 56;
  const res = computeOutcome(session);
  const plan = buildPlan(session.purpose, session.runs);
  const missing = notChecked(session);
  const d = session.details;
  type Row = { kind: 'h' | 'row' | 'text' | 'gap'; a: string; b?: string; c?: string; color?: string };
  const rows: Row[] = [];
  const groups: [string, typeof plan][] = [];
  const runs = session.purpose === 'repair' ? session.runs : 1;
  for (let r = 1; r <= runs; r++) groups.push([`${GROUP_LABEL('lines', session.purpose)}${session.purpose === 'repair' ? `, run ${r}` : ''}`, plan.filter((p) => p.run === r)]);
  groups.push([GROUP_LABEL('main', session.purpose), plan.filter((p) => p.def.group === 'main')]);
  groups.push([GROUP_LABEL('physical', session.purpose), plan.filter((p) => p.def.group === 'physical')]);
  for (const [title, steps] of groups) {
    rows.push({ kind: 'h', a: title });
    for (const st of steps) {
      const a = session.answers[st.key];
      const vp = viewProgress(st.def, session.views[st.key]);
      const color = !a ? '#6B7280' : a.status === 'passed' ? '#047857' : a.status === 'problem' ? (a.severity === 'minor' ? '#B45309' : '#B91C1C') : '#B45309';
      rows.push({ kind: 'row', a: st.def.title + (st.def.mandatory ? '' : ' (optional)'), b: answerText(a).replace(/^not answered$/, 'Not answered'), c: vp.seconds === null ? '' : `${vp.seconds} s`, color });
    }
    rows.push({ kind: 'gap', a: '' });
  }
  if (missing.length) {
    rows.push({ kind: 'h', a: 'Not checked' });
    for (const m of missing) rows.push({ kind: 'text', a: `\u2022 ${m}` });
    rows.push({ kind: 'gap', a: '' });
  }
  const H = 470 + rows.reduce((t, r) => t + (r.kind === 'h' ? 54 : r.kind === 'gap' ? 14 : 38), 0) + 170;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = '#FFFFFF';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#0F172A';
  x.font = 'bold 44px system-ui, sans-serif';
  x.textBaseline = 'top';
  x.fillText('Monitor check report', pad, pad);
  x.font = '24px system-ui, sans-serif';
  x.fillStyle = '#334155';
  x.fillText(`${PURPOSE_TEXT[session.purpose].title}  \u00b7  Tested: ${testedRange(session)}`, pad, pad + 62);
  x.fillText(`Monitor: ${d.model || 'not given'}${d.serial ? `   Serial: ${d.serial}` : ''}`, pad, pad + 98);
  x.fillText(`Tested by: ${d.operator || 'not given'}${session.displayCheck?.refreshEstimate ? `   Refresh: about ${session.displayCheck.refreshEstimate} Hz${d.advertisedHz ? ` (advertised ${d.advertisedHz})` : ''}` : ''}`, pad, pad + 134);
  // Outcome box
  x.fillStyle = OUTCOME_FILL[res.outcome];
  x.fillRect(pad, pad + 186, W - 2 * pad, 150);
  x.fillStyle = '#FFFFFF';
  x.font = '22px system-ui, sans-serif';
  x.fillText('OVERALL RESULT', pad + 28, pad + 206);
  x.font = 'bold 48px system-ui, sans-serif';
  x.fillText(OUTCOME_TEXT[res.outcome].title, pad + 28, pad + 238);
  x.font = '22px system-ui, sans-serif';
  const reasons = [...res.serious, ...res.unfinished, ...res.minor];
  x.fillText(reasons.length ? `${reasons[0]}${reasons.length > 1 ? ` (+${reasons.length - 1} more)` : ''}`.slice(0, 95) : OUTCOME_TEXT[res.outcome].plain.slice(0, 95), pad + 28, pad + 298);
  let y = pad + 370;
  for (const r of rows) {
    if (r.kind === 'gap') {
      y += 14;
      continue;
    }
    if (r.kind === 'h') {
      x.fillStyle = '#0F172A';
      x.font = 'bold 28px system-ui, sans-serif';
      x.fillText(r.a, pad, y + 12);
      y += 54;
      continue;
    }
    x.font = '24px system-ui, sans-serif';
    x.fillStyle = '#1E293B';
    x.fillText(r.a.slice(0, 60), pad + (r.kind === 'text' ? 0 : 16), y);
    if (r.kind === 'row') {
      x.fillStyle = r.color!;
      x.font = 'bold 24px system-ui, sans-serif';
      x.fillText(r.b!, 640, y);
      x.fillStyle = '#64748B';
      x.font = '22px system-ui, sans-serif';
      x.textAlign = 'right';
      x.fillText(r.c!, W - pad, y);
      x.textAlign = 'left';
      x.strokeStyle = '#E2E8F0';
      x.beginPath();
      x.moveTo(pad, y + 33);
      x.lineTo(W - pad, y + 33);
      x.stroke();
    }
    y += 38;
  }
  x.fillStyle = '#475569';
  x.font = '20px system-ui, sans-serif';
  const footer = wrap(x, `${SELF_REPORTED} Times are seconds the test pictures were on screen. Made with MonitorTest ${APP_VERSION} at ${site}.`, W - 2 * pad);
  footer.forEach((line, i) => x.fillText(line, pad, H - 40 - (footer.length - i) * 28));
  return c;
}

/** Splits text into lines that fit `maxWidth` with the context's current font. */
function wrap(x: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (x.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function downloadReportCard(session: Session, site: string, filename: string) {
  const c = drawReportCard(session, site);
  c.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
