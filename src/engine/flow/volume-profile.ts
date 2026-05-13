/**
 * Volume Profile — POC (Point of Control) + Value Area (70%).
 * Source: candleIndex2.html line 10857.
 *
 * The HTML reads `analysisTF` from global state to pick 100 or 200 bins;
 * the worker takes the TF as an explicit argument.
 */

import type { Candle, AnyTF } from '../../state/types.js';
import type { VolumeProfileResult } from '../../state/flow-types.js';

/**
 * computeVolumeProfile — last `N` candles binned by close price, returns:
 *   - poc : price of the highest-volume bin
 *   - vah : Value Area High (top of the 70% volume zone around POC)
 *   - val : Value Area Low
 *   - loaded: false when no data
 *
 * Bins: 200 for H1+ (better granularity on longer ranges), 100 otherwise.
 */
export function computeVolumeProfile(
  cd: readonly Candle[],
  analysisTF: AnyTF,
): VolumeProfileResult {
  const N = Math.min(200, cd.length);
  const sl = cd.slice(-N);
  if (!sl.length) return { poc: 0, vah: 0, val: 0, loaded: false };

  const lo = Math.min(...sl.map((c) => c.low));
  const hi = Math.max(...sl.map((c) => c.high));
  const range = hi - lo || 1;

  const BINS = analysisTF === 'h1' ? 200 : 100;
  const bins = new Array<number>(BINS).fill(0);

  sl.forEach((c) => {
    const b = Math.min(BINS - 1, Math.floor(((c.close - lo) / range) * BINS));
    bins[b] = (bins[b] ?? 0) + (c.vol || 0);
  });

  const pocBin = bins.indexOf(Math.max(...bins));
  const poc = lo + (pocBin / BINS) * range;

  const totalVol = bins.reduce((a, b) => a + b, 1);
  const target = totalVol * 0.7;
  let accum = bins[pocBin] ?? 0;
  let low = pocBin;
  let high = pocBin;

  while (accum < target && (low > 0 || high < BINS - 1)) {
    const vl = low > 0 ? (bins[low - 1] ?? 0) : 0;
    const vh = high < BINS - 1 ? (bins[high + 1] ?? 0) : 0;
    if (vl >= vh && low > 0) {
      accum += vl;
      low--;
    } else if (high < BINS - 1) {
      accum += vh;
      high++;
    } else {
      break;
    }
  }

  return {
    poc,
    vah: lo + (high / BINS) * range,
    val: lo + (low / BINS) * range,
    loaded: true,
  };
}
