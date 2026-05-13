/**
 * computeFRCrossScore — Funding Rate Cross-Exchange Divergence.
 * Source: candleIndex2.html line 11013.
 *
 * Binance FR vs Bybit FR : if they diverge, arbitrageurs will normalize them
 * → predictable direction of normalization on Binance.
 */

import type { FRCrossState } from '../../state/flow-types.js';

/**
 * Mutates `state.score`, `state.dir`.
 */
export function computeFRCrossScore(state: FRCrossState): {
  score: number;
  dir: -1 | 0 | 1;
  divergence: number;
} {
  if (!state.loaded) return { score: 0, dir: 0, divergence: 0 };
  const div = state.divergence;
  const score = Math.max(
    -1,
    Math.min(
      1,
      div > 0.04
        ? -0.7
        : div > 0.02
          ? -0.45
          : div > 0.01
            ? -0.2
            : div < -0.04
              ? 0.7
              : div < -0.02
                ? 0.45
                : div < -0.01
                  ? 0.2
                  : 0,
    ),
  );
  state.score = score;
  state.dir = score > 0.12 ? 1 : score < -0.12 ? -1 : 0;
  return { score, dir: state.dir, divergence: div };
}
