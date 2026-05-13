/**
 * Momentum indicators — direct ports from candleIndex2.html.
 *
 * Same parity rules: do NOT change the arithmetic. The RSI in particular
 * is a building block for stochRsi, regime detection, and the Oracle aggregator.
 */

import type { Candle } from '../../state/types.js';
import { ema, sma } from './moving-avg.js';
import { L } from './helpers.js';

/**
 * RSI (Relative Strength Index).
 * Source: candleIndex2.html line 10560.
 *
 * Returns a single value (the latest RSI), not an array.
 * Returns 50 if not enough data, 100 if no losses (avg loss = 0).
 */
export function rsi(c: readonly number[], p = 14): number {
  if (c.length < p + 1) return 50;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= p; i++) {
    const ci = c[i];
    const cp = c[i - 1];
    if (ci === undefined || cp === undefined) continue;
    const d = ci - cp;
    if (d > 0) g += d;
    else l -= d;
  }
  let ag = g / p;
  let al = l / p;
  for (let i = p + 1; i < c.length; i++) {
    const ci = c[i];
    const cp = c[i - 1];
    if (ci === undefined || cp === undefined) continue;
    const d = ci - cp;
    ag = (ag * (p - 1) + Math.max(d, 0)) / p;
    al = (al * (p - 1) + Math.max(-d, 0)) / p;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

/**
 * Stochastic RSI.
 * Source: candleIndex2.html line 10561.
 *
 * Computes RSI on each window of 14, then K%/D% Stochastic on the RSI series.
 */
export function stochRsi(c: readonly number[]): { k: number; d: number } {
  const ra: number[] = [];
  for (let i = 14; i < c.length; i++) {
    ra.push(rsi(c.slice(0, i + 1)));
  }
  if (ra.length < 14) return { k: 50, d: 50 };
  const kR: number[] = [];
  for (let i = 13; i < ra.length; i++) {
    const s = ra.slice(i - 13, i + 1);
    const mn = Math.min(...s);
    const mx = Math.max(...s);
    const ri = ra[i];
    if (ri === undefined) continue;
    kR.push(mx === mn ? 50 : ((ri - mn) / (mx - mn)) * 100);
  }
  const ks = sma(kR, 3);
  const ds = sma(ks, 3);
  return { k: L(ks) ?? 50, d: L(ds) ?? 50 };
}

/**
 * Stochastic K%/D% (classic, on candles).
 * Source: candleIndex2.html line 10562.
 */
export function stochKD(cd: readonly Candle[], kp = 14): { k: number; d: number } {
  const kA: number[] = [];
  for (let i = kp - 1; i < cd.length; i++) {
    const s = cd.slice(i - kp + 1, i + 1);
    const h = Math.max(...s.map((c) => c.high));
    const l = Math.min(...s.map((c) => c.low));
    const ci = cd[i];
    if (ci === undefined) continue;
    kA.push(h === l ? 50 : ((ci.close - l) / (h - l)) * 100);
  }
  const ks = sma(kA, 3);
  const ds = sma(ks, 3);
  return { k: L(ks) ?? 50, d: L(ds) ?? 50 };
}

/**
 * CCI — Commodity Channel Index.
 * Source: candleIndex2.html line 10564.
 */
export function cci(cd: readonly Candle[], p = 20): { val: number; sig: -1 | 0 | 1 } {
  const tp = cd.map((c) => (c.high + c.low + c.close) / 3);
  const sl = tp.slice(-p);
  const m = sl.reduce((a, b) => a + b) / p;
  const md = sl.reduce((a, b) => a + Math.abs(b - m), 0) / p;
  const val = md === 0 ? 0 : (tp[tp.length - 1]! - m) / (0.015 * md);
  return { val, sig: val > 100 ? 1 : val < -100 ? -1 : 0 };
}

/**
 * Williams %R.
 * Source: candleIndex2.html line 10565.
 */
export function willR(cd: readonly Candle[], p = 14): { val: number; sig: -1 | 0 | 1 } {
  const s = cd.slice(-p);
  const h = Math.max(...s.map((c) => c.high));
  const l = Math.min(...s.map((c) => c.low));
  const cur = cd[cd.length - 1]!;
  const wr = h === l ? -50 : ((h - cur.close) / (h - l)) * -100;
  return { val: wr, sig: wr < -80 ? 1 : wr > -20 ? -1 : 0 };
}

/**
 * Ultimate Oscillator.
 * Source: candleIndex2.html line 10566.
 */
export function uo(cd: readonly Candle[]): { val: number; sig: -1 | 0 | 1 } {
  const n = cd.length;
  const bp: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < n; i++) {
    const ci = cd[i]!;
    const cp = cd[i - 1]!;
    const h = Math.max(ci.high, cp.close);
    const l = Math.min(ci.low, cp.close);
    bp.push(ci.close - l);
    tr.push(h - l);
  }
  const sumBp = (p: number): number => bp.slice(-p).reduce((a, b) => a + b, 0);
  const sumTr = (p: number): number => tr.slice(-p).reduce((a, b) => a + b, 0) || 1;
  const val =
    (100 * ((4 * sumBp(7)) / sumTr(7) + (2 * sumBp(14)) / sumTr(14) + sumBp(28) / sumTr(28))) /
    7;
  return { val, sig: val < 30 ? 1 : val > 70 ? -1 : 0 };
}

