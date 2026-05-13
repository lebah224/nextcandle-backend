/**
 * Volume Absorption — tape-reading style detector.
 * Source: candleIndex2.html line 11072.
 *
 * High volume + small range = someone is absorbing the order flow.
 * The next candle tends to move in the absorber's direction
 * (opposite of the absorbed flow).
 */

import type { Candle } from '../../state/types.js';
import type { VolumeAbsorptionResult } from '../../state/flow-types.js';

export function computeVolumeAbsorption(cd: readonly Candle[]): VolumeAbsorptionResult {
  if (!cd || cd.length < 25) return { score: 0, dir: 0, signal: '—' };

  const avgVol = cd.slice(-21, -1).reduce((a, b) => a + (b.vol || 0), 0) / 20 || 1;
  const avgRange =
    cd.slice(-21, -1).reduce((a, b) => a + (b.high - b.low), 0) / 20 || 1;

  // c = currently forming, c1 = last closed
  const c1 = cd[cd.length - 2]!;
  const volRatio = (c1.vol || 0) / avgVol;
  const rangeRatio = (c1.high - c1.low) / avgRange;

  if (volRatio < 2.0 || rangeRatio > 0.4) {
    return { score: 0, dir: 0, signal: '—' };
  }

  const isBearCandle = c1.close < c1.open;
  const bodyRatio = Math.abs(c1.close - c1.open) / (c1.high - c1.low || 1);

  let score = 0;
  let signal = '—';
  const strength = Math.min(1, (volRatio - 2) * 0.3) * (1 - rangeRatio);

  if (isBearCandle && bodyRatio < 0.35) {
    score = strength * 0.75;
    signal = `Absorption haussière (Vol ${volRatio.toFixed(1)}×)`;
  } else if (!isBearCandle && bodyRatio < 0.35) {
    score = -strength * 0.75;
    signal = `Absorption baissière (Vol ${volRatio.toFixed(1)}×)`;
  }

  score = Math.max(-1, Math.min(1, score));
  return {
    score,
    dir: score > 0.1 ? 1 : score < -0.1 ? -1 : 0,
    signal,
  };
}
