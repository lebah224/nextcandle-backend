/**
 * Momentum indicators — direct ports from candleIndex2.html.
 *
 * Same parity rules: do NOT change the arithmetic. The RSI in particular
 * is a building block for stochRsi, regime detection, and the Oracle aggregator.
 */

import type { Candle } from '../../state/types.js';
import { sma } from './moving-avg.js';
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