/**
 * TSI — True Strength Index.
 * Source: candleIndex2.html line 10567.
 *
 * Uses double-smoothed EMA on price changes; filters zeros between EMAs.
 */
export function tsi(c: readonly number[]): { val: number; sig: -1 | 0 | 1 } {
  const d = c.slice(1).map((v, i) => v - c[i]!);
  const ad = d.map(Math.abs);
  if (d.length < 30) return { val: 0, sig: 0 };
  const e1 = ema(d, 25);
  const e2 = ema(
    e1.filter((v) => v !== 0),
    13,
  );
  const ae1 = ema(ad, 25);
  const ae2 = ema(
    ae1.filter((v) => v !== 0),
    13,
  );
  const val = L(ae2) === 0 ? 0 : (100 * L(e2)) / L(ae2);
  return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 };
}

/**
 * Awesome Oscillator (Bill Williams).
 * Source: candleIndex2.html line 10568.
 *
 * Uses median price (h+l)/2, SMA5 - SMA34.
 * The signal logic distinguishes 4 cases (positive/negative × increasing/decreasing).
 */
export function aoOsc(cd: readonly Candle[]): { val: number; sig: -1 | 0 | 1 } {
  const mp = cd.map((c) => (c.high + c.low) / 2);
  const s5 = sma(mp, 5);
  const s34 = sma(mp, 34);
  const off = s5.length - s34.length;
  const ao = s34.map((v, i) => (s5[off + i] ?? 0) - v);
  const last = L(ao);
  const prev = ao[ao.length - 2] ?? 0;
  let sig: -1 | 0 | 1;
  if (last > 0 && last > prev) sig = 1;
  else if (last < 0 && last < prev) sig = -1;
  else if (last > 0) sig = 1;
  else if (last < 0) sig = -1;
  else sig = 0;
  return { val: last, sig };
}

/**
 * Momentum — closes[n] - closes[n-p].
 * Source: candleIndex2.html line 10569.
 */
export function mom(c: readonly number[], p = 10): { val: number; sig: -1 | 0 | 1 } {
  if (c.length < p + 1) return { val: 0, sig: 0 };
  const val = c[c.length - 1]! - c[c.length - 1 - p]!;
  return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 };
}

/**
 * Rate of Change — percentage change over `p` bars.
 * Source: candleIndex2.html line 10570.
 */
export function roc(c: readonly number[], p = 10): { val: number; sig: -1 | 0 | 1 } {
  if (c.length < p + 1) return { val: 0, sig: 0 };
  const ref = c[c.length - 1 - p]!;
  const val = ((c[c.length - 1]! - ref) / ref) * 100;
  return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 };
}

/**
 * TRIX — triple-smoothed EMA momentum.
 * Source: candleIndex2.html line 10571.
 */
