/**
 * Parity tests for batch 2.2 STATEFUL flow functions:
 *   computeCVDAccelScore, cvdDirectionProb,
 *   computePredictiveScore, computePerpSpotScore,
 *   computeFRCrossScore, computeFGVelocityScore.
 *
 * Approach: each test sets up an equivalent state on both sides
 * (HTML uses module-level globals, worker uses explicit state arg)
 * and verifies that both the output AND the resulting state match.
 */

import { describe, it, expect } from 'vitest';
import { computeCVDAccelScore, cvdDirectionProb } from '../../src/engine/flow/cvd.js';
import { computePredictiveScore } from '../../src/engine/flow/predictive.js';
import { computePerpSpotScore } from '../../src/engine/flow/perp-spot.js';
import { computeFRCrossScore } from '../../src/engine/flow/funding-cross.js';
import { computeFGVelocityScore } from '../../src/engine/flow/fg-velocity.js';
import type {
  CVDAccelState,
  CVDDirState,
  FundData,
  FRVelState,
  OIDivState,
  PerpSpotState,
  FRCrossState,
  FGVelState,
} from '../../src/state/flow-types.js';

// ════════════════════════════════════════════════════════════════════════
//  HTML REFERENCE — verbatim from candleIndex2.html.
//  Each is wrapped in a "harness" that takes a state-shaped argument and
//  builds the globals the HTML expects. Globals are declared as outer
//  variables and re-assigned in each call to keep parity exact.
// ════════════════════════════════════════════════════════════════════════
/* eslint-disable */
// @ts-nocheck

// ── CVD accel ─────────────────────────────────────────────────────────
function html_computeCVDAccelScore(state) {
  // mirror globals
  let { cvdSpeed, cvdSpeedHist, cvdBigBuys, cvdBigSells } = state;
  // body (verbatim)
  const safe = (v, f = 0) => (typeof v === 'number' && isFinite(v)) ? v : f;
  const absSpd = Math.abs(cvdSpeed);
  if (absSpd > 0) { cvdSpeedHist.push(absSpd); if (cvdSpeedHist.length > 30) cvdSpeedHist.shift(); }
  const maxSpd = Math.max(...cvdSpeedHist, 1);
  const normSpd = safe(cvdSpeed / maxSpd);
  const bigTot = cvdBigBuys + cvdBigSells || 1;
  const bigImb = (cvdBigBuys - cvdBigSells) / bigTot;
  const score = Math.max(-1, Math.min(1, normSpd * 0.60 + bigImb * 0.40));
  return { score, speed: cvdSpeed, bigBuys: cvdBigBuys, bigSells: cvdBigSells, dir: score > 0.15 ? 1 : score < -0.15 ? -1 : 0 };
}

// ── CVD direction prob ────────────────────────────────────────────────
function html_cvdDirectionProb(state) {
  const curCVD = state.curCVD;
  const cvds = state.closedCVDs;
  if (cvds.length < 3) return { prob: 50, normalized: 0, raw: curCVD, dirScore: 0 };
  const allCVDs = [...cvds.slice(-20), curCVD];
  const maxAbs = Math.max(...allCVDs.map(Math.abs)) || 1;
  const normalized = curCVD / maxAbs;
  const prob = Math.round(50 + normalized * 25);
  return { prob: Math.max(25, Math.min(75, prob)), normalized, raw: curCVD, dirScore: normalized * 0.65 };
}

