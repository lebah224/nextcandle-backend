/**
 * Market structure — Swing High/Low detection + SMC (Smart Money Concepts)
 * CHoCH / MSB / HH-HL / LH-LL classification.
 *
 * Source: candleIndex2.html lines 13987-14033.
 * Critical for the Oracle aggregator (structure component weight ~10%).
 */

import type {
  Candle,
  Direction,
} from '../../state/types.js';
import type {
  SwingsResult,
  MarketStructureResult,
  SwingPoint,
} from '../../state/flow-types.js';

/**
 * detectSwings — finds local swing highs and lows using `lb` bars of look-back
 * and look-forward (window of 2·lb+1).
 *
 * Source: candleIndex2.html line 13987.
 */
export function detectSwings(cd: readonly Candle[], lb = 3): SwingsResult {
  const sh: SwingPoint[] = [];
  const sl: SwingPoint[] = [];
  const n = cd.length;
  for (let i = lb; i < n - lb; i++) {
    const ci = cd[i]!;
    let isSH = true;
    let isSL = true;
    for (let j = i - lb; j <= i + lb; j++) {
      if (j === i) continue;
      const cj = cd[j]!;
      if (cj.high >= ci.high) isSH = false;
      if (cj.low <= ci.low) isSL = false;
    }
    if (isSH) sh.push({ i, price: ci.high });
    if (isSL) sl.push({ i, price: ci.low });
  }
  return { sh, sl };
}

/**
 * detectMarketStructure — SMC analysis.
 * Returns:
 *   - `dir`   : structural bias (HH/HL = +1, LH/LL = -1, mixed = 0)
 *   - `msb`   : Market Structure Break — has price closed past last swing? (-1/0/+1)
 *   - `choch` : Change of Character — bullish MSB after a bear structure (or vice versa)
 *   - `label` : 'HH/HL' / 'LH/LL' / 'Mixte' / '—'
 *   - `swingH`, `swingL` : last detected swing high/low
 *
 * Source: candleIndex2.html line 14003.
 */
export function detectMarketStructure(
  cd: readonly Candle[],
  lb = 3,
): MarketStructureResult {
  if (!cd || cd.length < lb * 2 + 5) {
    return { dir: 0, msb: 0, choch: false, label: '—', swingH: null, swingL: null };
  }
  const { sh, sl } = detectSwings(cd, lb);
  const cur = cd[cd.length - 1]!.close;
  const swingH = sh.length ? sh[sh.length - 1]! : null;
  const swingL = sl.length ? sl[sl.length - 1]! : null;

  if (sh.length < 2 || sl.length < 2) {
    const msbVal: Direction =
      swingH && cur > swingH.price ? 1 : swingL && cur < swingL.price ? -1 : 0;
    return { dir: 0, msb: msbVal, choch: false, label: '—', swingH, swingL };
  }

  const lH = sh[sh.length - 1]!;
  const pH = sh[sh.length - 2]!;
  const lL = sl[sl.length - 1]!;
  const pL = sl[sl.length - 2]!;

  const hhhl = lH.price > pH.price && lL.price > pL.price;
  const lhll = lH.price < pH.price && lL.price < pL.price;

  const bullMSB = cur > lH.price;
  const bearMSB = cur < lL.price;
  const msb: Direction = bullMSB ? 1 : bearMSB ? -1 : 0;

  const choch = (lhll && bullMSB) || (hhhl && bearMSB);

  const dir: Direction = hhhl ? 1 : lhll ? -1 : 0;
  const label = hhhl ? 'HH/HL' : lhll ? 'LH/LL' : 'Mixte';

  return { dir, msb, choch, label, swingH: lH, swingL: lL };
}