export function trix(c: readonly number[], p = 15): { val: number; sig: -1 | 0 | 1 } {
  const e3 = ema(ema(ema(c, p), p), p);
  const l = e3.length;
  if (l < 2) return { val: 0, sig: 0 };
  const val = ((e3[l - 1]! - e3[l - 2]!) / (e3[l - 2]! || 1)) * 100;
  return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 };
}

/**
 * Aroon — measures how recent the highest high and lowest low are.
 * Source: candleIndex2.html line 10572.
 *
 * Returns up - down ; signal at ±40.
 */
export function aroon(cd: readonly Candle[], p = 25): { val: number; sig: -1 | 0 | 1 } {
  const hs = cd.slice(-p).map((c) => c.high);
  const ls = cd.slice(-p).map((c) => c.low);
  const hi = hs.length - 1 - [...hs].reverse().indexOf(Math.max(...hs));
  const li = ls.length - 1 - [...ls].reverse().indexOf(Math.min(...ls));
  const up = ((p - hi) / p) * 100;
  const dn = ((p - li) / p) * 100;
  const val = up - dn;
  return { val, sig: val > 40 ? 1 : val < -40 ? -1 : 0 };
}

/**
 * Fisher Transform — applied to normalized price location.
 * Source: candleIndex2.html line 10573.
 */
export function fisher(cd: readonly Candle[], p = 9): { val: number; sig: -1 | 0 | 1 } {
  const hs = cd.slice(-p).map((c) => c.high);
  const ls = cd.slice(-p).map((c) => c.low);
  const h = Math.max(...hs);
  const l = Math.min(...ls);
  const cur = cd[cd.length - 1]!.close;
  const r =
    h === l ? 0.5 : Math.min(0.999, Math.max(-0.999, (2 * (cur - l)) / (h - l) - 1));
  const f = 0.5 * Math.log((1 + r) / (1 - r));
  return { val: f, sig: f > 0.5 ? 1 : f < -0.5 ? -1 : 0 };
}

/**
 * DPO — Detrended Price Oscillator.
 * Source: candleIndex2.html line 10574.
 */
export function dpo(c: readonly number[], p = 20): { val: number; sig: -1 | 0 | 1 } {
  const shift = Math.floor(p / 2) + 1;
  if (c.length < p + shift) return { val: 0, sig: 0 };
  const idx = c.length - 1 - shift;
  const ma = sma(c, p);
  const val = c[idx]! - (ma[ma.length - shift - 1] ?? c[idx]!);
  return { val, sig: val > 0 ? 1 : val < 0 ? -1 : 0 };
}

/**
 * CMO — Chande Momentum Oscillator.
 * Source: candleIndex2.html line 10575.
 */
export function cmo(c: readonly number[], p = 14): { val: number; sig: -1 | 0 | 1 } {
  let up = 0;
  let dn = 0;
  for (let i = c.length - p; i < c.length; i++) {
    const d = c[i]! - c[i - 1]!;
    if (d > 0) up += d;
    else dn -= d;
  }
  const val = up + dn === 0 ? 0 : (100 * (up - dn)) / (up + dn);
  return { val, sig: val > 50 ? 1 : val < -50 ? -1 : 0 };
}

/**
 * RVI — Relative Vigor Index (simplified single-window).
 * Source: candleIndex2.html line 10593.
 *
 * Compares current (close - open) average against previous candle's.
 */
export function rvi(cd: readonly Candle[], p = 10): { val: number; sig: -1 | 0 | 1 } {
  if (cd.length < p * 2) return { val: 0, sig: 0 };
  const calc = (arr: readonly Candle[]): number => {
    let n = 0;
    let d = 0;
    for (let i = Math.max(0, arr.length - p); i < arr.length; i++) {
      const c = arr[i]!;
      n += c.close - c.open;
      d += c.high - c.low || 0.001;
    }
    return d ? n / d : 0;
  };
  const val = calc(cd);
  const prev = calc(cd.slice(0, -1));
  let sig: -1 | 0 | 1;
  if (val > 0 && val > prev) sig = 1;
  else if (val < 0 && val < prev) sig = -1;
  else if (val > 0) sig = 1;
  else if (val < 0) sig = -1;
  else sig = 0;
  return { val, sig };
}
