/**
 * Parity tests for momentum indicators (cci, willR, uo, tsi, aoOsc, mom, roc,
 * trix, aroon, fisher, dpo, cmo, rvi, rsi, stochRsi, stochKD).
 *
 * HTML reference embedded VERBATIM from candleIndex2.html.
 */

import { describe, it, expect } from 'vitest';
import {
  rsi,
  stochRsi,
  stochKD,
  cci,
  willR,
  uo,
  tsi,
  aoOsc,
  mom,
  roc,
  trix,
  aroon,
  fisher,
  dpo,
  cmo,
  rvi,
} from '../../src/engine/indicators/momentum.js';

// ════════════════════════════════════════════════════════════════════════
//  HTML REFERENCE — verbatim from candleIndex2.html lines 10551-10597.
// ════════════════════════════════════════════════════════════════════════
/* eslint-disable */
// @ts-nocheck
const html_ema = (a, p) => { if (a.length < p) return a.map(() => 0); const k = 2 / (p + 1); let v = a.slice(0, p).reduce((x, y) => x + y) / p; const r = Array(p - 1).fill(0).concat([v]); for (let i = p; i < a.length; i++) { v = a[i] * k + v * (1 - k); r.push(v); } return r; };
const html_sma = (a, p) => { const r = []; for (let i = p - 1; i < a.length; i++) r.push(a.slice(i - p + 1, i + 1).reduce((x, y) => x + y) / p); return r; };
const html_L = (a) => a[a.length - 1] ?? 0;