// ── computePredictiveScore ────────────────────────────────────────────
function html_computePredictiveScore(fundData, frVelData, oiDivData, activeCandles, now) {
  const safe = (v, f = 0) => typeof v === 'number' && isFinite(v) ? v : f;
  const fr = safe(fundData.fundingRate, 0);
  const oi = safe(fundData.oiChange, 0);
  frVelData.history.push({ fr, t: now });
  if (frVelData.history.length > 20) frVelData.history.shift();
  frVelData.lastFR = fr;
  let frVelScore = 0;
  if (frVelData.history.length >= 6) {
    const recent = frVelData.history.slice(-3).reduce((a, x) => a + x.fr, 0) / 3;
    const older = frVelData.history.slice(-6, -3).reduce((a, x) => a + x.fr, 0) / 3;
    const velocity = recent - older;
    frVelScore = velocity < -0.03 ? 0.7 : velocity < -0.01 ? 0.4 : velocity > 0.03 ? -0.7 : velocity > 0.01 ? -0.4 : fr < -0.04 ? 0.5 : fr > 0.08 ? -0.5 : fr > 0.04 ? -0.25 : 0;
    frVelData.velocity = velocity;
  }
  frVelData.score = frVelScore;
  const priceTrend = activeCandles.length >= 6 ? (activeCandles.slice(-1)[0].close > activeCandles.slice(-6)[0].close ? 1 : -1) : 0;
  let oiDivScore = 0;
  if (Math.abs(oi) > 0.3) {
    if (priceTrend > 0 && oi > 1.0) oiDivScore = 0.6;
    else if (priceTrend > 0 && oi < -0.5) oiDivScore = -0.55;
    else if (priceTrend < 0 && oi > 1.0) oiDivScore = -0.6;
    else if (priceTrend < 0 && oi < -0.5) oiDivScore = 0.55;
    else if (priceTrend > 0 && oi > 0.3) oiDivScore = 0.3;
    else if (priceTrend < 0 && oi < -0.3) oiDivScore = 0.3;
  }
  oiDivData.divergence = oi;
  oiDivData.score = oiDivScore;
  const combined = Math.max(-1, Math.min(1, frVelScore * 0.60 + oiDivScore * 0.40));
  return { score: combined, dir: combined > 0.12 ? 1 : combined < -0.12 ? -1 : 0, frVel: frVelData.velocity, frScore: frVelScore, oiScore: oiDivScore };
}

// ── computePerpSpotScore ──────────────────────────────────────────────
function html_computePerpSpotScore(perpSpotData) {
  if (!perpSpotData.loaded) return { score: 0, dir: 0, premium: 0 };
  const p = perpSpotData.premium;
  perpSpotData.premHistory.push(p);
  if (perpSpotData.premHistory.length > 30) perpSpotData.premHistory.shift();
  const hist = perpSpotData.premHistory;
  const vel = hist.length >= 6 ? (hist.slice(-3).reduce((a, b) => a + b, 0) / 3) - (hist.slice(-6, -3).reduce((a, b) => a + b, 0) / 3) : 0;
  let score = 0;
  if (p > 0.10) score = -0.75 + vel * (-5);
  else if (p > 0.05) score = -0.45 + vel * (-3);
  else if (p > 0.02) score = -0.20;
  else if (p < -0.10) score = 0.75 + vel * 5;
  else if (p < -0.05) score = 0.45 + vel * 3;
  else if (p < -0.02) score = 0.20;
  if (Math.abs(vel) > 0.02) score += vel > 0 ? -0.15 : 0.15;
  score = Math.max(-1, Math.min(1, score));
  perpSpotData.score = score;
  perpSpotData.dir = score > 0.12 ? 1 : score < -0.12 ? -1 : 0;
  return { score, dir: perpSpotData.dir, premium: p, velocity: vel };
}

// ── computeFRCrossScore ───────────────────────────────────────────────
function html_computeFRCrossScore(frCrossData) {
  if (!frCrossData.loaded) return { score: 0, dir: 0, divergence: 0 };
  const div = frCrossData.divergence;
  const score = Math.max(-1, Math.min(1, div > 0.04 ? -0.70 : div > 0.02 ? -0.45 : div > 0.01 ? -0.20 : div < -0.04 ? 0.70 : div < -0.02 ? 0.45 : div < -0.01 ? 0.20 : 0));
  frCrossData.score = score;
  frCrossData.dir = score > 0.12 ? 1 : score < -0.12 ? -1 : 0;
  return { score, dir: frCrossData.dir, divergence: div };
}

