/**
 * Volume-based indicators — direct ports from candleIndex2.html.
 *
 * Parity rule : do NOT change the arithmetic. Each function is a byte-for-byte
 * port, validated by `tests/parity/volume.parity.test.ts`.
 */

import type { Candle } from '../../state/types.js';
import { ema } from './moving-avg.js';
import { L } from './helpers.js';

/**
 * VWAP — Volume-Weighted Average Price over the last 96 candles (rolling 24h on M15).
 * Source: candleIndex2.html line 10580.
 *
 * Returns the VWAP value, a sign signal (price above/below VWAP), and a display text.
 */
export function vwap(cd: readonly Candle[]): {
  val: number;
  sig: -1 | 1;
  txt: string;
} {
  const n = Math.min(96, cd.length);
  const s = cd.slice(-n);
  let pv = 0;
  let v = 0;
  s.forEach((c) => {
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.vol;
    v += c.vol;
  });
  const last = cd[cd.length - 1]!;
  const val = v ? pv / v : last.close;
  return {
    val,
    sig: last.close > val ? 1 : -1,
    txt: '$' + Math.round(val).toLocaleString(),
  };
}

/**
 * OBV — On-Balance Volume.
 * Source: candleIndex2.html line 10586.
 *
 * Builds a cumulative OBV series, then compares EMA9 vs EMA21 for the signal.
 */
export function obv(cd: readonly Candle[]): { sig: -1 | 1; txt: string } {
  let o = 0;
  const a: number[] = [0];
  for (let i = 1; i < cd.length; i++) {
    const ci = cd[i]!;
    const cp = cd[i - 1]!;
    if (ci.close > cp.close) o += ci.vol;
    else if (ci.close < cp.close) o -= ci.vol;
    a.push(o);
  }
  const e9 = ema(a, 9);
  const e21 = ema(a, 21);
  return {
    sig: L(e9) > L(e21) ? 1 : -1,
    txt: (o / 1e6).toFixed(1) + 'M',
  };
}

/**
 * CMF — Chaikin Money Flow.
 * Source: candleIndex2.html line 10587 (named `cmfCalc` in the HTML).
 *
 * Range threshold ±0.05 for the signal.
 */
export function cmf(cd: readonly Candle[], p = 20): { val: number; sig: -1 | 0 | 1 } {
  const s = cd.slice(-p);
  let mfv = 0;
  let vol = 0;
  s.forEach((c) => {
    const hl = c.high - c.low || 0.001;
    mfv += ((c.close - c.low - (c.high - c.close)) / hl) * c.vol;
    vol += c.vol;
  });
  const val = vol ? mfv / vol : 0;
  return { val, sig: val > 0.05 ? 1 : val < -0.05 ? -1 : 0 };
}

/** Alias matching the HTML reference name. */
export const cmfCalc = cmf;

/**
 * MFI — Money Flow Index.
 * Source: candleIndex2.html line 10588.
 *
 * Iterates from the latest candle back `p` candles, distinguishing positive
 * money flow (typical price up) from negative.
 */
export function mfi(cd: readonly Candle[], p = 14): { val: number; sig: -1 | 0 | 1 } {
  const tp = cd.map((c) => (c.high + c.low + c.close) / 3);
  let pm = 0;
  let nm = 0;
  for (let i = 1; i <= Math.min(p, tp.length - 1); i++) {
    const m = tp[tp.length - i]! * cd[cd.length - i]!.vol;
    if (tp[tp.length - i]! > tp[tp.length - i - 1]!) pm += m;
    else nm += m;
  }
  const val = nm === 0 ? 100 : 100 - 100 / (1 + pm / nm);
  return { val, sig: val < 20 ? 1 : val > 80 ? -1 : 0 };
}

/**
 * Elder Ray (Bull/Bear Power).
 * Source: candleIndex2.html line 10589.
 *
 * Bull power = high - EMA(p), Bear power = low - EMA(p).
 */
