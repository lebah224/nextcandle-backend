/**
 * Parity tests for trend indicators.
 *
 * HTML reference code is embedded VERBATIM from candleIndex2.html.
 * Any failure here means a port has drifted from the HTML — block merge until fixed.
 */

import { describe, it, expect } from 'vitest';
import {
  macd,
  adx,
  psar,
  supertrend,
  ichimoku,
  heikinAshi,
  linregSlope,
  efficiencyRatio,
} from '../../src/engine/indicators/trend.js';

// ════════════════════════════════════════════════════════════════════════
//  HTML REFERENCE — verbatim from candleIndex2.html lines 10551-10600.
//  Includes the moving-average prerequisites used by the trend functions.
// ════════════════════════════════════════════════════════════════════════
/* eslint-disable */
// @ts-nocheck
const html_ema = (a, p) => { if (a.length < p) return a.map(() => 0); const k = 2 / (p + 1); let v = a.slice(0, p).reduce((x, y) => x + y) / p; const r = Array(p - 1).fill(0).concat([v]); for (let i = p; i < a.length; i++) { v = a[i] * k + v * (1 - k); r.push(v); } return r; };
const html_sma = (a, p) => { const r = []; for (let i = p - 1; i < a.length; i++) r.push(a.slice(i - p + 1, i + 1).reduce((x, y) => x + y) / p); return r; };
const html_L = (a) => a[a.length - 1] ?? 0;

