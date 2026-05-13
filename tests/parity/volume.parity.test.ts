/**
 * Parity tests for volume-based indicators
 * (vwap, obv, cmf, mfi, elderRay, vortex, pvt, klinger).
 */

import { describe, it, expect } from 'vitest';
import {
  vwap,
  obv,
  cmf,
  mfi,
  elderRay,
  vortex,
  pvt,
  klinger,
} from '../../src/engine/indicators/volume.js';

/* eslint-disable */
// @ts-nocheck
const html_ema = (a, p) => { if (a.length < p) return a.map(() => 0); const k = 2 / (p + 1); let v = a.slice(0, p).reduce((x, y) => x + y) / p; const r = Array(p - 1).fill(0).concat([v]); for (let i = p; i < a.length; i++) { v = a[i] * k + v * (1 - k); r.push(v); } return r; };
const html_L = (a) => a[a.length - 1] ?? 0;

const html_vwap = (cd) => { const n = Math.min(96, cd.length), s = cd.slice(-n); let pv = 0, v = 0; s.forEach(c => { const tp = (c.high + c.low + c.close) / 3; pv += tp * c.vol; v += c.vol; }); const val = v ? pv / v : cd[cd.length - 1].close; return { val, sig: cd[cd.length - 1].close > val ? 1 : -1, txt: '$' + Math.round(val).toLocaleString() }; };
const html_obv = (cd) => { let o = 0; const a = [0]; for (let i = 1; i < cd.length; i++) { if (cd[i].close > cd[i - 1].close) o += cd[i].vol; else if (cd[i].close < cd[i - 1].close) o -= cd[i].vol; a.push(o); } const e9 = html_ema(a, 9), e21 = html_ema(a, 21); return { sig: html_L(e9) > html_L(e21) ? 1 : -1, txt: (o / 1e6).toFixed(1) + 'M' }; };
const html_cmfCalc = (cd, p = 20) => { const s = cd.slice(-p); let mfv = 0, vol = 0; s.forEach(c => { const hl = (c.high - c.low) || .001; mfv += ((c.close - c.low) - (c.high - c.close)) / hl * c.vol; vol += c.vol; }); const val = vol ? mfv / vol : 0; return { val, sig: val > 0.05 ? 1 : val < -0.05 ? -1 : 0 }; };
const html_mfi = (cd, p = 14) => { const tp = cd.map(c => (c.high + c.low + c.close) / 3); let pm = 0, nm = 0; for (let i = 1; i <= Math.min(p, tp.length - 1); i++) { const m = tp[tp.length - i] * cd[cd.length - i].vol; tp[tp.length - i] > tp[tp.length - i - 1] ? pm += m : nm += m; } const val = nm === 0 ? 100 : 100 - 100 / (1 + pm / nm); return { val, sig: val < 20 ? 1 : val > 80 ? -1 : 0 }; };
const html_elderRay = (cd, p = 13) => { const c = cd.map(x => x.close), e = html_ema(c, p), cur = cd[cd.length - 1], le = html_L(e); const bull = cur.high - le, bear = cur.low - le; return { bull, bear, sig: bull > 0 && bear > 0 ? 1 : bull < 0 && bear < 0 ? -1 : bull > 0 ? 1 : -1, txt: (bull >= 0 ? '+' : '') + bull.toFixed(0) + '/' + (bear >= 0 ? '+' : '') + bear.toFixed(0) }; };
const html_vortex = (cd, p = 14) => { let vip = 0, vim = 0, tr = 0; for (let i = cd.length - p; i < cd.length - 1; i++) { vip += Math.abs(cd[i + 1].high - cd[i].low); vim += Math.abs(cd[i + 1].low - cd[i].high); tr += Math.max(cd[i + 1].high, cd[i].close) - Math.min(cd[i + 1].low, cd[i].close); } const VI_p = tr ? vip / tr : 1, VI_m = tr ? vim / tr : 1; return { vip: VI_p, vim: VI_m, sig: VI_p > VI_m ? 1 : -1, txt: 'VI+:' + VI_p.toFixed(2) + '/VI-:' + VI_m.toFixed(2) }; };
const html_pvt = (cd) => { let pv = 0; const a = [0]; for (let i = 1; i < cd.length; i++) { pv += ((cd[i].close - cd[i - 1].close) / cd[i - 1].close) * cd[i].vol; a.push(pv); } const e9 = html_ema(a, 9); return { sig: html_L(e9) > 0 ? 1 : -1, txt: (html_L(a) / 1e9).toFixed(2) + 'B' }; };
const html_klinger = (cd) => { if (cd.length < 35) return { sig: 0, txt: '—' }; const kArr = []; for (let i = 1; i < cd.length; i++) { const hlc2 = (cd[i].high + cd[i].low + cd[i].close), ph = (cd[i - 1].high + cd[i - 1].low + cd[i - 1].close); const trend = hlc2 > ph ? 1 : -1, dm = cd[i].high - cd[i].low; kArr.push(trend * dm * cd[i].vol); } const e34 = html_ema(kArr, 34), e55 = html_ema(kArr, 55), off = Math.abs(e34.length - e55.length); const kvo = e34.slice(off).map((v, i) => v - (e55[i] || 0)); const sig = html_ema(kvo, 13); const last = html_L(kvo), s = html_L(sig); return { sig: last > s ? 1 : last < s ? -1 : 0, txt: last.toFixed(0) }; };
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

