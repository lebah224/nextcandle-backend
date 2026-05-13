/**
 * Volatility indicators — direct ports from candleIndex2.html.
 *
 * Parity rule : do NOT change the arithmetic. Every function below is a
 * byte-for-byte port and is validated against the embedded HTML reference
 * in `tests/parity/volatility.parity.test.ts`.
 */

import type { Candle } from '../../state/types.js';
import { ema } from './moving-avg.js';
import { L } from './helpers.js';

/**
 * ATR — Average True Range.
 * Source: candleIndex2.html line 10579.
 *
 * Returns a single number (the latest ATR). The HTML averages the last `p`
 * True Range values; if `tr.length < p`, the average is over what's available.
 * Returns 0 if cd is too short (≤ 1 candle).
 */
export function atr(cd: readonly Candle[], p = 14): number {
  const tr: number[] = [];
  for (let i = 1; i < cd.length; i++) {
    const ci = cd[i]!;
    const cp = cd[i - 1]!;
    const h = ci.high;
    const l = ci.low;
    const pc = cp.close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return tr.slice(-p).reduce((a, b) => a + b, 0) / Math.min(p, tr.length) || 0;
}

/**
 * Bollinger Bands.
 * Source: candleIndex2.html line 10576.
 *
 * Returns upper/lower/mid (mean) and bw (bandwidth as % of mean × 4).
 * Uses last `p` closes; assumes `c.length >= p`.
 */
export function bb(
  c: readonly number[],
  p = 20,
): { upper: number; lower: number; mid: number; bw: number } {
  const s = c.slice(-p);
  const m = s.reduce((a, b) => a + b) / p;
  const std = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / p);
  return { upper: m + 2 * std, lower: m - 2 * std, mid: m, bw: ((4 * std) / m) * 100 };
}

/**
 * Keltner Channels.
 * Source: candleIndex2.html line 10577.
 *
 * Uses an EMA(p) of closes as the centerline and adds/subtracts 2×ATR(p).
 */
export function keltner(
  cd: readonly Candle[],
  p = 20,
): { upper: number; lower: number; mid: number } {
  const c = cd.map((x) => x.close);
  const e = ema(c, p);
  const a = atr(cd, p);
  return { upper: L(e) + 2 * a, lower: L(e) - 2 * a, mid: L(e) };
}

/**
 * Donchian Channels — highest high and lowest low of the last `p` candles.
 * Source: candleIndex2.html line 10578.
 */
export function donchian(
  cd: readonly Candle[],
  p = 20,
): { upper: number; lower: number } {
  const s = cd.slice(-p);
  return {
    upper: Math.max(...s.map((c) => c.high)),
    lower: Math.min(...s.map((c) => c.low)),
  };
}
