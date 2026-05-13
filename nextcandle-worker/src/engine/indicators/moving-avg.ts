/**
 * Moving average indicators — direct ports from candleIndex2.html.
 * 
 * Each function preserves the exact arithmetic of the reference implementation
 * to guarantee parity. Do NOT "optimize" or "improve" without re-running the
 * full parity test suite; numerical drift breaks the score Oracle.
 */

import { L } from './helpers.js';

/**
 * EMA (Exponential Moving Average).
 * Source: candleIndex2.html line 10551.
 *
 * Returns an array of the same length as input, with zeros for the first p-1
 * positions, then the EMA values starting from index p-1.
 *
 * Note: matches the HTML signature — returns numeric array, never NaN.
 */
export function ema(a: readonly number[], p: number): number[] {
  if (a.length < p) return a.map(() => 0);
  const k = 2 / (p + 1);
  let v = a.slice(0, p).reduce((x, y) => x + y) / p;
  const r: number[] = Array(p - 1).fill(0).concat([v]);
  for (let i = p; i < a.length; i++) {
    const ai = a[i];
    if (ai === undefined) continue;
    v = ai * k + v * (1 - k);
    r.push(v);
  }
  return r;
}

/**
 * WMA (Weighted Moving Average).
 * Source: candleIndex2.html line 10552.
 *
 * Returns an array of length (a.length - p + 1) — note this is shorter than
 * the input, unlike EMA. The HTML reference uses this asymmetry intentionally.
 */
export function wma(a: readonly number[], p: number): number[] {
  const r: number[] = [];
  for (let i = p - 1; i < a.length; i++) {
    let s = 0;
    let w = 0;
    for (let j = 0; j < p; j++) {
      const v = a[i - j];
      if (v === undefined) continue;
      s += v * (p - j);
      w += p - j;
    }
    r.push(s / w);
  }
  return r;
}

/**
 * SMA (Simple Moving Average).
 * Source: candleIndex2.html line 10553.
 *
 * Returns an array of length (a.length - p + 1).
 */
export function sma(a: readonly number[], p: number): number[] {
  const r: number[] = [];
  for (let i = p - 1; i < a.length; i++) {
    r.push(a.slice(i - p + 1, i + 1).reduce((x, y) => x + y) / p);
  }
  return r;
}

/**
 * HMA (Hull Moving Average).
 * Source: candleIndex2.html line 10556.
 *
 * Combines two WMAs to reduce lag while preserving smoothness.
 */
export function hma(a: readonly number[], p: number): number[] {
  const sq = Math.round(Math.sqrt(p));
  const h = Math.floor(p / 2);
  const w1 = wma(a, h);
  const w2 = wma(a, p);
  const l = Math.min(w1.length, w2.length);
  const synthetic = Array.from({ length: l }, (_, i) => {
    const a1 = w1[w1.length - l + i];
    const a2 = w2[w2.length - l + i];
    if (a1 === undefined || a2 === undefined) return 0;
    return 2 * a1 - a2;
  });
  return wma(synthetic, sq);
}

/**
 * DEMA (Double Exponential Moving Average).
 * Source: candleIndex2.html line 10557.
 */
export function dema(a: readonly number[], p: number): number[] {
  const e1 = ema(a, p);
  const e2 = ema(e1, p);
  const l = Math.min(e1.length, e2.length);
  return Array.from({ length: l }, (_, i) => {
    const v1 = e1[e1.length - l + i];
    const v2 = e2[e2.length - l + i];
    if (v1 === undefined || v2 === undefined) return 0;
    return 2 * v1 - v2;
  });
}

/**
 * TEMA (Triple Exponential Moving Average).
 * Source: candleIndex2.html line 10558.
 */
export function tema(a: readonly number[], p: number): number[] {
  const e1 = ema(a, p);
  const e2 = ema(e1, p);
  const e3 = ema(e2, p);
  const l = Math.min(e1.length, e2.length, e3.length);
  return Array.from({ length: l }, (_, i) => {
    const v1 = e1[e1.length - l + i];
    const v2 = e2[e2.length - l + i];
    const v3 = e3[e3.length - l + i];
    if (v1 === undefined || v2 === undefined || v3 === undefined) return 0;
    return 3 * v1 - 3 * v2 + v3;
  });
}

/**
 * ALMA (Arnaud Legoux Moving Average).
 * Source: candleIndex2.html line 10559.
 *
 * @param off offset (default 0.85, range 0-1)
 * @param sig sigma (default 6)
 */
export function alma(
  a: readonly number[],
  p: number,
  off = 0.85,
  sig = 6,
): number[] {
  const r: number[] = [];
  for (let i = p - 1; i < a.length; i++) {
    const sl = a.slice(i - p + 1, i + 1);
    const m = Math.floor(off * (p - 1));
    const d = p / sig / sig;
    let s = 0;
    let sw = 0;
    for (let j = 0; j < p; j++) {
      const slj = sl[j];
      if (slj === undefined) continue;
      const jm = j - m;
      const w = Math.exp(-(jm * jm) / (2 * d));
      s += slj * w;
      sw += w;
    }
    r.push(sw ? s / sw : 0);
  }
  return r;
}

// Re-export helper for convenience
export { L };