const html_macd = (c) => { const e12 = html_ema(c, 12), e26 = html_ema(c, 26), ml = e12.map((v, i) => v - e26[i]).slice(25); if (ml.length < 9) return { last: 0, prev: 0, ml: 0, sl: 0 }; const sig = html_sma(ml, 9), hist = ml.slice(ml.length - sig.length).map((v, i) => v - sig[i]); return { last: html_L(hist), prev: hist[hist.length - 2] ?? 0, ml: html_L(ml), sl: html_L(sig) }; };
const html_adx = (cd, p = 14) => { if (cd.length < p * 3) return { adx: 20, pdi: 25, mdi: 25 }; const tr = [], pdm = [], mdm = []; for (let i = 1; i < cd.length; i++) { const h = cd[i].high, l = cd[i].low, ph = cd[i - 1].high, pl = cd[i - 1].low, pc = cd[i - 1].close; tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))); const up = h - ph, dn = pl - l; pdm.push(up > dn && up > 0 ? up : 0); mdm.push(dn > up && dn > 0 ? dn : 0); } const ws = a => { let s = a.slice(0, p).reduce((x, y) => x + y); const r = [s]; for (let i = p; i < a.length; i++) { s = s - s / p + a[i]; r.push(s); } return r; }; const str = ws(tr), sp = ws(pdm), sm = ws(mdm); const pdi = sp.map((v, i) => str[i] ? v / str[i] * 100 : 0), mdi = sm.map((v, i) => str[i] ? v / str[i] * 100 : 0); const dx = pdi.map((v, i) => { const s = v + mdi[i]; return s ? Math.abs(v - mdi[i]) / s * 100 : 0; }); const ea = html_ema(dx, p); return { adx: html_L(ea) ?? 20, pdi: html_L(pdi) ?? 0, mdi: html_L(mdi) ?? 0 }; };
const html_psar = (cd) => { if (cd.length < 10) return { sig: 0, txt: '—' }; let bull = true, sar = cd[0].low, ep = cd[0].high, af = 0.02, afMax = 0.2; for (let i = 1; i < cd.length; i++) { sar = sar + af * (ep - sar); if (bull) { sar = Math.min(sar, cd[Math.max(0, i - 1)].low, cd[Math.max(0, i - 2)].low); if (cd[i].low < sar) { bull = false; sar = ep; ep = cd[i].low; af = 0.02; } else { if (cd[i].high > ep) { ep = cd[i].high; af = Math.min(af + 0.02, afMax); } } } else { sar = Math.max(sar, cd[Math.max(0, i - 1)].high, cd[Math.max(0, i - 2)].high); if (cd[i].high > sar) { bull = true; sar = ep; ep = cd[i].high; af = 0.02; } else { if (cd[i].low < ep) { ep = cd[i].low; af = Math.min(af + 0.02, afMax); } } } } return { sig: bull ? 1 : -1, txt: '$' + Math.round(sar).toLocaleString() }; };
const html_supertrend = (cd, p = 10, m = 3) => { if (cd.length < p * 3) return { sig: 0, txt: '—' }; const tr = []; for (let i = 1; i < cd.length; i++) { const h = cd[i].high, l = cd[i].low, pc = cd[i - 1].close; tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))); } let av = tr.slice(0, p).reduce((a, b) => a + b) / p; for (let i = p; i < tr.length; i++) av = (av * (p - 1) + tr[i]) / p; let trend = 1, st = 0, prev = 1; for (let i = p; i < cd.length; i++) { const hl2 = (cd[i].high + cd[i].low) / 2, up = hl2 + m * av, lo = hl2 - m * av; if (prev === 1) { st = lo; if (cd[i].close < st) { trend = -1; st = up; } } else { st = up; if (cd[i].close > st) { trend = 1; st = lo; } } prev = trend; } return { sig: trend, txt: '$' + Math.round(st).toLocaleString() }; };
const html_ichimoku = (cd) => { if (cd.length < 52) return { sig: 0, txt: '—' }; const dn = (arr, n) => { const s = arr.slice(-n); return (Math.max(...s.map(c => c.high)) + Math.min(...s.map(c => c.low))) / 2; }; const ten = dn(cd, 9), kij = dn(cd, 26), price = cd[cd.length - 1].close; const old = cd.slice(0, -26); if (old.length < 52) return { sig: price > ten && ten > kij ? 1 : price < ten && ten < kij ? -1 : 0, txt: `T:${Math.round(ten)}` }; const sA = (dn(old, 9) + dn(old, 26)) / 2, sB = dn(old, 52), top = Math.max(sA, sB), bot = Math.min(sA, sB); let sig = 0; if (price > top && ten > kij) sig = 1; else if (price < bot && ten < kij) sig = -1; return { sig, txt: `T:${Math.round(ten)} K:${Math.round(kij)}` }; };
const html_heikinAshi = (cd) => { const r = []; cd.forEach((c, i) => { const pc = r[i - 1] || c, haC = (c.open + c.high + c.low + c.close) / 4, haO = (pc.open + pc.close) / 2, haH = Math.max(c.high, haC, haO), haL = Math.min(c.low, haC, haO); r.push({ open: haO, close: haC, high: haH, low: haL }); }); const last = r[r.length - 1], sig = last.close > last.open ? 1 : -1; return { sig, txt: sig > 0 ? 'Bull' : 'Bear', last }; };
const html_linregSlope = (c, p = 20) => { if (c.length < p) return { val: 0, sig: 0 }; const sl = c.slice(-p), n = sl.length, sx = n * (n - 1) / 2, sx2 = n * (n - 1) * (2 * n - 1) / 6, sy = sl.reduce((a, b) => a + b, 0), sxy = sl.reduce((a, b, i) => a + i * b, 0); const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx); return { val: slope, sig: slope > 0 ? 1 : slope < 0 ? -1 : 0 }; };
const html_efficiencyRatio = (c, p = 10) => { if (c.length < p + 1) return { val: 0, sig: 0 }; const dir = Math.abs(c[c.length - 1] - c[c.length - 1 - p]), noise = c.slice(-p).reduce((a, b, i, ar) => a + (i > 0 ? Math.abs(b - ar[i - 1]) : 0), 0); const val = noise ? dir / noise : 0; return { val, sig: val > 0.6 ? 1 : 0 }; };
/* eslint-enable */

const PARITY_TOL = 1e-9;

