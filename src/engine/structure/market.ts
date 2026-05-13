/**
 * Simple market structure detector.
 *
 * The advanced `detectMarketStructure` (with CHoCH / MSB) lives in batch 2.2
 * (`market-structure.ts`). This file ports only the small `detectStructure`
 * function used by the technical-indicators pipeline.
 */

import type { Candle, Direction } from '../../state/types.js';

/**
 * detectStructure — coarse HH/HL or LL/LH detection over the last 8 candles.
 * Source: candleIndex2.html line 10605.
 */
export function detectStructure(cd: readonly Candle[]): {
  n: 'HH+HL' | 'LL+LH' | 'Range';
  d: Direction;
} {
  const c = cd.slice(-8);
  const hs = c.map((x) => x.high);
  const ls = c.map((x) => x.low);

  const hLast = hs[hs.length - 1]!;
  const lLast = ls[ls.length - 1]!;
  const hh = hLast > Math.max(...hs.slice(0, -1));
  const hl = lLast > Math.min(...ls.slice(0, -1));
  const ll = lLast < Math.min(...ls.slice(0, -1));
  const lh = hLast < Math.max(...hs.slice(0, -1));

  if (hh && hl) return { n: 'HH+HL', d: 1 };
  if (ll && lh) return { n: 'LL+LH', d: -1 };
  return { n: 'Range', d: 0 };
}
