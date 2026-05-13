/**
 * Parity tests for volatility indicators (atr, bb, keltner, donchian).
 */

import { describe, it, expect } from 'vitest';
import { atr, bb, keltner, donchian } from '../../src/engine/indicators/volatility.js';

/* eslint-disable */
// @ts-nocheck
const html_ema = (a, p) => { if (a.length < p) return a.map(() => 0); const k = 2 / (p + 1); let v = a.slice(0, p).reduce((x, y) => x + y) / p; const r = Array(p - 1).fill(0).concat([v]); for (let i = p; i < a.length; i++) { v = a[i] * k + v * (1 - k); r.push(v); } return r; };
const html_L = (a) => a[a.length - 1] ?? 0;

const html_atr = (cd, p = 14) => { const tr = []; for (let i = 1; i < cd.length; i++) { const h = cd[i].high, l = cd[i].low, pc = cd[i - 1].close; tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))); } return tr.slice(-p).reduce((a, b) => a + b, 0) / Math.min(p, tr.length) || 0; };
const html_bb = (c, p = 20) => { const s = c.slice(-p), m = s.reduce((a, b) => a + b) / p, std = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / p); return { upper: m + 2 * std, lower: m - 2 * std, mid: m, bw: 4 * std / m * 100 }; };
const html_keltner = (cd, p = 20) => { const c = cd.map(x => x.close), e = html_ema(c, p), a = html_atr(cd, p); return { upper: html_L(e) + 2 * a, lower: html_L(e) - 2 * a, mid: html_L(e) }; };
const html_donchian = (cd, p = 20) => { const s = cd.slice(-p); return { upper: Math.max(...s.map(c => c.high)), lower: Math.min(...s.map(c => c.low)) }; };
/* eslint-enable */

const PARITY_TOL = 1e-9;

function makeCandles(seed = 1) {
  let r = seed;
  const rand = (): number => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const out: Array<{ open: number; high: number; low: number; close: number; vol: number }> = [];
  let price = 60000;
  for (let i = 0; i < 80; i++) {
    const o = price;
    const drift = (rand() - 0.48) * 80;
    const c = o + drift;
    const range = 30 + rand() * 50;
    const h = Math.max(o, c) + rand() * range;
    const l = Math.min(o, c) - rand() * range;
    out.push({ open: o, high: h, low: l, close: c, vol: 100 + rand() * 200 });
    price = c;
  }
  return out;
}

const CD = makeCandles(13);
const CLOSES = CD.map((c) => c.close);

describe('PARITY — volatility indicators match HTML byte-for-byte', () => {
  describe('atr', () => {
    [14, 7, 21, 50].forEach((p) => {
      it(`atr(p=${p}) matches`, () => {
        expect(Math.abs(atr(CD, p) - html_atr(CD, p))).toBeLessThan(PARITY_TOL);
      });
    });
  });

  describe('bb', () => {
    [20, 14, 30].forEach((p) => {
      it(`bb(p=${p}) matches`, () => {
        const a = bb(CLOSES, p);
        const b = html_bb(CLOSES, p);
        expect(Math.abs(a.upper - b.upper)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.lower - b.lower)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.mid - b.mid)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.bw - b.bw)).toBeLessThan(PARITY_TOL);
      });
    });
  });

  describe('keltner', () => {
    [20, 14].forEach((p) => {
      it(`keltner(p=${p}) matches`, () => {
        const a = keltner(CD, p);
        const b = html_keltner(CD, p);
        expect(Math.abs(a.upper - b.upper)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.lower - b.lower)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.mid - b.mid)).toBeLessThan(PARITY_TOL);
      });
    });
  });

  describe('donchian', () => {
    [20, 14, 50].forEach((p) => {
      it(`donchian(p=${p}) matches`, () => {
        const a = donchian(CD, p);
        const b = html_donchian(CD, p);
        expect(a.upper).toBe(b.upper);
        expect(a.lower).toBe(b.lower);
      });
    });
  });
});
