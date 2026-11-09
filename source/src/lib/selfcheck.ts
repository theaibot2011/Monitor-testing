import { SOLIDS_FOR_SELFCHECK } from './catalogue';
import { deviceSize, drawPattern, gradientLevel, parseHex, sizeCanvasToViewport } from './draw';

export interface CheckResult {
  group: string;
  name: string;
  pass: boolean;
  detail: string;
  /** Information only: shown, but never counted as a failure. */
  info?: boolean;
}

const px = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  const d = ctx.getImageData(x, y, 1, 1).data;
  return [d[0], d[1], d[2]] as const;
};
const fmt = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Reads back every pixel family the app draws and compares it with the exact expected values. */
export function runSelfCheck(): CheckResult[] {
  const out: CheckResult[] = [];
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'fixed', left: '0', top: '0', right: '0', bottom: '0', width: '100%', height: '100%', opacity: '0', pointerEvents: 'none' });
  document.body.appendChild(canvas);
  try {
    const { w, h, dpr } = sizeCanvasToViewport(canvas);
    const expected = deviceSize(window.innerWidth, window.innerHeight, dpr);
    out.push({
      group: 'Size',
      name: 'Canvas matches viewport × scaling',
      pass: canvas.width === expected.w && canvas.height === expected.h,
      detail: `canvas ${canvas.width}×${canvas.height}, expected round(${window.innerWidth}×${dpr}) × round(${window.innerHeight}×${dpr}) = ${expected.w}×${expected.h}`,
    });
    const r = canvas.getBoundingClientRect();
    const dw = Math.abs(r.width * dpr - w);
    const dh = Math.abs(r.height * dpr - h);
    out.push({
      group: 'Size',
      name: 'On-screen size within 1 pixel',
      pass: dw <= 1 && dh <= 1,
      detail: `difference ${dw.toFixed(2)} × ${dh.toFixed(2)} pixels`,
    });
    if (Math.abs(dpr - Math.round(dpr)) > 0.001) {
      out.push({
        group: 'Size',
        name: 'Scaling note',
        pass: true,
        info: true,
        detail: `Scaling is ${Math.round(dpr * 100)}% (common on laptops). The pixel checks still decide the result. If the fine 1-pixel patterns look wavy, set the zoom to 100% (Ctrl+0, or Cmd+0 on a Mac).`,
      });
    }

    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })!;
    const points: [string, number, number][] = [
      ['top-left', 0, 0],
      ['top-right', w - 1, 0],
      ['bottom-left', 0, h - 1],
      ['bottom-right', w - 1, h - 1],
      ['centre', Math.floor(w / 2), Math.floor(h / 2)],
    ];

    // Solid colours on the pattern canvas.
    for (const c of SOLIDS_FOR_SELFCHECK) {
      drawPattern(ctx, w, h, { kind: 'solid', color: c.color, label: c.name });
      const want = parseHex(c.color);
      const bad = points.filter(([, x, y]) => px(ctx, x, y).some((v, i) => v !== want[i]));
      out.push({
        group: 'Solid colours (canvas)',
        name: `${c.name} ${c.color}`,
        pass: bad.length === 0,
        detail: bad.length ? `wrong at ${bad.map(([n, x, y]) => `${n} ${fmt(px(ctx, x, y))}`).join(', ')}` : 'exact at 4 corners and centre',
      });
    }

    // Solid colours as DOM elements: computed style, redrawn on a separate canvas and compared.
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:4px;height:4px;opacity:0;pointer-events:none';
    document.body.appendChild(probe);
    const off = document.createElement('canvas');
    off.width = 1;
    off.height = 1;
    const octx = off.getContext('2d', { willReadFrequently: true })!;
    for (const c of SOLIDS_FOR_SELFCHECK) {
      probe.style.backgroundColor = c.color;
      const css = getComputedStyle(probe).backgroundColor;
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css);
      const want = parseHex(c.color);
      let pass = !!m && [m[1], m[2], m[3]].every((v, i) => Number(v) === want[i]);
      octx.fillStyle = css;
      octx.fillRect(0, 0, 1, 1);
      const got = px(octx, 0, 0);
      pass = pass && got.every((v, i) => v === want[i]);
      out.push({ group: 'Solid colours (page elements)', name: `${c.name} ${c.color}`, pass, detail: `style ${css}, redrawn ${fmt(got)}` });
    }
    probe.remove();

    // 1-pixel line patterns.
    const lineCheck = (kind: 'hlines' | 'vlines' | 'checker', name: string) => {
      drawPattern(ctx, w, h, { kind, label: name });
      let errors = 0;
      let first = '';
      if (kind === 'hlines') {
        const col = ctx.getImageData(Math.floor(w / 2), 0, 1, h).data;
        for (let y = 0; y < h; y++) {
          const want = y % 2 === 0 ? 255 : 0;
          if (col[y * 4] !== want || col[y * 4 + 1] !== want || col[y * 4 + 2] !== want) {
            errors++;
            if (!first) first = `row ${y}`;
          }
        }
      } else {
        for (const y of [0, Math.floor(h / 2), h - 1]) {
          const row = ctx.getImageData(0, y, w, 1).data;
          for (let x = 0; x < w; x++) {
            const on = kind === 'vlines' ? x % 2 === 0 : (x + y) % 2 === 0;
            const want = on ? 255 : 0;
            if (row[x * 4] !== want || row[x * 4 + 1] !== want || row[x * 4 + 2] !== want) {
              errors++;
              if (!first) first = `x ${x}, y ${y}`;
            }
          }
        }
      }
      out.push({
        group: '1-pixel line patterns',
        name,
        pass: errors === 0,
        detail: errors ? `${errors} wrong pixels, first at ${first}` : 'every sampled pixel alternates exactly on/off',
      });
    };
    lineCheck('hlines', 'Horizontal lines');
    lineCheck('vlines', 'Vertical lines');
    lineCheck('checker', 'Checkerboard');

    // Gradients: exact 8-bit levels, never decreasing, steps of at most 1, from 0 to 255.
    for (const ch of ['grey', 'r', 'g', 'b'] as const) {
      drawPattern(ctx, w, h, { kind: 'gradient', channel: ch, label: ch });
      const row = ctx.getImageData(0, Math.floor(h / 2), w, 1).data;
      let errors = 0;
      let maxStep = 0;
      let prev = -1;
      const idx = ch === 'r' ? 0 : ch === 'g' ? 1 : ch === 'b' ? 2 : 0;
      for (let x = 0; x < w; x++) {
        const want = gradientLevel(x, w);
        const v = row[x * 4 + idx];
        const others = [0, 1, 2].filter((i) => i !== idx).map((i) => row[x * 4 + i]);
        const othersOk = ch === 'grey' ? others.every((o) => o === v) : others.every((o) => o === 0);
        if (v !== want || !othersOk || v < prev) errors++;
        if (prev >= 0) maxStep = Math.max(maxStep, v - prev);
        prev = v;
      }
      const stepOk = w >= 256 ? maxStep <= 1 : true;
      const ends = row[idx] === 0 && row[(w - 1) * 4 + idx] === 255;
      const names = { grey: 'Grey', r: 'Red', g: 'Green', b: 'Blue' };
      out.push({
        group: 'Gradients',
        name: `${names[ch]} fade`,
        pass: errors === 0 && stepOk && ends,
        detail: errors || !stepOk || !ends ? `${errors} wrong pixels, largest step ${maxStep}, ends ${row[idx]}→${row[(w - 1) * 4 + idx]}` : `exact 0→255, never decreasing, largest step ${maxStep}`,
      });
    }
  } catch (e) {
    out.push({ group: 'Error', name: 'Self-check could not finish', pass: false, detail: String(e) });
  } finally {
    canvas.remove();
  }
  return out;
}
