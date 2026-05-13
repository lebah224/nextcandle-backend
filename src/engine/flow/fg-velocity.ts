/**
 * computeFGVelocityScore — Fear & Greed Velocity.
 * Source: candleIndex2.html line 11039.
 *
 * The raw F&G value is not very predictive (extremes can persist).
 * The MOVEMENT toward an extreme is predictive of the subsequent reversal.
 */

import type { FGVelState } from '../../state/flow-types.js';

/**
 * Mutates `state.score`.
 */
export function computeFGVelocityScore(state: FGVelState): {
  score: number;
  dir: -1 | 0 | 1;
  velocity: number;
  current?: number;
} {
  const cur = state.current;
  const vel = state.velocity;
  if (state.history.length < 2) return { score: 0, dir: 0, velocity: 0 };

  let score = 0;
  if (vel > 15 && cur > 75) score = -0.65;
  else if (vel > 10 && cur > 65) score = -0.35;
  else if (vel > 8) score = 0.4;
  else if (vel < -15 && cur < 25) score = 0.65;
  else if (vel < -10 && cur < 35) score = 0.35;
  else if (vel < -8) score = -0.3;
  else if (cur > 80 && Math.abs(vel) < 5) score = -0.25;
  else if (cur < 20 && Math.abs(vel) < 5) score = 0.25;

  score = Math.max(-1, Math.min(1, score));
  state.score = score;
  return {
    score,
    dir: score > 0.12 ? 1 : score < -0.12 ? -1 : 0,
    velocity: vel,
    current: cur,
  };
}
