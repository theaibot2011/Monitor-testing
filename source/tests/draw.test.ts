import { describe, expect, it } from 'vitest';
import { deviceSize, gradientLevel, pack } from '../src/lib/draw';
import { estimateMinutes, pct, rgbHex } from '../src/lib/catalogue';

describe('drawing maths', () => {
  it('rounds canvas size for fractional scaling', () => {
    expect(deviceSize(1536, 864, 1.25)).toEqual({ w: 1920, h: 1080 });
    expect(deviceSize(1280, 721, 1.5)).toEqual({ w: 1920, h: 1082 });
    expect(deviceSize(1366.4, 768, 1)).toEqual({ w: 1366, h: 768 });
  });
  it('gradient covers 0 to 255 monotonically with steps of at most 1', () => {
    for (const w of [256, 1920, 2560, 3440, 3840]) {
      let prev = -1;
      for (let x = 0; x < w; x++) {
        const v = gradientLevel(x, w);
        expect(v - prev).toBeGreaterThanOrEqual(0);
        if (prev >= 0) expect(v - prev).toBeLessThanOrEqual(1);
        prev = v;
      }
      expect(gradientLevel(0, w)).toBe(0);
      expect(gradientLevel(w - 1, w)).toBe(255);
    }
  });
  it('packs pixels in canvas byte order (R, G, B, A in memory)', () => {
    const bytes = new Uint8Array(new Uint32Array([pack(1, 2, 3)]).buffer);
    expect([...bytes]).toEqual([1, 2, 3, 255]);
  });
  it('1% and 2% channel levels are exact 8-bit values', () => {
    expect(pct(1)).toBe(3);
    expect(pct(2)).toBe(5);
    expect(rgbHex(pct(1), 0, 0)).toBe('#030000');
  });
  it('time estimate is realistic (the check is detailed, not quick)', () => {
    expect(estimateMinutes('buying')).toBeGreaterThanOrEqual(20);
    expect(estimateMinutes('repair')).toBeGreaterThan(estimateMinutes('buying'));
  });
});
