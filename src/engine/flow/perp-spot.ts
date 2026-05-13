/**
 * computePerpSpotScore — Perpetual vs Spot premium analysis.
 * Source: candleIndex2.html line 10975.
 *
 * Premium (Binance Futures vs Coinbase Spot, in %) tends to revert to 0
 * via arbitrage → predictive signal.
 *   Positive premium → futures too expensive → bearish pressure incoming
 *   Negative premium → futures discounted → bullish pressure incoming
 */

import type { PerpSpotState } from '../../state/flow-types.js';

/**
 * Mutates `state.premHistory`, `state.score`, `state.dir`.
 */
export function computePerpSpotScore(state: PerpSpotState): {
  score: number;
  dir: -1 | 0 | 1;
  premium: number;
  velocity?: number;
} {
  if (!state.loaded) return { score: 0, dir: 0, premium: 0 };
  const p = state.premium;

  state.premHistory.push(p);
  if (state.premHistory.length > 30) state.premHistory.shift();

  const hist = state.premHistory;
  const vel =
    hist.length >= 6
      ? hist.slice(-3).reduce((a, b) => a + b, 0) / 3 -
        hist.slice(-6, -3).reduce((a, b) => a + b, 0) / 3
      : 0;

  let score = 0;
  if (p > 0.1) score = -0.75 + vel * -5;
  else if (p > 0.05) score = -0.45 + vel * -3;
  else if (p > 0.02) score = -0.2;
  else if (p < -0.1) score = 0.75 + vel * 5;
  else if (p < -0.05) score = 0.45 + vel * 3;
  else if (p < -0.02) score = 0.2;

  if (Math.abs(vel) > 0.02) score += vel > 0 ? -0.15 : 0.15;

  score = Math.max(-1, Math.min(1, score));
  state.score = score;
  state.dir = score > 0.12 ? 1 : score < -0.12 ? -1 : 0;
  return { score, dir: state.dir, premium: p, velocity: vel };
}
