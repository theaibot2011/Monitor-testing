import type { PatternSpec } from './catalogue';

/** Device-pixel size the canvas must have to map 1:1 onto screen pixels. */
export function deviceSize(cssW: number, cssH: number, dpr: number) {
  return { w: Math.max(1, Math.round(cssW * dpr)), h: Math.max(1, Math.round(cssH * dpr)) };
}

/**
 * Sizes the canvas buffer from the canvas's own on-screen box (not 100vh), so mobile browser
 * toolbars can never stretch the image and create fake lines.
 */
export function sizeCanvasToViewport(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width || window.innerWidth;
  const cssH = rect.height || window.innerHeight;
  const { w, h } = deviceSize(cssW, cssH, dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return { w, h, dpr };
}

export function parseHex(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error('Bad colour ' + hex);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([0x0a0b0c0d]).buffer)[0] === 0x0d;
/** Packs an opaque RGB colour into one 32-bit pixel value for the platform's byte order. */
export const pack = (r: number, g: number, b: number) =>
  LITTLE_ENDIAN ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0 : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;

/** Writes whole rows of 32-bit pixels. Exact pixels and ~10x faster than per-pixel arrays at 4K. */
function paintRows(ctx: CanvasRenderingContext2D, w: number, h: number, row: (y: number, out: Uint32Array) => void) {
  const img = ctx.createImageData(w, h);
  const px = new Uint32Array(img.data.buffer);
  for (let y = 0; y < h; y++) row(y, px.subarray(y * w, (y + 1) * w));
  ctx.putImageData(img, 0, 0);
}

/** 8-bit gradient level for column x: 256 equal-width bands, 0 on the left to 255 on the right. */
export const gradientLevel = (x: number, w: number) => Math.min(255, Math.floor((x * 256) / w));

const WHITE = pack(255, 255, 255);
const BLACK = pack(0, 0, 0);

export const DARK_STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 32];
export const LIGHT_STEPS = [255, 254, 253, 252, 251, 250, 249, 248, 247, 245, 243, 241, 239, 235, 231, 223];

/** Draws a static pattern, or one frame of an animated one at time t (ms). */
export function drawPattern(ctx: CanvasRenderingContext2D, w: number, h: number, spec: PatternSpec, t = 0, dpr = 1) {
  ctx.imageSmoothingEnabled = false;
  switch (spec.kind) {
    case 'solid':
      ctx.fillStyle = spec.color;
      ctx.fillRect(0, 0, w, h);
      return;
    case 'hlines':
      return paintRows(ctx, w, h, (y, out) => out.fill(y % 2 === 0 ? WHITE : BLACK));
    case 'vlines': {
      const line = new Uint32Array(w);
      for (let x = 0; x < w; x++) line[x] = x % 2 === 0 ? WHITE : BLACK;
      return paintRows(ctx, w, h, (_y, out) => out.set(line));
    }
    case 'checker': {
      const even = new Uint32Array(w);
      const odd = new Uint32Array(w);
      for (let x = 0; x < w; x++) {
        even[x] = x % 2 === 0 ? WHITE : BLACK;
        odd[x] = x % 2 === 0 ? BLACK : WHITE;
      }
      return paintRows(ctx, w, h, (y, out) => out.set(y % 2 === 0 ? even : odd));
    }
    case 'gradient': {
      const ch = spec.channel;
      const line = new Uint32Array(w);
      for (let x = 0; x < w; x++) {
        const v = gradientLevel(x, w);
        line[x] = ch === 'grey' ? pack(v, v, v) : ch === 'r' ? pack(v, 0, 0) : ch === 'g' ? pack(0, v, 0) : pack(0, 0, v);
      }
      return paintRows(ctx, w, h, (_y, out) => out.set(line));
    }
    case 'grid': {
      const step = Math.max(16, Math.round(64 * dpr));
      const full = new Uint32Array(w).fill(WHITE);
      const ticks = new Uint32Array(w);
      for (let x = 0; x < w; x++) ticks[x] = x === 0 || x === w - 1 || x % step === 0 ? WHITE : BLACK;
      return paintRows(ctx, w, h, (y, out) => out.set(y === 0 || y === h - 1 || y % step === 0 ? full : ticks));
    }
    case 'steps': {
      const dark = spec.range === 'dark';
      const levels = dark ? DARK_STEPS : LIGHT_STEPS;
      const bg = dark ? 0 : 255;
      ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
      ctx.fillRect(0, 0, w, h);
      const cols = 8;
      const tile = Math.floor(Math.min(w / (cols + 1), h / 3.5));
      const gap = Math.floor(tile / 8);
      const x0 = Math.floor((w - cols * tile) / 2);
      const y0 = Math.floor((h - 2 * tile) / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `${Math.max(12, Math.round(tile / 6))}px system-ui, sans-serif`;
      levels.forEach((v, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = x0 + c * tile;
        const y = y0 + r * tile;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x + gap, y + gap, tile - 2 * gap, tile - 3 * gap);
        // Square number, in a clearly visible grey below the square.
        ctx.fillStyle = dark ? '#8C8C8C' : '#5A5A5A';
        ctx.fillText(String(i + 1), x + tile / 2, y + tile - 2 * gap);
      });
      return;
    }
    case 'text': {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, Math.floor(h / 2), w, Math.ceil(h / 2));
      const sizes = [10, 12, 14, 18, 24, 32];
      const line = 'The quick brown fox jumps over the lazy dog 0123456789';
      let y = 20 * dpr;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (const s of sizes) {
        ctx.font = `${Math.round(s * dpr)}px system-ui, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.fillText(`${s}px  ${line}`, 20 * dpr, y);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${s}px  ${line}`, 20 * dpr, Math.floor(h / 2) + y);
        y += Math.round(s * 1.6 * dpr);
      }
      return;
    }
    case 'motion': {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      const size = Math.round(Math.min(w, h) / 6);
      const period = 4000;
      const p = (t % period) / period;
      const x = Math.round(p * (w + size)) - size;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, Math.round(h / 2 - size / 2), size, size);
      return;
    }
  }
}

export interface ScanOptions {
  direction: 'horizontal' | 'vertical';
  background: 'black' | 'white';
  secondsPerPass: number;
}

/** One frame of the slow scan: a 2-device-pixel line moving across the screen. */
export function drawScan(ctx: CanvasRenderingContext2D, w: number, h: number, o: ScanOptions, elapsedMs: number) {
  const fg = o.background === 'black' ? '#FFFFFF' : '#000000';
  ctx.fillStyle = o.background === 'black' ? '#000000' : '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  const p = Math.max(0, (elapsedMs % (o.secondsPerPass * 1000)) / (o.secondsPerPass * 1000));
  ctx.fillStyle = fg;
  if (o.direction === 'horizontal') ctx.fillRect(0, Math.floor(p * (h - 2)), w, 2);
  else ctx.fillRect(Math.floor(p * (w - 2)), 0, 2, h);
  return p;
}