const CD = makeCandles(17);

describe('PARITY — volume indicators match HTML byte-for-byte', () => {
  describe('vwap', () => {
    it('matches HTML', () => {
      const a = vwap(CD);
      const b = html_vwap(CD);
      expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
      expect(a.sig).toBe(b.sig);
      expect(a.txt).toBe(b.txt);
    });
  });

  describe('obv', () => {
    it('matches HTML', () => {
      const a = obv(CD);
      const b = html_obv(CD);
      expect(a.sig).toBe(b.sig);
      expect(a.txt).toBe(b.txt);
    });
  });

  describe('cmf', () => {
    [20, 14].forEach((p) => {
      it(`cmf(p=${p}) matches`, () => {
        const a = cmf(CD, p);
        const b = html_cmfCalc(CD, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('mfi', () => {
    [14, 9].forEach((p) => {
      it(`mfi(p=${p}) matches`, () => {
        const a = mfi(CD, p);
        const b = html_mfi(CD, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('elderRay', () => {
    [13, 9].forEach((p) => {
      it(`elderRay(p=${p}) matches`, () => {
        const a = elderRay(CD, p);
        const b = html_elderRay(CD, p);
        expect(Math.abs(a.bull - b.bull)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.bear - b.bear)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
        expect(a.txt).toBe(b.txt);
      });
    });
  });

  describe('vortex', () => {
    [14, 9, 21].forEach((p) => {
      it(`vortex(p=${p}) matches`, () => {
        const a = vortex(CD, p);
        const b = html_vortex(CD, p);
        expect(Math.abs(a.vip - b.vip)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.vim - b.vim)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
        expect(a.txt).toBe(b.txt);
      });
    });
  });

  describe('pvt', () => {
    it('matches HTML', () => {
      const a = pvt(CD);
      const b = html_pvt(CD);
      expect(a.sig).toBe(b.sig);
      expect(a.txt).toBe(b.txt);
    });
  });

  describe('klinger', () => {
    it('matches HTML', () => {
      const a = klinger(CD);
      const b = html_klinger(CD);
      expect(a.sig).toBe(b.sig);
      expect(a.txt).toBe(b.txt);
    });
    it('matches HTML on short data', () => {
      const short = CD.slice(0, 30);
      expect(klinger(short)).toEqual(html_klinger(short));
    });
  });
});