// ── computeFGVelocityScore ────────────────────────────────────────────
function html_computeFGVelocityScore(fgVelData) {
  const cur = fgVelData.current;
  const vel = fgVelData.velocity;
  if (fgVelData.history.length < 2) return { score: 0, dir: 0, velocity: 0 };
  let score = 0;
  if (vel > 15 && cur > 75) score = -0.65;
  else if (vel > 10 && cur > 65) score = -0.35;
  else if (vel > 8) score = 0.40;
  else if (vel < -15 && cur < 25) score = 0.65;
  else if (vel < -10 && cur < 35) score = 0.35;
  else if (vel < -8) score = -0.30;
  else if (cur > 80 && Math.abs(vel) < 5) score = -0.25;
  else if (cur < 20 && Math.abs(vel) < 5) score = 0.25;
  score = Math.max(-1, Math.min(1, score));
  fgVelData.score = score;
  return { score, dir: score > 0.12 ? 1 : score < -0.12 ? -1 : 0, velocity: vel, current: cur };
}
/* eslint-enable */

const PARITY_TOL = 1e-9;

// Deep-clone helper for state isolation between HTML/worker runs
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

describe('PARITY — batch 2.2 STATEFUL flow functions', () => {
  // ── CVD accel ────────────────────────────────────────────────────────
  describe('computeCVDAccelScore', () => {
    const cases: Array<{ name: string; state: CVDAccelState }> = [
      { name: 'baseline bull (speed=200, big buys dominant)', state: { cvdSpeed: 200, cvdSpeedHist: [50, 80, 120], cvdBigBuys: 1500, cvdBigSells: 300 } },
      { name: 'baseline bear (negative speed, big sells)', state: { cvdSpeed: -300, cvdSpeedHist: [100, 150], cvdBigBuys: 200, cvdBigSells: 1200 } },
      { name: 'zero speed (no push to hist)', state: { cvdSpeed: 0, cvdSpeedHist: [10, 20, 30], cvdBigBuys: 50, cvdBigSells: 50 } },
      { name: 'hist trim at length=30', state: { cvdSpeed: 500, cvdSpeedHist: Array.from({ length: 30 }, (_, i) => i + 1), cvdBigBuys: 0, cvdBigSells: 0 } },
      { name: 'big tot zero', state: { cvdSpeed: 100, cvdSpeedHist: [50], cvdBigBuys: 0, cvdBigSells: 0 } },
    ];

    cases.forEach(({ name, state }) => {
      it(name, () => {
        const sA = clone(state);
        const sB = clone(state);
        const a = computeCVDAccelScore(sA);
        const b = html_computeCVDAccelScore(sB);
        expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
        expect(a.dir).toBe(b.dir);
        expect(a.speed).toBe(b.speed);
        // Verify state mutations match exactly
        expect(sA.cvdSpeedHist).toEqual(sB.cvdSpeedHist);
      });
    });
  });

  // ── CVD direction prob ───────────────────────────────────────────────
  describe('cvdDirectionProb', () => {
    const cases: Array<{ name: string; state: CVDDirState }> = [
      { name: 'too few closed CVDs (<3)', state: { curCVD: 500, closedCVDs: [100, 200] } },
      { name: 'normal mid range', state: { curCVD: 150, closedCVDs: [50, -80, 200, -120, 90, 60, -50, 100, 200, 250, 300, 150, -100, 80, 60, -30, 50, 70, 90, 200] } },
      { name: 'extreme positive (cap at 75%)', state: { curCVD: 5000, closedCVDs: [100, 200, -50, 80, -120, 60, 150] } },
      { name: 'extreme negative (cap at 25%)', state: { curCVD: -5000, closedCVDs: [-100, -200, 50, -80, 120, 60, 150] } },
      { name: 'zero curCVD', state: { curCVD: 0, closedCVDs: [100, -100, 50, -50, 80] } },
    ];

    cases.forEach(({ name, state }) => {
      it(name, () => {
        expect(cvdDirectionProb(clone(state))).toEqual(html_cvdDirectionProb(clone(state)));
      });
    });
  });

  // ── computePredictiveScore ───────────────────────────────────────────
  describe('computePredictiveScore', () => {
    function freshState(): { fund: FundData; frVel: FRVelState; oiDiv: OIDivState } {
      return {
        fund: { fundingRate: 0.05, oiChange: 1.2 },
        frVel: { history: [], lastFR: 0, velocity: 0, score: 0 },
        oiDiv: { divergence: 0, score: 0 },
      };
    }
    function activeCandles(closes: number[]) {
      return closes.map((c, i) => ({ open: c, high: c + 10, low: c - 10, close: c, vol: 100, ts: 1000 + i * 1000 }));
    }

    it('matches HTML on building-up FR history', () => {
      const sA = freshState();
      const sB = freshState();
      const cd = activeCandles([60000, 60100, 60200, 60150, 60250, 60300, 60350]);
      const now = 1700000000000;
      const a = computePredictiveScore(sA.fund, sA.frVel, sA.oiDiv, cd, now);
      const b = html_computePredictiveScore(sB.fund, sB.frVel, sB.oiDiv, cd, now);
      expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
      expect(a.dir).toBe(b.dir);
      expect(sA.frVel.history).toEqual(sB.frVel.history);
      expect(sA.frVel.velocity).toBe(sB.frVel.velocity);
      expect(sA.oiDiv).toEqual(sB.oiDiv);
    });

    it('matches HTML on repeated calls (history grows + velocity emerges)', () => {
      const sA = freshState();
      const sB = freshState();
      const frPath = [0.01, 0.02, 0.03, 0.05, 0.07, 0.08, 0.09, 0.1];
      const cd = activeCandles([60000, 60100, 60200, 60150, 60250, 60300, 60350]);
      for (let k = 0; k < frPath.length; k++) {
        sA.fund.fundingRate = frPath[k]!;
        sB.fund.fundingRate = frPath[k]!;
        const now = 1700000000000 + k * 60_000;
        const a = computePredictiveScore(sA.fund, sA.frVel, sA.oiDiv, cd, now);
        const b = html_computePredictiveScore(sB.fund, sB.frVel, sB.oiDiv, cd, now);
        expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
        expect(a.dir).toBe(b.dir);
        expect(sA.frVel.history).toEqual(sB.frVel.history);
      }
    });

    it('OI div + bearish price trend matches', () => {
      const sA = freshState();
      const sB = freshState();
      sA.fund.oiChange = -0.6; sB.fund.oiChange = -0.6;
      const cd = activeCandles([60500, 60400, 60300, 60200, 60100, 60000, 59900]); // declining
      const now = 1700000000000;
      const a = computePredictiveScore(sA.fund, sA.frVel, sA.oiDiv, cd, now);
      const b = html_computePredictiveScore(sB.fund, sB.frVel, sB.oiDiv, cd, now);
      expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
      expect(a.dir).toBe(b.dir);
    });
  });

  // ── computePerpSpotScore ─────────────────────────────────────────────
  describe('computePerpSpotScore', () => {
    const cases: Array<{ name: string; state: PerpSpotState }> = [
      { name: 'not loaded', state: { premium: 0.5, premHistory: [], score: 0, dir: 0, loaded: false } },
      { name: 'big positive premium', state: { premium: 0.15, premHistory: [0.05, 0.08, 0.10, 0.12, 0.13, 0.14, 0.15], score: 0, dir: 0, loaded: true } },
      { name: 'big negative premium', state: { premium: -0.15, premHistory: [-0.05, -0.08, -0.10, -0.12, -0.13, -0.14, -0.15], score: 0, dir: 0, loaded: true } },
      { name: 'small positive premium', state: { premium: 0.03, premHistory: [], score: 0, dir: 0, loaded: true } },
      { name: 'history trims at 30', state: { premium: 0.06, premHistory: Array.from({ length: 30 }, (_, i) => 0.001 * i), score: 0, dir: 0, loaded: true } },
    ];

    cases.forEach(({ name, state }) => {
      it(name, () => {
        const sA = clone(state);
        const sB = clone(state);
        const a = computePerpSpotScore(sA);
        const b = html_computePerpSpotScore(sB);
        expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
        expect(a.dir).toBe(b.dir);
        expect(a.premium).toBe(b.premium);
        expect(sA.premHistory).toEqual(sB.premHistory);
        expect(sA.score).toBe(sB.score);
        expect(sA.dir).toBe(sB.dir);
      });
    });
  });

  // ── computeFRCrossScore ──────────────────────────────────────────────
  describe('computeFRCrossScore', () => {
    const cases: Array<{ name: string; state: FRCrossState }> = [
      { name: 'not loaded', state: { divergence: 0.5, score: 0, dir: 0, loaded: false } },
      { name: 'high positive div', state: { divergence: 0.05, score: 0, dir: 0, loaded: true } },
      { name: 'medium positive', state: { divergence: 0.025, score: 0, dir: 0, loaded: true } },
      { name: 'small positive', state: { divergence: 0.015, score: 0, dir: 0, loaded: true } },
      { name: 'tiny positive (below threshold)', state: { divergence: 0.005, score: 0, dir: 0, loaded: true } },
      { name: 'high negative', state: { divergence: -0.06, score: 0, dir: 0, loaded: true } },
      { name: 'medium negative', state: { divergence: -0.03, score: 0, dir: 0, loaded: true } },
      { name: 'zero', state: { divergence: 0, score: 0, dir: 0, loaded: true } },
    ];

    cases.forEach(({ name, state }) => {
      it(name, () => {
        const sA = clone(state);
        const sB = clone(state);
        const a = computeFRCrossScore(sA);
        const b = html_computeFRCrossScore(sB);
        expect(a).toEqual(b);
        expect(sA).toEqual(sB);
      });
    });
  });

  // ── computeFGVelocityScore ───────────────────────────────────────────
  describe('computeFGVelocityScore', () => {
    function st(current: number, velocity: number, histLen = 5): FGVelState {
      return {
        current,
        prev48h: current - velocity,
        velocity,
        score: 0,
        history: Array.from({ length: histLen }, (_, i) => ({ value: current - velocity * (histLen - 1 - i), t: 1000 + i })),
      };
    }

    const cases: Array<{ name: string; state: FGVelState }> = [
      { name: 'empty history', state: st(50, 0, 0) },
      { name: 'too short history (1 entry)', state: st(50, 5, 1) },
      { name: 'extreme greed accel', state: st(80, 20, 5) },
      { name: 'greed rising', state: st(70, 12, 5) },
      { name: 'sentiment improving', state: st(50, 10, 5) },
      { name: 'extreme fear accel', state: st(20, -20, 5) },
      { name: 'fear rising', state: st(30, -12, 5) },
      { name: 'sentiment degrading', state: st(50, -10, 5) },
      { name: 'extreme greed stable', state: st(85, 2, 5) },
      { name: 'extreme fear stable', state: st(15, -2, 5) },
      { name: 'mid-range', state: st(50, 0, 5) },
    ];

    cases.forEach(({ name, state }) => {
      it(name, () => {
        const sA = clone(state);
        const sB = clone(state);
        const a = computeFGVelocityScore(sA);
        const b = html_computeFGVelocityScore(sB);
        expect(Math.abs(a.score - b.score)).toBeLessThan(PARITY_TOL);
        expect(a.dir).toBe(b.dir);
        expect(a.velocity).toBe(b.velocity);
        expect(sA.score).toBe(sB.score);
      });
    });
  });
});