const html_rsi = (c, p = 14) => { if (c.length < p + 1) return 50; let g = 0, l = 0; for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; d > 0 ? g += d : l -= d; } let ag = g / p, al = l / p; for (let i = p + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; ag = (ag * (p - 1) + Math.max(d, 0)) / p; al = (al * (p - 1) + Math.max(-d, 0)) / p; } return al === 0 ? 100 : 100 - 100 / (1 + ag / al); };
const html_stochRsi = (c) => { const ra = []; for (let i = 14; i < c.length; i++) ra.push(html_rsi(c.slice(0, i + 1))); if (ra.length < 14) return { k: 50, d: 50 }; const kR = []; for (let i = 13; i < ra.length; i++) { const s = ra.slice(i - 13, i + 1), mn = Math.min(...s), mx = Math.max(...s); kR.push(mx === mn ? 50 : (ra[i] - mn) / (mx - mn) * 100); } const ks = html_sma(kR, 3), ds = html_sma(ks, 3); return { k: html_L(ks) ?? 50, d: html_L(ds) ?? 50 }; };
const html_stochKD = (cd, kp = 14) => { const kA = []; for (let i = kp - 1; i < cd.length; i++) { const s = cd.slice(i - kp + 1, i + 1), h = Math.max(...s.map(c => c.high)), l = Math.min(...s.map(c => c.low)); kA.push(h === l ? 50 : (cd[i].close - l) / (h - l) * 100); } const ks = html_sma(kA, 3), ds = html_sma(ks, 3); return { k: html_L(ks) ?? 50, d: html_L(ds) ?? 50 }; };
const html_cci = (cd, p = 20) => { const tp = cd.map(c => (c.high + c.low + c.close) / 3), sl = tp.slice(-p), m = sl.reduce((a, b) => a + b) / p, md = sl.reduce((a, b) => a + Math.abs(b - m), 0) / p, val = md === 0 ? 0 : (tp[tp.length - 1] - m) / (0.015 * md); return { val, sig: val > 100 ? 1 : val < -100 ? -1 : 0 }; };
const html_willR = (cd, p = 14) => { const s = cd.slice(-p), h = Math.max(...s.map(c => c.high)), l = Math.min(...s.map(c => c.low)), wr = h === l ? -50 : (h - cd[cd.length - 1].close) / (h - l) * -100; return { val: wr, sig: wr < -80 ? 1 : wr > -20 ? -1 : 0 }; };
const html_uo = (cd) => { const n = cd.length, bp = [], tr = []; for (let i = 1; i < n; i++) { const h = Math.max(cd[i].high, cd[i - 1].close), l = Math.min(cd[i].low, cd[i - 1].close); bp.push(cd[i].close - l); tr.push(h - l); } const s = (p) => bp.slice(-p).reduce((a, b) => a + b, 0), t = (p) => tr.slice(-p).reduce((a, b) => a + b, 0) || 1; const val = 100 * (4 * s(7) / t(7) + 2 * s(14) / t(14) + s(28) / t(28)) / 7; return { val, sig: val < 30 ? 1 : val > 70 ? -1 : 0 }; };
const html_tsi = (c) => { const d = c.slice(1).map((v, i) => v - c[i]), ad = d.map(Math.abs); if (d.length < 30) return { val: 0, sig: 0 }; const e1 = html_ema(d, 25), e2 = html_ema(e1.filter(v => v !== 0), 13), ae1 = html_ema(ad, 25), ae2 = html_ema(ae1.filter(v => v !== 0), 13); const val = html_L(ae2) === 0 ? 0 : 100 * html_L(e2) / html_L(ae2); return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 }; };
const html_aoOsc = (cd) => { const mp = cd.map(c => (c.high + c.low) / 2), s5 = html_sma(mp, 5), s34 = html_sma(mp, 34), off = s5.length - s34.length, ao = s34.map((v, i) => s5[off + i] - v), last = html_L(ao), prev = ao[ao.length - 2] ?? 0; return { val: last, sig: last > 0 && last > prev ? 1 : last < 0 && last < prev ? -1 : last > 0 ? 1 : last < 0 ? -1 : 0 }; };
const html_mom = (c, p = 10) => { if (c.length < p + 1) return { val: 0, sig: 0 }; const val = c[c.length - 1] - c[c.length - 1 - p]; return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 }; };
const html_roc = (c, p = 10) => { if (c.length < p + 1) return { val: 0, sig: 0 }; const val = (c[c.length - 1] - c[c.length - 1 - p]) / c[c.length - 1 - p] * 100; return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 }; };
const html_trix = (c, p = 15) => { const e3 = html_ema(html_ema(html_ema(c, p), p), p), l = e3.length; if (l < 2) return { val: 0, sig: 0 }; const val = (e3[l - 1] - e3[l - 2]) / (e3[l - 2] || 1) * 100; return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 }; };
const html_aroon = (cd, p = 25) => { const hs = cd.slice(-p).map(c => c.high), ls = cd.slice(-p).map(c => c.low); const hi = hs.length - 1 - [...hs].reverse().indexOf(Math.max(...hs)), li = ls.length - 1 - [...ls].reverse().indexOf(Math.min(...ls)); const up = (p - hi) / p * 100, dn = (p - li) / p * 100; return { val: up - dn, sig: up - dn > 40 ? 1 : up - dn < -40 ? -1 : 0 }; };
const html_fisher = (cd, p = 9) => { const hs = cd.slice(-p).map(c => c.high), ls = cd.slice(-p).map(c => c.low), h = Math.max(...hs), l = Math.min(...ls), cur = cd[cd.length - 1].close; const r = (h === l) ? 0.5 : Math.min(0.999, Math.max(-0.999, (2 * (cur - l) / (h - l)) - 1)); const f = 0.5 * Math.log((1 + r) / (1 - r)); return { val: f, sig: f > 0.5 ? 1 : f < -0.5 ? -1 : 0 }; };
const html_dpo = (c, p = 20) => { const shift = Math.floor(p / 2) + 1; if (c.length < p + shift) return { val: 0, sig: 0 }; const idx = c.length - 1 - shift, ma = html_sma(c, p); const val = c[idx] - (ma[ma.length - shift - 1] ?? c[idx]); return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 }; };
const html_cmo = (c, p = 14) => { let up = 0, dn = 0; for (let i = c.length - p; i < c.length; i++) { const d = c[i] - c[i - 1]; d > 0 ? up += d : dn -= d; } const val = (up + dn) === 0 ? 0 : 100 * (up - dn) / (up + dn); return { val, sig: val > 50 ? 1 : val < -50 ? -1 : 0 }; };
const html_rvi = (cd, p = 10) => { if (cd.length < p * 2) return { val: 0, sig: 0 }; const calc = arr => { let n = 0, d = 0; for (let i = Math.max(0, arr.length - p); i < arr.length; i++) { n += arr[i].close - arr[i].open; d += arr[i].high - arr[i].low || 0.001; } return d ? n / d : 0; }; const val = calc(cd), prev = calc(cd.slice(0, -1)); return { val, sig: val > 0 && val > prev ? 1 : val < 0 && val < prev ? -1 : val > 0 ? 1 : val < 0 ? -1 : 0 }; };
/* eslint-enable */

const PARITY_TOL = 1e-9;

