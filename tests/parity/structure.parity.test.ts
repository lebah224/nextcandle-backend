/**
 * Parity tests for structure functions
 * (fractals, detectPattern, analyzeCandleStructure, fibonacci, detectSR, pivots, detectStructure).
 */

import { describe, it, expect } from 'vitest';
import { fractals, detectPattern, analyzeCandleStructure } from '../../src/engine/structure/patterns.js';
import { fibonacci, detectSR, pivots } from '../../src/engine/structure/levels.js';
import { detectStructure } from '../../src/engine/structure/market.js';

/* eslint-disable */
// @ts-nocheck
const html_fractals = (cd) => { const n = cd.length - 1; let ufrac = '', dfrac = ''; if (n >= 2) { if (cd[n - 2].high > cd[n - 1].high && cd[n - 2].high > cd[n].high) ufrac = '↑ Fractal H'; if (cd[n - 2].low < cd[n - 1].low && cd[n - 2].low < cd[n].low) dfrac = '↓ Fractal L'; } const txt = ufrac && dfrac ? ufrac + ' ' + dfrac : ufrac || dfrac || '—'; const sig = ufrac ? -1 : dfrac ? 1 : 0; return { sig, txt }; };
const html_fibonacci = (cd) => { const n = 50; const s = cd.slice(-n); const h = Math.max(...s.map(c => c.high)), l = Math.min(...s.map(c => c.low)), price = cd[cd.length - 1].close; const r236 = h - (h - l) * .236, r382 = h - (h - l) * .382, r5 = h - (h - l) * .5, r618 = h - (h - l) * .618; let txt = 'Neutre', sig = 0; if (price > r382 && price < r618) { txt = 'Fib 38-62%'; } else if (price < r618) { txt = '< 61.8%'; sig = -1; } else if (price > r382) { txt = '> 38.2%'; sig = 1; } return { sig, txt, r236, r382, r5, r618 }; };
const html_detectSR = (cd, price) => { const lvl = []; for (let i = 2; i < cd.length - 2; i++) { if (cd[i].high > cd[i - 1].high && cd[i].high > cd[i - 2].high && cd[i].high > cd[i + 1].high && cd[i].high > cd[i + 2].high) lvl.push({ p: cd[i].high, t: 'R' }); if (cd[i].low < cd[i - 1].low && cd[i].low < cd[i - 2].low && cd[i].low < cd[i + 1].low && cd[i].low < cd[i + 2].low) lvl.push({ p: cd[i].low, t: 'S' }); } let near = null, md = Infinity; for (const lv of lvl) { const d = Math.abs(lv.p - price) / price * 100; if (d < md) { md = d; near = lv; } } return { near, dist: md }; };
const html_pivots = (cd) => { const prev = cd[cd.length - 2] || cd[cd.length - 1], pp = (prev.high + prev.low + prev.close) / 3, price = cd[cd.length - 1].close; const r1 = 2 * pp - prev.low, s1 = 2 * pp - prev.high; return { sig: price > r1 ? 1 : price < s1 ? -1 : price > pp ? 1 : -1, txt: `PP:${Math.round(pp)} R1:${Math.round(r1)} S1:${Math.round(s1)}` }; };
const html_detectStructure = (cd) => { const c = cd.slice(-8), hs = c.map(x => x.high), ls = c.map(x => x.low); const hh = hs[hs.length - 1] > Math.max(...hs.slice(0, -1)), hl = ls[ls.length - 1] > Math.min(...ls.slice(0, -1)), ll = ls[ls.length - 1] < Math.min(...ls.slice(0, -1)), lh = hs[hs.length - 1] < Math.max(...hs.slice(0, -1)); if (hh && hl) return { n: 'HH+HL', d: 1 }; if (ll && lh) return { n: 'LL+LH', d: -1 }; return { n: 'Range', d: 0 }; };
const html_detectPattern = (cd) => { if (cd.length < 3) return { n: '—', d: 0, s: 0 }; const [, b, c] = cd.slice(-3), bd = (o, cl) => Math.abs(cl - o), cb = bd(c.open, c.close), cr = c.high - c.low; if (cr < 0.0001) return { n: 'Doji', d: 0, s: 0 }; if (b.close < b.open && c.close > c.open && c.open <= b.close && c.close >= b.open) return { n: 'Engulfing ▲', d: 1, s: 2 }; if (b.close > b.open && c.close < c.open && c.open >= b.close && c.close <= b.open) return { n: 'Engulfing ▼', d: -1, s: 2 }; if (cb / cr < 0.1) return { n: 'Doji', d: 0, s: 0 }; const lw = Math.min(c.open, c.close) - c.low, uw = c.high - Math.max(c.open, c.close); if (lw > 2.5 * cb && uw < 0.4 * cb) return { n: 'Marteau', d: 1, s: 1 }; if (uw > 2.5 * cb && lw < 0.4 * cb && c.close < c.open) return { n: 'Shoot.star', d: -1, s: 1 }; if (c.close > c.open && cb / cr > 0.65) return { n: 'Bougie ▲', d: 1, s: 1 }; if (c.close < c.open && cb / cr > 0.65) return { n: 'Bougie ▼', d: -1, s: 1 }; return { n: 'Indécis', d: 0, s: 0 }; };
const html_analyzeCandleStructure = (cd) => {
  const EMPTY = { score: 0, confidence: 0, patterns: [], dominance: 0.5, mainPattern: '—', dir: 0 };
  if (!cd || cd.length < 5) return EMPTY;
  const safe = (v, fb = 0) => (typeof v === 'number' && isFinite(v)) ? v : fb;
  const cur = cd[cd.length - 1], c1 = cd[cd.length - 2], c2 = cd[cd.length - 3], c3 = cd[cd.length - 4];
  const avgVol = cd.slice(-21, -1).reduce((a, b) => a + (b.vol || 0), 0) / Math.min(20, cd.length - 1) || 1;
  const detected = [];
  (() => {
    const candles = [cur, c1];
    for (const c of candles) {
      if (!c) continue;
      const range = c.high - c.low;
      if (range < 0.001) continue;
      const body = Math.abs(c.close - c.open);
      const bodyRatio = body / range;
      if (bodyRatio > 0.32) continue;
      const upperWick = c.high - Math.max(c.open, c.close);
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const upperR = upperWick / range;
      const lowerR = lowerWick / range;
      const bodyLow = Math.min(c.open, c.close);
      const bodyHigh = Math.max(c.open, c.close);
      if (lowerR >= 0.60 && upperR < 0.25 && bodyLow >= c.low + range * 0.62) {
        let strength = Math.min(1, 0.55 + lowerR * 0.45);
        const prevBear = cd.slice(-6, -1).filter(x => x.close < x.open).length;
        if (prevBear >= 3) strength = Math.min(1, strength * 1.20);
        detected.push({ n: 'Pin Bar ▲', d: 1, strength, detail: `Mèche ${Math.round(lowerR * 100)}% · corps haut` });
        break;
      }
      if (upperR >= 0.60 && lowerR < 0.25 && bodyHigh <= c.low + range * 0.38) {
        let strength = Math.min(1, 0.55 + upperR * 0.45);
        const prevBull = cd.slice(-6, -1).filter(x => x.close > x.open).length;
        if (prevBull >= 3) strength = Math.min(1, strength * 1.20);
        detected.push({ n: 'Pin Bar ▼', d: -1, strength, detail: `Mèche ${Math.round(upperR * 100)}% · corps bas` });
        break;
      }
    }
  })();
  (() => {
    if (!c1 || !c2) return;
    const c1Body = Math.abs(c1.close - c1.open);
    const c2Body = Math.abs(c2.close - c2.open);
    if (c1Body < 0.001 || c2Body < 0.001) return;
    const c1High = Math.max(c1.open, c1.close);
    const c1Low = Math.min(c1.open, c1.close);
    const c2High = Math.max(c2.open, c2.close);
    const c2Low = Math.min(c2.open, c2.close);
    if (c2.close < c2.open && c1.close > c1.open && c1Low <= c2Low && c1High >= c2High) {
      const sizeRatio = c1Body / c2Body;
      const volRatio = (c1.vol || avgVol) / avgVol;
      const hasVol = volRatio >= 1.2;
      const volBonus = volRatio >= 1.8 ? 0.20 : volRatio >= 1.4 ? 0.12 : volRatio >= 1.2 ? 0.06 : 0;
      const strength = Math.min(1, 0.55 + Math.min(0.25, sizeRatio * 0.12) + volBonus);
      detected.push({ n: `Engulfing ▲${hasVol ? ' + Vol' : ''}`, d: 1, strength, detail: `Corps ${sizeRatio.toFixed(1)}× · Vol ${volRatio.toFixed(1)}×` });
    } else if (c2.close > c2.open && c1.close < c1.open && c1Low <= c2Low && c1High >= c2High) {
      const sizeRatio = c1Body / c2Body;
      const volRatio = (c1.vol || avgVol) / avgVol;
      const hasVol = volRatio >= 1.2;
      const volBonus = volRatio >= 1.8 ? 0.20 : volRatio >= 1.4 ? 0.12 : volRatio >= 1.2 ? 0.06 : 0;
      const strength = Math.min(1, 0.55 + Math.min(0.25, sizeRatio * 0.12) + volBonus);
      detected.push({ n: `Engulfing ▼${hasVol ? ' + Vol' : ''}`, d: -1, strength, detail: `Corps ${sizeRatio.toFixed(1)}× · Vol ${volRatio.toFixed(1)}×` });
    }
  })();
  (() => {
    if (!c1 || !c2 || !c3) return;
    if (c2.high >= c3.high || c2.low <= c3.low) return;
    const breakRange = c1.high - c1.low;
    if (breakRange < 0.001) return;
    const breakBody = Math.abs(c1.close - c1.open);
    const bodyRatio = breakBody / breakRange;
    if (bodyRatio < 0.45) return;
    const motherRange = c3.high - c3.low || 1;
    if (c1.close > c3.high && c1.close > c1.open) {
      const overshoot = (c1.close - c3.high) / motherRange;
      const strength = Math.min(1, 0.60 + Math.min(0.30, overshoot * 3) + Math.min(0.10, bodyRatio - 0.45));
      detected.push({ n: 'Inside Bar ▲', d: 1, strength, detail: `Break +${(overshoot * 100).toFixed(1)}% · corps ${Math.round(bodyRatio * 100)}%` });
    } else if (c1.close < c3.low && c1.close < c1.open) {
      const overshoot = (c3.low - c1.close) / motherRange;
      const strength = Math.min(1, 0.60 + Math.min(0.30, overshoot * 3) + Math.min(0.10, bodyRatio - 0.45));
      detected.push({ n: 'Inside Bar ▼', d: -1, strength, detail: `Break -${(overshoot * 100).toFixed(1)}% · corps ${Math.round(bodyRatio * 100)}%` });
    }
  })();
  const range = cur.high - cur.low || 1;
  const lowerWick = Math.min(cur.open, cur.close) - cur.low;
  const upperWick = cur.high - Math.max(cur.open, cur.close);
  const dominance = safe(0.5 + (lowerWick - upperWick) / (range * 2));
  if (!detected.length) {
    const domScore = (dominance - 0.5) * 0.4;
    return { score: safe(domScore), confidence: 0, patterns: [], dominance: safe(dominance, 0.5), mainPattern: '—', dir: 0 };
  }
  let bullW = 0, bearW = 0;
  detected.forEach(p => { if (p.d > 0) bullW += p.strength; else if (p.d < 0) bearW += p.strength; });
  const total = bullW + bearW || 1;
  const rawScore = (bullW - bearW) / total;
  const allBull = detected.every(p => p.d > 0);
  const allBear = detected.every(p => p.d < 0);
  const avgStr = detected.reduce((a, p) => a + p.strength, 0) / detected.length;
  const confidence = Math.round(Math.min(100, avgStr * 65 + (allBull || allBear ? 20 : 0) + (detected.length > 1 ? 10 : 0) + Math.abs(dominance - 0.5) * 10));
  const mainP = detected.sort((a, b) => b.strength - a.strength)[0];
  const dir = rawScore > 0.12 ? 1 : rawScore < -0.12 ? -1 : 0;
  return { score: Math.max(-1, Math.min(1, safe(rawScore))), confidence, patterns: detected, dominance: safe(dominance, 0.5), mainPattern: mainP.n, mainDetail: mainP.detail || '', dir };
};
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

