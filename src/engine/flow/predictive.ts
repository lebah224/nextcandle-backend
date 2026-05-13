/**
 * computePredictiveScore — Funding Rate Velocity + Open Interest Divergence.
 * Source: candleIndex2.html line 10906.
 *
 * Both indicators are PREDICTIVE (they cause a future move),
 * unlike Order Book which describes the present.
 *
 * Rules :
 *   - FR rises fast  → longs accumulate → bearish squeeze likely
 *   - FR falls fast  → shorts accumulate → bullish squeeze likely
 *   - Price↑ + OI↑ : real trend, continue
 *   - Price↑ + OI↓ : longs closing, weak move → reversal probable
 *   - Price↓ + OI↑ : shorts adding → bearish continuation
 *   - Price↓ + OI↓ : shorts closing → rebound probable
 */

import type { Candle } from '../../state/types.js';
import type { FundData, FRVelState, OIDivState } from '../../state/flow-types.js';

/**
 * Mutates `frVel` (pushes new FR + trims, updates velocity & score)
 * and `oiDiv` (sets divergence & score). Returns the combined predictive output.
 */
export function computePredictiveScore(
  fund: FundData,
  frVel: FRVelState,
  oiDiv: OIDivState,
  activeCandles: readonly Candle[],
  now: number = Date.now(),
): {
  score: number;
  dir: -1 | 0 | 1;
  frVel: number;
  frScore: number;
  oiScore: number;
} {
  const safe = (v: number, f = 0): number =>
    typeof v === 'number' && isFinite(v) ? v : f;
  const fr = safe(fund.fundingRate, 0);
  const oi = safe(fund.oiChange, 0);

  // ── FR velocity ─────────────────────────────────────────────────────
  frVel.history.push({ fr, t: now });
  if (frVel.history.length > 20) frVel.history.shift();
  frVel.lastFR = fr;

  let frVelScore = 0;
  if (frVel.history.length >= 6) {
    const recent = frVel.history.slice(-3).reduce((a, x) => a + x.fr, 0) / 3;
    const older = frVel.history.slice(-6, -3).reduce((a, x) => a + x.fr, 0) / 3;
    const velocity = recent - older;

    frVelScore =
      velocity < -0.03
        ? 0.7
        : velocity < -0.01
          ? 0.4
          : velocity > 0.03
            ? -0.7
            : velocity > 0.01
              ? -0.4
              : fr < -0.04
                ? 0.5
                : fr > 0.08
                  ? -0.5
                  : fr > 0.04
                    ? -0.25
                    : 0;
    frVel.velocity = velocity;
  }
  frVel.score = frVelScore;

  // ── OI divergence ───────────────────────────────────────────────────
  const priceTrend =
    activeCandles.length >= 6
      ? (activeCandles[activeCandles.length - 1]!.close >
        activeCandles[activeCandles.length - 6]!.close
          ? 1
          : -1)
      : 0;
  let oiDivScore = 0;
  if (Math.abs(oi) > 0.3) {
    if (priceTrend > 0 && oi > 1.0) oiDivScore = 0.6;
    else if (priceTrend > 0 && oi < -0.5) oiDivScore = -0.55;
    else if (priceTrend < 0 && oi > 1.0) oiDivScore = -0.6;
    else if (priceTrend < 0 && oi < -0.5) oiDivScore = 0.55;
    else if (priceTrend > 0 && oi > 0.3) oiDivScore = 0.3;
    else if (priceTrend < 0 && oi < -0.3) oiDivScore = 0.3;
  }
  oiDiv.divergence = oi;
  oiDiv.score = oiDivScore;

  // ── Final combined score (60% FR vel + 40% OI div) ──────────────────
  const combined = Math.max(-1, Math.min(1, frVelScore * 0.6 + oiDivScore * 0.4));
  return {
    score: combined,
    dir: combined > 0.12 ? 1 : combined < -0.12 ? -1 : 0,
    frVel: frVel.velocity,
    frScore: frVelScore,
    oiScore: oiDivScore,
  };
}
