/**
 * Support/Resistance levels — direct ports from candleIndex2.html.
 *
 * Includes:
 *   - `fibonacci`  : 4 retracement levels over the last 50 candles + status
 *   - `detectSR`   : naive S/R pivot detection (5-bar fractals)
 *   - `pivots`     : daily / classic pivot points
 */

import type { Candle, Direction } from '../../state/types.js';

/**
 * Fibonacci retracements over the last 50 candles.
 * Source: candleIndex2.html line 10602.
 */
export function fibonacci(cd: readonly Candle[]): {
  sig: Direction;
  txt: string;
  r236: number;
  r382: number;
  r5: number;
  r618: number;
} {
  const n = 50;
  const s = cd.slice(-n);
  const h = Math.max(...s.map((c) => c.high));
  const l = Math.min(...s.map((c) => c.low));
  const price = cd[cd.length - 1]!.close;
  const r236 = h - (h - l) * 0.236;
  const r382 = h - (h - l) * 0.382;
  const r5 = h - (h - l) * 0.5;
  const r618 = h - (h - l) * 0.618;

  let txt = 'Neutre';
  let sig: Direction = 0;
  if (price > r382 && price < r618) {
    txt = 'Fib 38-62%';
  } else if (price < r618) {
    txt = '< 61.8%';
    sig = -1;
  } else if (price > r382) {
    txt = '> 38.2%';
    sig = 1;
  }
  return { sig, txt, r236, r382, r5, r618 };
}

/**
 * detectSR — finds 5-bar fractal pivots, then the nearest one to `price`.
 * Source: candleIndex2.html line 10603.
 *
 * Returns the nearest level (or null) and the distance to it in percent.
 */
export function detectSR(
  cd: readonly Candle[],
  price: number,
): { near: { p: number; t: 'R' | 'S' } | null; dist: number } {
  const lvl: Array<{ p: number; t: 'R' | 'S' }> = [];
  for (let i = 2; i < cd.length - 2; i++) {
    const c = cd[i]!;
    const c1 = cd[i - 1]!;
    const c2 = cd[i - 2]!;
    const cn1 = cd[i + 1]!;
    const cn2 = cd[i + 2]!;

    if (
      c.high > c1.high &&
      c.high > c2.high &&
      c.high > cn1.high &&
      c.high > cn2.high
    ) {
      lvl.push({ p: c.high, t: 'R' });
    }
    if (c.low < c1.low && c.low < c2.low && c.low < cn1.low && c.low < cn2.low) {
      lvl.push({ p: c.low, t: 'S' });
    }
  }

  let near: { p: number; t: 'R' | 'S' } | null = null;
  let md = Infinity;
  for (const lv of lvl) {
    const d = (Math.abs(lv.p - price) / price) * 100;
    if (d < md) {
      md = d;
      near = lv;
    }
  }
  return { near, dist: md };
}

/**
 * Classic pivots based on the previous candle.
 * Source: candleIndex2.html line 10604.
 */
export function pivots(cd: readonly Candle[]): { sig: Direction; txt: string } {
  const last = cd[cd.length - 1]!;
  const prev = cd[cd.length - 2] ?? last;
  const pp = (prev.high + prev.low + prev.close) / 3;
  const price = last.close;
  const r1 = 2 * pp - prev.low;
  const s1 = 2 * pp - prev.high;
  return {
    sig: price > r1 ? 1 : price < s1 ? -1 : price > pp ? 1 : -1,
    txt: `PP:${Math.round(pp)} R1:${Math.round(r1)} S1:${Math.round(s1)}`,
  };
}