// ── Test data: 80 BTC M5 candles with realistic OHLCV ─────────────────
function makeCandles(seed = 1): Array<{ open: number; high: number; low: number; close: number; vol: number }> {
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

const CD = makeCandles(7);
const CLOSES = CD.map((c) => c.close);

describe('PARITY — trend indicators match HTML reference byte-for-byte', () => {
  describe('macd', () => {
    it('matches HTML', () => {
      const a = macd(CLOSES);
      const b = html_macd(CLOSES);
      expect(Math.abs(a.last - b.last)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.prev - b.prev)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.ml - b.ml)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.sl - b.sl)).toBeLessThan(PARITY_TOL);
    });
    it('matches HTML on short data (zeros)', () => {
      const short = CLOSES.slice(0, 20);
      expect(macd(short)).toEqual(html_macd(short));
    });
  });

  describe('adx', () => {
    [14, 7, 20].forEach((p) => {
      it(`adx(p=${p}) matches HTML`, () => {
        const a = adx(CD, p);
        const b = html_adx(CD, p);
        expect(Math.abs(a.adx - b.adx)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.pdi - b.pdi)).toBeLessThan(PARITY_TOL);
        expect(Math.abs(a.mdi - b.mdi)).toBeLessThan(PARITY_TOL);
      });
    });
    it('returns defaults when data too short', () => {
      const short = CD.slice(0, 10);
      expect(adx(short)).toEqual(html_adx(short));
    });
  });

  describe('psar', () => {
    it('matches HTML', () => {
      const a = psar(CD);
      const b = html_psar(CD);
      expect(a.sig).toBe(b.sig);
      expect(a.txt).toBe(b.txt);
    });
    it('returns no signal when data too short', () => {
      expect(psar(CD.slice(0, 5))).toEqual(html_psar(CD.slice(0, 5)));
    });
  });

  describe('supertrend', () => {
    [
      { p: 10, m: 3 },
      { p: 7, m: 2 },
      { p: 14, m: 4 },
    ].forEach(({ p, m }) => {
      it(`supertrend(p=${p}, m=${m}) matches HTML`, () => {
        const a = supertrend(CD, p, m);
        const b = html_supertrend(CD, p, m);
        expect(a.sig).toBe(b.sig);
        expect(a.txt).toBe(b.txt);
      });
    });
  });

  describe('ichimoku', () => {
    it('matches HTML (full data)', () => {
      const a = ichimoku(CD);
      const b = html_ichimoku(CD);
      expect(a.sig).toBe(b.sig);
      expect(a.txt).toBe(b.txt);
    });
    it('matches HTML (60 candles — old.length<52 branch)', () => {
      const sub = CD.slice(0, 60);
      const a = ichimoku(sub);
      const b = html_ichimoku(sub);
      expect(a.sig).toBe(b.sig);
      expect(a.txt).toBe(b.txt);
    });
    it('matches HTML (too short)', () => {
      const sub = CD.slice(0, 30);
      expect(ichimoku(sub)).toEqual(html_ichimoku(sub));
    });
  });

  describe('heikinAshi', () => {
    it('matches HTML', () => {
      const a = heikinAshi(CD);
      const b = html_heikinAshi(CD);
      expect(a.sig).toBe(b.sig);
      expect(a.txt).toBe(b.txt);
      expect(Math.abs(a.last.open - b.last.open)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.last.close - b.last.close)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.last.high - b.last.high)).toBeLessThan(PARITY_TOL);
      expect(Math.abs(a.last.low - b.last.low)).toBeLessThan(PARITY_TOL);
    });
  });

  describe('linregSlope', () => {
    [20, 10, 50].forEach((p) => {
      it(`linregSlope(p=${p}) matches HTML`, () => {
        const a = linregSlope(CLOSES, p);
        const b = html_linregSlope(CLOSES, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });

  describe('efficiencyRatio', () => {
    [10, 14, 20].forEach((p) => {
      it(`efficiencyRatio(p=${p}) matches HTML`, () => {
        const a = efficiencyRatio(CLOSES, p);
        const b = html_efficiencyRatio(CLOSES, p);
        expect(Math.abs(a.val - b.val)).toBeLessThan(PARITY_TOL);
        expect(a.sig).toBe(b.sig);
      });
    });
  });
});
