/**
 * Parity tests for batch 2.2 PURE functions:
 *   detectSwings, detectMarketStructure, detectFVG,
 *   computeVolumeProfile, computeVolumeAbsorption.
 *
 * HTML reference embedded VERBATIM. Tolerance 1e-9 on numeric outputs.
 */

import { describe, it, expect } from 'vitest';
import { detectSwings, detectMarketStructure } from '../../src/engine/structure/swings.js';
import { detectFVG } from '../../src/engine/structure/fvg.js';
import { computeVolumeProfile } from '../../src/engine/flow/volume-profile.js';
import { computeVolumeAbsorption } from '../../src/engine/flow/volume-absorption.js';

// ════════════════════════════════════════════════════════════════════════
//  HTML REFERENCE — verbatim from candleIndex2.html.
// ════════════════════════════════════════════════════════════════════════
/* eslint-disable */
// @ts-nocheck
const html_detectSwings = (cd, lb = 3) => { const sh = [], sl = []; const n = cd.length; for (let i = lb; i < n - lb; i++) { let isSH = true, isSL = true; for (let j = i - lb; j <= i + lb; j++) { if (j === i) continue; if (cd[j].high >= cd[i].high) isSH = false; if (cd[j].low <= cd[i].low) isSL = false; } if (isSH) sh.push({ i, price: cd[i].high }); if (isSL) sl.push({ i, price: cd[i].low }); } return { sh, sl }; };
const html_detectMarketStructure = (cd, lb = 3) => { if (!cd || cd.length < lb * 2 + 5) return { dir: 0, msb: 0, choch: false, label: '—', swingH: null, swingL: null }; const { sh, sl } = html_detectSwings(cd, lb); const cur = cd[cd.length - 1].close; const swingH = sh.length ? sh[sh.length - 1] : null; const swingL = sl.length ? sl[sl.length - 1] : null; if (sh.length < 2 || sl.length < 2) { const msb = swingH && cur > swingH.price ? 1 : swingL && cur < swingL.price ? -1 : 0; return { dir: 0, msb, choch: false, label: '—', swingH, swingL }; } const lH = sh[sh.length - 1], pH = sh[sh.length - 2]; const lL = sl[sl.length - 1], pL = sl[sl.length - 2]; const hhhl = lH.price > pH.price && lL.price > pL.price; const lhll = lH.price < pH.price && lL.price < pL.price; const bullMSB = cur > lH.price; const bearMSB = cur < lL.price; const msb = bullMSB ? 1 : bearMSB ? -1 : 0; const choch = (lhll && bullMSB) || (hhhl && bearMSB); const dir = hhhl ? 1 : lhll ? -1 : 0; const label = hhhl ? 'HH/HL' : lhll ? 'LH/LL' : 'Mixte'; return { dir, msb, choch, label, swingH: lH, swingL: lL }; };
const html_detectFVG = (cd) => { if (!cd || cd.length < 5) return { bullish: [], bearish: [], score: 0, dir: 0, nearBull: null, nearBear: null }; const price = cd[cd.length - 1].close; const bullFVGs = [], bearFVGs = []; const lookback = Math.min(50, cd.length - 2); for (let i = 2; i < lookback; i++) { const c1 = cd[cd.length - 1 - i], c2 = cd[cd.length - 2 - i], c3 = cd[cd.length - 3 - i]; if (c1 && c2 && c3 && c1.low > c3.high) { const mid = (c1.low + c3.high) / 2, size = (c1.low - c3.high) / c3.high * 100; if (size > 0.05 && !bullFVGs.some(f => Math.abs(f.mid - mid) / mid < 0.002)) bullFVGs.push({ top: c1.low, bot: c3.high, mid, size, filled: price < c3.high }); } if (c1 && c2 && c3 && c1.high < c3.low) { const mid = (c1.high + c3.low) / 2, size = (c3.low - c1.high) / c3.low * 100; if (size > 0.05 && !bearFVGs.some(f => Math.abs(f.mid - mid) / mid < 0.002)) bearFVGs.push({ top: c3.low, bot: c1.high, mid, size, filled: price > c1.high }); } } const activeBull = bullFVGs.filter(f => !f.filled), activeBear = bearFVGs.filter(f => !f.filled); const nearBull = activeBull.sort((a, b) => Math.abs(a.mid - price) - Math.abs(b.mid - price))[0] || null; const nearBear = activeBear.sort((a, b) => Math.abs(a.mid - price) - Math.abs(b.mid - price))[0] || null; let score = 0; if (nearBull) { const d = (price - nearBull.top) / price * 100; if (price > nearBull.top) score += d < 1 ? 0.7 : d < 2 ? 0.4 : 0.2; else score += d < 1 ? 0.5 : d < 2 ? 0.3 : 0.1; } if (nearBear) { const d = (nearBear.bot - price) / price * 100; if (price < nearBear.bot) score -= d < 1 ? 0.7 : d < 2 ? 0.4 : 0.2; else score -= d < 1 ? 0.5 : d < 2 ? 0.3 : 0.1; } const dir = score > 0.15 ? 1 : score < -0.15 ? -1 : 0; return { bullish: activeBull, bearish: activeBear, score: Math.max(-1, Math.min(1, score)), dir, nearBull, nearBear }; };
const html_computeVolumeProfile = (cd, analysisTF) => { const N = Math.min(200, cd.length), sl = cd.slice(-N); if (!sl.length) return { poc: 0, vah: 0, val: 0, loaded: false }; const lo = Math.min(...sl.map(c => c.low)), hi = Math.max(...sl.map(c => c.high)), range = hi - lo || 1; const BINS = analysisTF === 'h1' ? 200 : 100; const bins = new Array(BINS).fill(0); sl.forEach(c => { const b = Math.min(BINS - 1, Math.floor((c.close - lo) / range * BINS)); bins[b] += (c.vol || 0); }); const pocBin = bins.indexOf(Math.max(...bins)), poc = lo + pocBin / BINS * range; const totalVol = bins.reduce((a, b) => a + b, 1), target = totalVol * 0.70; let accum = bins[pocBin], low = pocBin, high = pocBin; while (accum < target && (low > 0 || high < BINS - 1)) { const vl = low > 0 ? bins[low - 1] : 0, vh = high < BINS - 1 ? bins[high + 1] : 0; if (vl >= vh && low > 0) { accum += vl; low--; } else if (high < BINS - 1) { accum += vh; high++; } else break; } return { poc, vah: lo + high / BINS * range, val: lo + low / BINS * range, loaded: true }; };
const html_computeVolumeAbsorption = (cd) => { if (!cd || cd.length < 25) return { score: 0, dir: 0, signal: '—' }; const avgVol = cd.slice(-21, -1).reduce((a, b) => a + (b.vol || 0), 0) / 20 || 1; const avgRange = cd.slice(-21, -1).reduce((a, b) => a + (b.high - b.low), 0) / 20 || 1; const c = cd[cd.length - 1]; const c1 = cd[cd.length - 2]; const volRatio = (c1.vol || 0) / avgVol; const rangeRatio = (c1.high - c1.low) / avgRange; if (volRatio < 2.0 || rangeRatio > 0.40) return { score: 0, dir: 0, signal: '—' }; const isBearCandle = c1.close < c1.open; const bodyRatio = Math.abs(c1.close - c1.open) / (c1.high - c1.low || 1); let score = 0, signal = '—'; const strength = Math.min(1, (volRatio - 2) * 0.3) * (1 - rangeRatio); if (isBearCandle && bodyRatio < 0.35) { score = strength * 0.75; signal = `Absorption haussière (Vol ${volRatio.toFixed(1)}×)`; } else if (!isBearCandle && bodyRatio < 0.35) { score = -strength * 0.75; signal = `Absorption baissière (Vol ${volRatio.toFixed(1)}×)`; } score = Math.max(-1, Math.min(1, score)); return { score, dir: score > 0.10 ? 1 : score < -0.10 ? -1 : 0, signal }; };
/* eslint-enable */

