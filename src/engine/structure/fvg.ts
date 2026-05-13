/**
 * Fair Value Gap (FVG) detection.
 * Source: candleIndex2.html line 10828.
 *
 * FVG = 3-candle imbalance where candle[i-2] high is below candle[i] low
 * (bullish gap) — institutional orders left an untraded area. Price tends to
 * revisit and fill the gap.
 */

import type { Candle } from '../../state/types.js';
import type { FVG, FVGResult } from '../../state/flow-types.js';

/**
 * detectFVG — scans the last up to 50 candles, returns unfilled bullish and
 * bearish FVGs, plus a directional score and the nearest active gap.
 */
export function detectFVG(cd: readonly Candle[]): FVGResult {
  if (!cd || cd.length < 5) {
    return { bullish: [], bearish: [], score: 0, dir: 0, nearBull: null, nearBear: null };
  }
  const price = cd[cd.length - 1]!.close;
  const bullFVGs: FVG[] = [];
  const bearFVGs: FVG[] = [];
  const lookback = Math.min(50, cd.length - 2);

  for (let i = 2; i < lookback; i++) {
    const c1 = cd[cd.length - 1 - i];
    const c2 = cd[cd.length - 2 - i];
    const c3 = cd[cd.length - 3 - i];

    // Bullish FVG: c1.low > c3.high
    if (c1 && c2 && c3 && c1.low > c3.high) {
      const mid = (c1.low + c3.high) / 2;
      const size = ((c1.low - c3.high) / c3.high) * 100;
      if (size > 0.05 && !bullFVGs.some((f) => Math.abs(f.mid - mid) / mid < 0.002)) {
        bullFVGs.push({ top: c1.low, bot: c3.high, mid, size, filled: price < c3.high });
      }
    }
    // Bearish FVG: c1.high < c3.low
    if (c1 && c2 && c3 && c1.high < c3.low) {
      const mid = (c1.high + c3.low) / 2;
      const size = ((c3.low - c1.high) / c3.low) * 100;
      if (size > 0.05 && !bearFVGs.some((f) => Math.abs(f.mid - mid) / mid < 0.002)) {
        bearFVGs.push({ top: c3.low, bot: c1.high, mid, size, filled: price > c1.high });
      }
    }
  }

  const activeBull = bullFVGs.filter((f) => !f.filled);
  const activeBear = bearFVGs.filter((f) => !f.filled);

  const nearBull =
    activeBull.slice().sort((a, b) => Math.abs(a.mid - price) - Math.abs(b.mid - price))[0] ?? null;
  const nearBear =
    activeBear.slice().sort((a, b) => Math.abs(a.mid - price) - Math.abs(b.mid - price))[0] ?? null;

  let score = 0;
  if (nearBull) {
    const d = ((price - nearBull.top) / price) * 100;
    if (price > nearBull.top) score += d < 1 ? 0.7 : d < 2 ? 0.4 : 0.2;
    else score += d < 1 ? 0.5 : d < 2 ? 0.3 : 0.1;
  }
  if (nearBear) {
    const d = ((nearBear.bot - price) / price) * 100;
    if (price < nearBear.bot) score -= d < 1 ? 0.7 : d < 2 ? 0.4 : 0.2;
    else score -= d < 1 ? 0.5 : d < 2 ? 0.3 : 0.1;
  }

  const dir: -1 | 0 | 1 = score > 0.15 ? 1 : score < -0.15 ? -1 : 0;
  return {
    bullish: activeBull,
    bearish: activeBear,
    score: Math.max(-1, Math.min(1, score)),
    dir,
    nearBull,
    nearBear,
  };
}