const CD = makeCandles(23);

describe('PARITY — structure functions match HTML byte-for-byte', () => {
  describe('fractals', () => {
    it('matches HTML', () => {
      expect(fractals(CD)).toEqual(html_fractals(CD));
    });
    it('short data returns dash', () => {
      expect(fractals(CD.slice(0, 2))).toEqual(html_fractals(CD.slice(0, 2)));
    });
  });

  describe('detectPattern', () => {
    it('matches HTML', () => {
      expect(detectPattern(CD)).toEqual(html_detectPattern(CD));
    });
    it('short data', () => {
      expect(detectPattern(CD.slice(0, 2))).toEqual(html_detectPattern(CD.slice(0, 2)));
    });
    // Test multiple windows to hit different branches
    for (let start = 0; start <= 70; start += 5) {
      it(`matches HTML on window [${start}:${start + 10}]`, () => {
        const sub = CD.slice(start, start + 10);
        expect(detectPattern(sub)).toEqual(html_detectPattern(sub));
      });
    }
  });

  describe('analyzeCandleStructure', () => {
    it('matches HTML', () => {
      const a = analyzeCandleStructure(CD);
      const b = html_analyzeCandleStructure(CD);
      expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
      expect(a.confidence).toBe(b.confidence);
      expect(a.dir).toBe(b.dir);
      expect(a.mainPattern).toBe(b.mainPattern);
      expect(Math.abs(a.dominance - b.dominance)).toBeLessThan(PARITY_TOL);
      expect(a.patterns.length).toBe(b.patterns.length);
    });
    it('short data returns EMPTY', () => {
      expect(analyzeCandleStructure(CD.slice(0, 4))).toEqual(html_analyzeCandleStructure(CD.slice(0, 4)));
    });
    // Multiple seeds for branch coverage
    [3, 7, 31, 42, 99].forEach((seed) => {
      it(`matches HTML on seed=${seed}`, () => {
        const data = makeCandles(seed);
        const a = analyzeCandleStructure(data);
        const b = html_analyzeCandleStructure(data);
        expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
        expect(a.confidence).toBe(b.confidence);
        expect(a.dir).toBe(b.dir);
        expect(a.mainPattern).toBe(b.mainPattern);
      });
    });
  });

  describe('fibonacci', () => {
    it('matches HTML', () => {
      const a = fibonacci(CD);
      const b = html_fibonacci(CD);
      expect(a.sig).toBe(b.sig);
      expect(a.txt).toBe(b.txt);
      expect(Math.abs(a.r236 - b.r236)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.r382 - b.r382)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.r5 - b.r5)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.r618 - b.r618)).toBeLessThan(PARITY_TOL);
    });
  });

  describe('detectSR', () => {
    const price = CD[CD.length - 1]!.close;
    it('matches HTML', () => {
      const a = detectSR(CD, price);
      const b = html_detectSR(CD, price);
      expect(a.near).toEqual(b.near);
      expect(Math.abs(a.dist - b.dist)).toBeLessThan(PARITY_TOL);
    });
  });

  describe('pivots', () => {
    it('matches HTML', () => {
      expect(pivots(CD)).toEqual(html_pivots(CD));
    });
  });

  describe('detectStructure', () => {
    it('matches HTML', () => {
      expect(detectStructure(CD)).toEqual(html_detectStructure(CD));
    });
    // Test multiple windows for HH+HL / LL+LH / Range branches
    [10, 25, 40, 60, 73].forEach((end) => {
      it(`matches HTML on slice [:${end}]`, () => {
        const sub = CD.slice(0, end);
        expect(detectStructure(sub)).toEqual(html_detectStructure(sub));
      });
    });
  });
});