function makeCandles(seed = 1) {
  let r = seed;
  const rand = (): number => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  const out: Array<{ open: number; high: number; low: number; close: number; vol: number }> = [];
  let price = 60000;
  for (let i = 0; i < 80; i++) {
    const o = price;
    const drift = (rand() - 0.48) * 80;
    const c = o + drift;
    const range = 30 + rand() * 50;
    const h = Math.max(o, c) + rand() * range;
    const l = Math.min(o, c) - rand() * range;
    const vol = 100 + rand() * 200;
    out.push({ open: o, high: h, low: l, close: c, vol });
    price = c;
  }
  return out;
}

const CD = makeCandles(11);
const CLOSES = CD.map((c) => c.close);

describe('PARITY — momentum indicators match HTML byte-for-byte', () => {
  describe('rsi', () => {
    [14, 7, 21].forEach((p) => {
      it(`rsi(p=${p}) matches`, () => {
        expect(Math.abs(rsi(CLOSES, p) - html_rsi(CLOSES, p))).toBeLessThan(PARITY_TOL);
      });
    });
    it('rsi short data returns 50', () => {
      expect(rsi([1, 2, 3])).toBe(html_rsi([1, 2, 3]));
    });
  });

  describe('stochRsi', () => {
    it('matches HTML', () => {
      const a = stochRsi(CLOSES);
      const b = html_stochRsi(CLOSES);
      expect(Math.abs(a.k - b.k)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.d - b.d)).toBeLessThan(PARITY_TOL);
    });
  });

  describe('stochKD', () => {
    [14, 9].forEach((p) => {
      it(`stochKD(p=${p}) matches`, () => {
        const a = stochKD(CD, p);
        const b = html_stochKD(CD, p);
        expect(Math.abs(a.k - b.k)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.d - b.d)).toBeLessThan(PARITY_TOL);
      });
    });
  });

  describe('cci', () => {
    [20, 14].forEach((p) => {
      it(`cci(p=${p}) matches`, () => {
        const a = cci(CD, p);
        const b = html_cci(CD, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('willR', () => {
    [14, 20].forEach((p) => {
      it(`willR(p=${p}) matches`, () => {
        const a = willR(CD, p);
        const b = html_willR(CD, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('uo', () => {
    it('matches HTML', () => {
      const a = uo(CD);
      const b = html_uo(CD);
      expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
      expect(a.sig).toBe(b.sig);
    });
  });

  describe('tsi', () => {
    it('matches HTML', () => {
      const a = tsi(CLOSES);
      const b = html_tsi(CLOSES);
      expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
      expect(a.sig).toBe(b.sig);
    });
    it('short data returns zero', () => {
      const short = CLOSES.slice(0, 20);
      expect(tsi(short)).toEqual(html_tsi(short));
    });
  });

  describe('aoOsc', () => {
    it('matches HTML', () => {
      const a = aoOsc(CD);
      const b = html_aoOsc(CD);
      expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
      expect(a.sig).toBe(b.sig);
    });
  });

  describe('mom', () => {
    [10, 5, 14].forEach((p) => {
      it(`mom(p=${p}) matches`, () => {
        const a = mom(CLOSES, p);
        const b = html_mom(CLOSES, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('roc', () => {
    [10, 5].forEach((p) => {
      it(`roc(p=${p}) matches`, () => {
        const a = roc(CLOSES, p);
        const b = html_roc(CLOSES, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('trix', () => {
    [15, 9, 21].forEach((p) => {
      it(`trix(p=${p}) matches`, () => {
        const a = trix(CLOSES, p);
        const b = html_trix(CLOSES, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('aroon', () => {
    [25, 14].forEach((p) => {
      it(`aroon(p=${p}) matches`, () => {
        const a = aroon(CD, p);
        const b = html_aroon(CD, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('fisher', () => {
    [9, 14].forEach((p) => {
      it(`fisher(p=${p}) matches`, () => {
        const a = fisher(CD, p);
        const b = html_fisher(CD, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('dpo', () => {
    [20, 14].forEach((p) => {
      it(`dpo(p=${p}) matches`, () => {
        const a = dpo(CLOSES, p);
        const b = html_dpo(CLOSES, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('cmo', () => {
    [14, 9].forEach((p) => {
      it(`cmo(p=${p}) matches`, () => {
        const a = cmo(CLOSES, p);
        const b = html_cmo(CLOSES, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('rvi', () => {
    [10, 14].forEach((p) => {
      it(`rvi(p=${p}) matches`, () => {
        const a = rvi(CD, p);
        const b = html_rvi(CD, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });
});
