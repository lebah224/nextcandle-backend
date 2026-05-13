/**
 * Inline parity tests — embed the HTML reference code verbatim and verify
 * the TS port produces IDENTICAL output (max diff < 1e-9).
 *
 * If these tests fail, the port has drifted from the HTML reference and the
 * Oracle will produce different scores. This is a BLOCKER for migration.
 */

import { describe, it, expect } from 'vitest';
import { ema, sma, wma, hma, dema, tema, alma } from '../../src/engine/indicators/moving-avg.js';

// ════════════════════════════════════════════════════════════════════════
//  HTML reference code — copied VERBATIM from candleIndex2.html
//  Lines 10551-10559. DO NOT MODIFY. Update only when HTML reference updates.
// ════════════════════════════════════════════════════════════════════════
/* eslint-disable */
// @ts-nocheck
const html_ema = (a, p) => { if (a.length < p) return a.map(() => 0); const k = 2 / (p + 1); let v = a.slice(0, p).reduce((x, y) => x + y) / p; const r = Array(p - 1).fill(0).concat([v]); for (let i = p; i < a.length; i++) { v = a[i] * k + v * (1 - k); r.push(v); } return r; };
const html_wma = (a, p) => { const r = []; for (let i = p - 1; i < a.length; i++) { let s = 0, w = 0; for (let j = 0; j < p; j++) { s += a[i - j] * (p - j); w += (p - j); } r.push(s / w); } return r; };
const html_sma = (a, p) => { const r = []; for (let i = p - 1; i < a.length; i++) r.push(a.slice(i - p + 1, i + 1).reduce((x, y) => x + y) / p); return r; };
const html_hma = (a, p) => { const sq = Math.round(Math.sqrt(p)), h = Math.floor(p / 2), w1 = html_wma(a, h), w2 = html_wma(a, p), l = Math.min(w1.length, w2.length); return html_wma(Array.from({ length: l }, (_, i) => 2 * w1[w1.length - l + i] - w2[w2.length - l + i]), sq); };
const html_dema = (a, p) => { const e1 = html_ema(a, p), e2 = html_ema(e1, p), l = Math.min(e1.length, e2.length); return Array.from({ length: l }, (_, i) => 2 * e1[e1.length - l + i] - e2[e2.length - l + i]); };
const html_tema = (a, p) => { const e1 = html_ema(a, p), e2 = html_ema(e1, p), e3 = html_ema(e2, p), l = Math.min(e1.length, e2.length, e3.length); return Array.from({ length: l }, (_, i) => 3 * e1[e1.length - l + i] - 3 * e2[e2.length - l + i] + e3[e3.length - l + i]); };
const html_alma = (a, p, off = 0.85, sig = 6) => { const r = []; for (let i = p - 1; i < a.length; i++) { const sl = a.slice(i - p + 1, i + 1), m = Math.floor(off * (p - 1)), d = p / sig / sig; let s = 0, sw = 0; for (let j = 0; j < p; j++) { const jm = j - m, w = Math.exp(-(jm * jm) / (2 * d)); s += sl[j] * w; sw += w; } r.push(sw ? s / sw : 0); } return r; };
/* eslint-enable */

const PARITY_TOLERANCE = 1e-9;

const BTC_M5_60 = [
  62450.5, 62480.2, 62445.8, 62498.3, 62520.1, 62488.9, 62445.2, 62512.7, 62534.6, 62556.8,
  62543.2, 62578.9, 62601.4, 62589.7, 62612.3, 62625.8, 62598.4, 62634.5, 62655.7, 62641.2,
  62687.3, 62701.5, 62689.8, 62712.4, 62734.1, 62718.6, 62745.9, 62763.2, 62751.4, 62778.5,
  62795.8, 62812.4, 62798.6, 62823.1, 62845.7, 62831.2, 62856.8, 62874.5, 62891.3, 62878.9,
  62904.2, 62921.5, 62909.7, 62934.1, 62951.8, 62938.4, 62965.6, 62982.3, 62971.5, 62997.8,
  63015.2, 63002.4, 63028.7, 63044.9, 63031.5, 63057.2, 63075.8, 63062.3, 63089.6, 63105.4,
];

function maxDiff(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return Infinity;
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    if (d > max) max = d;
  }
  return max;
}

describe('PARITY — moving averages match HTML reference byte-for-byte', () => {
  describe('ema', () => {
    [5, 9, 12, 14, 21, 26, 50].forEach((p) => {
      it(`ema(p=${p}) matches`, () => {
        expect(maxDiff(ema(BTC_M5_60, p), html_ema(BTC_M5_60, p))).toBeLessThan(PARITY_TOLERANCE);
      });
    });
    it('ema(p=1) matches (degenerate)', () => {
      expect(maxDiff(ema(BTC_M5_60, 1), html_ema(BTC_M5_60, 1))).toBeLessThan(PARITY_TOLERANCE);
    });
    it('ema empty array matches', () => {
      expect(ema([], 5)).toEqual(html_ema([], 5));
    });
    it('ema length < period matches', () => {
      expect(ema([1, 2, 3], 5)).toEqual(html_ema([1, 2, 3], 5));
    });
  });

  describe('sma', () => {
    [5, 9, 14, 21, 50].forEach((p) => {
      it(`sma(p=${p}) matches`, () => {
        expect(maxDiff(sma(BTC_M5_60, p), html_sma(BTC_M5_60, p))).toBeLessThan(PARITY_TOLERANCE);
      });
    });
  });

  describe('wma', () => {
    [5, 9, 14, 21, 50].forEach((p) => {
      it(`wma(p=${p}) matches`, () => {
        expect(maxDiff(wma(BTC_M5_60, p), html_wma(BTC_M5_60, p))).toBeLessThan(PARITY_TOLERANCE);
      });
    });
  });

  describe('hma', () => {
    [5, 9, 14, 21].forEach((p) => {
      it(`hma(p=${p}) matches`, () => {
        expect(maxDiff(hma(BTC_M5_60, p), html_hma(BTC_M5_60, p))).toBeLessThan(PARITY_TOLERANCE);
      });
    });
  });

  describe('dema', () => {
    [5, 9, 14, 21].forEach((p) => {
      it(`dema(p=${p}) matches`, () => {
        expect(maxDiff(dema(BTC_M5_60, p), html_dema(BTC_M5_60, p))).toBeLessThan(PARITY_TOLERANCE);
      });
    });
  });

  describe('tema', () => {
    [5, 9, 14, 21].forEach((p) => {
      it(`tema(p=${p}) matches`, () => {
        expect(maxDiff(tema(BTC_M5_60, p), html_tema(BTC_M5_60, p))).toBeLessThan(PARITY_TOLERANCE);
      });
    });
  });

  describe('alma', () => {
    [9, 14, 21].forEach((p) => {
      it(`alma(p=${p}, default) matches`, () => {
        expect(maxDiff(alma(BTC_M5_60, p), html_alma(BTC_M5_60, p))).toBeLessThan(PARITY_TOLERANCE);
      });
      it(`alma(p=${p}, off=0.5, sig=4) matches`, () => {
        expect(maxDiff(alma(BTC_M5_60, p, 0.5, 4), html_alma(BTC_M5_60, p, 0.5, 4))).toBeLessThan(
          PARITY_TOLERANCE,
        );
      });
    });
  });
});
