/**
 * CVD (Cumulative Volume Delta) analytics.
 *
 * - computeCVDAccelScore : acceleration + smart-money imbalance
 * - cvdDirectionProb     : normalized directional probability (25–75%)
 *
 * Source: candleIndex2.html lines 10878-10888 and 11555-11567.
 */

import type { CVDAccelState, CVDDirState } from '../../state/flow-types.js';

/**
 * computeCVDAccelScore.
 * MUTATES `state.cvdSpeedHist` in place (pushes abs(cvdSpeed) if > 0, trims to 30).
 *
 * Returns `{score, speed, bigBuys, bigSells, dir}`.
 */
export function computeCVDAccelScore(state: CVDAccelState): {
  score: number;
  speed: number;
  bigBuys: number;
  bigSells: number;
  dir: -1 | 0 | 1;
} {
  const safe = (v: number, f = 0): number =>
    typeof v === 'number' && isFinite(v) ? v : f;

  const absSpd = Math.abs(state.cvdSpeed);
  if (absSpd > 0) {
    state.cvdSpeedHist.push(absSpd);
    if (state.cvdSpeedHist.length > 30) state.cvdSpeedHist.shift();
  }

  const maxSpd = Math.max(...state.cvdSpeedHist, 1);
  const normSpd = safe(state.cvdSpeed / maxSpd);

  const bigTot = state.cvdBigBuys + state.cvdBigSells || 1;
  const bigImb = (state.cvdBigBuys - state.cvdBigSells) / bigTot;

  const score = Math.max(-1, Math.min(1, normSpd * 0.6 + bigImb * 0.4));
  return {
    score,
    speed: state.cvdSpeed,
    bigBuys: state.cvdBigBuys,
    bigSells: state.cvdBigSells,
    dir: score > 0.15 ? 1 : score < -0.15 ? -1 : 0,
  };
}

/**
 * cvdDirectionProb — normalized to ±25% around 50.
 * Returns `{prob, normalized, raw, dirScore}` where dirScore is capped at ±0.65.
 *
 * Source: candleIndex2.html line 11557.
 */
export function cvdDirectionProb(state: CVDDirState): {
  prob: number;
  normalized: number;
  raw: number;
  dirScore: number;
} {
  const { curCVD, closedCVDs } = state;
  if (closedCVDs.length < 3) {
    return { prob: 50, normalized: 0, raw: curCVD, dirScore: 0 };
  }
  const allCVDs = [...closedCVDs.slice(-20), curCVD];
  const maxAbs = Math.max(...allCVDs.map(Math.abs)) || 1;
  const normalized = curCVD / maxAbs;
  const prob = Math.round(50 + normalized * 25);
  return {
    prob: Math.max(25, Math.min(75, prob)),
    normalized,
    raw: curCVD,
    dirScore: normalized * 0.65,
  };
}