const PARITY_TOL = 1e-9;

function makeCandles(seed = 1, n = 80) {
  let r = seed;
  const rand = (): number => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
  const out: Array<{ open: number; high: number; low: number; close: number; vol: number }> = [];
  let price = 60000;
  for (let i = 0; i < n; i++) {
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

// Volume-absorption needs a "designed" absorption candle to exercise non-zero branches
function makeAbsorbCandles(seed = 1, lastBear = true) {
  const data = makeCandles(seed, 30);
  // Force last-closed (c1 = data[28]) to be a high-volume small-range candle
  const c1 = data[28]!;
  const avgRange = data.slice(-21, -1).reduce((a, b) => a + (b.high - b.low), 0) / 20;
  const avgVol = data.slice(-21, -1).reduce((a, b) => a + (b.vol || 0), 0) / 20;
  c1.vol = avgVol * 3.5; // 3.5× normal volume
  const newRange = avgRange * 0.25; // 25% of normal range
  const mid = (c1.high + c1.low) / 2;
  c1.high = mid + newRange / 2;
  c1.low = mid - newRange / 2;
  if (lastBear) {
    c1.open = mid + newRange * 0.3;
    c1.close = mid - newRange * 0.3;
  } else {
    c1.open = mid - newRange * 0.3;
    c1.close = mid + newRange * 0.3;
  }
  return data;
}

describe('PARITY — batch 2.2 pure structure & flow functions', () => {
  describe('detectSwings', () => {
    [3, 5, 2].forEach((lb) => {
      it(`lb=${lb} matches HTML`, () => {
        const cd = makeCandles(7, 120);
        expect(detectSwings(cd, lb)).toEqual(html_detectSwings(cd, lb));
      });
    });
    [3, 11, 23, 47].forEach((seed) => {
      it(`matches HTML on seed=${seed}`, () => {
        const cd = makeCandles(seed, 80);
        expect(detectSwings(cd)).toEqual(html_detectSwings(cd));
      });
    });
  });

  describe('detectMarketStructure', () => {
    it('matches HTML on full data', () => {
      const cd = makeCandles(7, 120);
      expect(detectMarketStructure(cd)).toEqual(html_detectMarketStructure(cd));
    });
    [3, 11, 23, 47, 99, 137].forEach((seed) => {
      it(`matches HTML on seed=${seed}`, () => {
        const cd = makeCandles(seed, 100);
        expect(detectMarketStructure(cd)).toEqual(html_detectMarketStructure(cd));
      });
    });
    it('short-data branch returns early', () => {
      const cd = makeCandles(7, 8);
      expect(detectMarketStructure(cd)).toEqual(html_detectMarketStructure(cd));
    });
    it('single-swing branch (no two swings) matches', () => {
      // Carefully crafted small dataset that yields <2 swings
      const cd = makeCandles(7, 15);
      expect(detectMarketStructure(cd)).toEqual(html_detectMarketStructure(cd));
    });
    [2, 5].forEach((lb) => {
      it(`with lb=${lb} matches HTML`, () => {
        const cd = makeCandles(7, 100);
        expect(detectMarketStructure(cd, lb)).toEqual(html_detectMarketStructure(cd, lb));
      });
    });
  });

  describe('detectFVG', () => {
    [7, 11, 23, 47, 99].forEach((seed) => {
      it(`matches HTML on seed=${seed}`, () => {
        const cd = makeCandles(seed, 80);
        const a = detectFVG(cd);
        const b = html_detectFVG(cd);
        expect(a.dir).toBe(b.dir);
        expect(a.bullish.length).toBe(b.bullish.length);
        expect(a.bearish.length).toBe(b.bearish.length);
        expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
        if (a.nearBull && b.nearBull) {
          expect(Math.abs(a.nearBull.mid - b.nearBull.mid)).toBeLessThan(PARITY_TOL);
        } else {
          expect(a.nearBull).toEqual(b.nearBull);
        }
        if (a.nearBear && b.nearBear) {
          expect(Math.abs(a.nearBear.mid - b.nearBear.mid)).toBeLessThan(PARITY_TOL);
        } else {
          expect(a.nearBear).toEqual(b.nearBear);
        }
      });
    });
    it('short data returns empty', () => {
      const cd = makeCandles(7, 3);
      expect(detectFVG(cd)).toEqual(html_detectFVG(cd));
    });
  });

  describe('computeVolumeProfile', () => {
    (['m5', 'm15', 'h1'] as const).forEach((tf) => {
      [7, 11, 23].forEach((seed) => {
        it(`tf=${tf} seed=${seed} matches HTML`, () => {
          const cd = makeCandles(seed, 150);
          const a = computeVolumeProfile(cd, tf);
          const b = html_computeVolumeProfile(cd, tf);
          expect(a.loaded).toBe(b.loaded);
          expect(Math.abs(a.poc - b.poc)).toBeLessThan(PARITY_TOL);
          expect(Math.abs(a.vah - b.vah)).toBeLessThan(PARITY_TOL);
          expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        });
      });
    });
    it('empty data matches', () => {
      expect(computeVolumeProfile([], 'm15')).toEqual(html_computeVolumeProfile([], 'm15'));
    });
  });

  describe('computeVolumeAbsorption', () => {
    it('matches HTML on plain data', () => {
      const cd = makeCandles(7, 80);
      expect(computeVolumeAbsorption(cd)).toEqual(html_computeVolumeAbsorption(cd));
    });
    it('matches HTML on bull-absorption (high-vol small-range bear candle)', () => {
      const cd = makeAbsorbCandles(7, true);
      const a = computeVolumeAbsorption(cd);
      const b = html_computeVolumeAbsorption(cd);
      expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
      expect(a.dir).toBe(b.dir);
      expect(a.signal).toBe(b.signal);
    });
    it('matches HTML on bear-absorption (high-vol small-range bull candle)', () => {
      const cd = makeAbsorbCandles(11, false);
      const a = computeVolumeAbsorption(cd);
      const b = html_computeVolumeAbsorption(cd);
      expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
      expect(a.dir).toBe(b.dir);
      expect(a.signal).toBe(b.signal);
    });
    it('short data', () => {
      const cd = makeCandles(7, 20);
      expect(computeVolumeAbsorption(cd)).toEqual(html_computeVolumeAbsorption(cd));
    });
  });
});