export function elderRay(
  cd: readonly Candle[],
  p = 13,
): { bull: number; bear: number; sig: -1 | 1; txt: string } {
  const c = cd.map((x) => x.close);
  const e = ema(c, p);
  const cur = cd[cd.length - 1]!;
  const le = L(e);
  const bull = cur.high - le;
  const bear = cur.low - le;
  let sig: -1 | 1;
  if (bull > 0 && bear > 0) sig = 1;
  else if (bull < 0 && bear < 0) sig = -1;
  else if (bull > 0) sig = 1;
  else sig = -1;
  return {
    bull,
    bear,
    sig,
    txt:
      (bull >= 0 ? '+' : '') +
      bull.toFixed(0) +
      '/' +
      (bear >= 0 ? '+' : '') +
      bear.toFixed(0),
  };
}

/**
 * Vortex Indicator.
 * Source: candleIndex2.html line 10590.
 *
 * Iterates the last `p` bars (window `[length-p, length-1)`).
 */
export function vortex(
  cd: readonly Candle[],
  p = 14,
): { vip: number; vim: number; sig: -1 | 1; txt: string } {
  let vip = 0;
  let vim = 0;
  let tr = 0;
  for (let i = cd.length - p; i < cd.length - 1; i++) {
    const c0 = cd[i]!;
    const c1 = cd[i + 1]!;
    vip += Math.abs(c1.high - c0.low);
    vim += Math.abs(c1.low - c0.high);
    tr += Math.max(c1.high, c0.close) - Math.min(c1.low, c0.close);
  }
  const viP = tr ? vip / tr : 1;
  const viM = tr ? vim / tr : 1;
  return {
    vip: viP,
    vim: viM,
    sig: viP > viM ? 1 : -1,
    txt: 'VI+:' + viP.toFixed(2) + '/VI-:' + viM.toFixed(2),
  };
}

/**
 * PVT — Price Volume Trend.
 * Source: candleIndex2.html line 10591.
 *
 * Cumulative pct-change × volume; EMA9 sign as signal.
 */
export function pvt(cd: readonly Candle[]): { sig: -1 | 1; txt: string } {
  let pv = 0;
  const a: number[] = [0];
  for (let i = 1; i < cd.length; i++) {
    const ci = cd[i]!;
    const cp = cd[i - 1]!;
    pv += ((ci.close - cp.close) / cp.close) * ci.vol;
    a.push(pv);
  }
  const e9 = ema(a, 9);
  return {
    sig: L(e9) > 0 ? 1 : -1,
    txt: (L(a) / 1e9).toFixed(2) + 'B',
  };
}

/**
 * Klinger Volume Oscillator.
 * Source: candleIndex2.html line 10592.
 *
 * KVO = EMA34(trend × dm × vol) − EMA55(...); signal = EMA13(KVO).
 * Returns 0 signal if input too short (<35 candles).
 */
export function klinger(cd: readonly Candle[]): { sig: -1 | 0 | 1; txt: string } {
  if (cd.length < 35) return { sig: 0, txt: '—' };

  const kArr: number[] = [];
  for (let i = 1; i < cd.length; i++) {
    const ci = cd[i]!;
    const cp = cd[i - 1]!;
    const hlc2 = ci.high + ci.low + ci.close;
    const ph = cp.high + cp.low + cp.close;
    const trend = hlc2 > ph ? 1 : -1;
    const dm = ci.high - ci.low;
    kArr.push(trend * dm * ci.vol);
  }

  const e34 = ema(kArr, 34);
  const e55 = ema(kArr, 55);
  const off = Math.abs(e34.length - e55.length);
  const kvo = e34.slice(off).map((v, i) => v - (e55[i] ?? 0));
  const sig = ema(kvo, 13);
  const last = L(kvo);
  const s = L(sig);

  return {
    sig: last > s ? 1 : last < s ? -1 : 0,
    txt: last.toFixed(0),
  };
}
