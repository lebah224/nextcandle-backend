/**
 * Candle structure & patterns — direct ports from candleIndex2.html.
 *
 * Includes simple pattern detection (`fractals`, `detectPattern`) and the
 * advanced `analyzeCandleStructure` (HTML lines 10625-10810).
 */

import type { Candle, Direction } from '../../state/types.js';

/**
 * Fractals — detects whether candle[n-2] is a fractal high/low.
 * Source: candleIndex2.html line 10601.
 *
 * Returns `sig`: -1 if up fractal (resistance), +1 if down fractal (support), 0 otherwise.
 */
export function fractals(cd: readonly Candle[]): { sig: Direction; txt: string } {
  const n = cd.length - 1;
  let ufrac = '';
  let dfrac = '';
  if (n >= 2) {
    const c2 = cd[n - 2]!;
    const c1 = cd[n - 1]!;
    const c0 = cd[n]!;
    if (c2.high > c1.high && c2.high > c0.high) ufrac = '↑ Fractal H';
    if (c2.low < c1.low && c2.low < c0.low) dfrac = '↓ Fractal L';
  }
  const txt = ufrac && dfrac ? ufrac + ' ' + dfrac : ufrac || dfrac || '—';
  const sig: Direction = ufrac ? -1 : dfrac ? 1 : 0;
  return { sig, txt };
}

/**
 * detectPattern — single-candle / two-candle pattern detector.
 * Source: candleIndex2.html line 10606.
 *
 * Returns `n` (name), `d` (direction), `s` (strength 0/1/2).
 */
export function detectPattern(cd: readonly Candle[]): {
  n: string;
  d: Direction;
  s: 0 | 1 | 2;
} {
  if (cd.length < 3) return { n: '—', d: 0, s: 0 };
  const [, b, c] = cd.slice(-3) as [Candle, Candle, Candle];
  const bd = (o: number, cl: number): number => Math.abs(cl - o);
  const cb = bd(c.open, c.close);
  const cr = c.high - c.low;

  if (cr < 0.0001) return { n: 'Doji', d: 0, s: 0 };

  if (
    b.close < b.open &&
    c.close > c.open &&
    c.open <= b.close &&
    c.close >= b.open
  )
    return { n: 'Engulfing ▲', d: 1, s: 2 };

  if (
    b.close > b.open &&
    c.close < c.open &&
    c.open >= b.close &&
    c.close <= b.open
  )
    return { n: 'Engulfing ▼', d: -1, s: 2 };

  if (cb / cr < 0.1) return { n: 'Doji', d: 0, s: 0 };

  const lw = Math.min(c.open, c.close) - c.low;
  const uw = c.high - Math.max(c.open, c.close);

  if (lw > 2.5 * cb && uw < 0.4 * cb) return { n: 'Marteau', d: 1, s: 1 };
  if (uw > 2.5 * cb && lw < 0.4 * cb && c.close < c.open)
    return { n: 'Shoot.star', d: -1, s: 1 };
  if (c.close > c.open && cb / cr > 0.65) return { n: 'Bougie ▲', d: 1, s: 1 };
  if (c.close < c.open && cb / cr > 0.65) return { n: 'Bougie ▼', d: -1, s: 1 };

  return { n: 'Indécis', d: 0, s: 0 };
}

/**
 * analyzeCandleStructure — advanced 3-priority pattern analysis.
 * Source: candleIndex2.html lines 10625-10810.
 *
 * Composite score [-1, +1] from:
 *   1. Pin Bar (wick dominance + body position)
 *   2. Engulfing + Volume confirmation
 *   3. Inside Bar Breakout (compression → release)
 *
 * Plus a buyer/seller dominance metric on the current candle.
 */
export function analyzeCandleStructure(cd: readonly Candle[]): {
  score: number;
  confidence: number;
  patterns: Array<{ n: string; d: Direction; strength: number; detail: string }>;
  dominance: number;
  mainPattern: string;
  mainDetail?: string;
  dir: Direction;
} {
  const EMPTY = {
    score: 0,
    confidence: 0,
    patterns: [],
    dominance: 0.5,
    mainPattern: '—',
    dir: 0 as Direction,
  };
  if (!cd || cd.length < 5) return EMPTY;

  const safe = (v: number, fb = 0): number =>
    typeof v === 'number' && isFinite(v) ? v : fb;

  const cur = cd[cd.length - 1]!;
  const c1 = cd[cd.length - 2]!;
  const c2 = cd[cd.length - 3]!;
  const c3 = cd[cd.length - 4]!;

  // Average volume of the previous 20 candles (excluding current)
  const avgVol =
    cd
      .slice(-21, -1)
      .reduce((a, b) => a + (b.vol || 0), 0) /
      Math.min(20, cd.length - 1) || 1;

  const detected: Array<{ n: string; d: Direction; strength: number; detail: string }> = [];

  // ── PRIORITY 1 : PIN BAR ─────────────────────────────────────────────
  (() => {
    const candles: Candle[] = [cur, c1];
    for (const c of candles) {
      if (!c) continue;
      const range = c.high - c.low;
      if (range < 0.001) continue;
      const body = Math.abs(c.close - c.open);
      const bodyRatio = body / range;
      if (bodyRatio > 0.32) continue;

      const upperWick = c.high - Math.max(c.open, c.close);
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const upperR = upperWick / range;
      const lowerR = lowerWick / range;

      const bodyLow = Math.min(c.open, c.close);
      const bodyHigh = Math.max(c.open, c.close);

      // Bull Pin Bar
      if (lowerR >= 0.6 && upperR < 0.25 && bodyLow >= c.low + range * 0.62) {
        let strength = Math.min(1, 0.55 + lowerR * 0.45);
        const prevBear = cd.slice(-6, -1).filter((x) => x.close < x.open).length;
        if (prevBear >= 3) strength = Math.min(1, strength * 1.2);
        detected.push({
          n: 'Pin Bar ▲',
          d: 1,
          strength,
          detail: `Mèche ${Math.round(lowerR * 100)}% · corps haut`,
        });
        break;
      }
      // Bear Pin Bar
      if (upperR >= 0.6 && lowerR < 0.25 && bodyHigh <= c.low + range * 0.38) {
        let strength = Math.min(1, 0.55 + upperR * 0.45);
        const prevBull = cd.slice(-6, -1).filter((x) => x.close > x.open).length;
        if (prevBull >= 3) strength = Math.min(1, strength * 1.2);
        detected.push({
          n: 'Pin Bar ▼',
          d: -1,
          strength,
          detail: `Mèche ${Math.round(upperR * 100)}% · corps bas`,
        });
        break;
      }
    }
  })();

  // ── PRIORITY 2 : ENGULFING + VOLUME ──────────────────────────────────
  (() => {
    if (!c1 || !c2) return;
    const c1Body = Math.abs(c1.close - c1.open);
    const c2Body = Math.abs(c2.close - c2.open);
    if (c1Body < 0.001 || c2Body < 0.001) return;

    const c1High = Math.max(c1.open, c1.close);
    const c1Low = Math.min(c1.open, c1.close);
    const c2High = Math.max(c2.open, c2.close);
    const c2Low = Math.min(c2.open, c2.close);

    if (c2.close < c2.open && c1.close > c1.open && c1Low <= c2Low && c1High >= c2High) {
      const sizeRatio = c1Body / c2Body;
      const volRatio = (c1.vol || avgVol) / avgVol;
      const hasVol = volRatio >= 1.2;
      const volBonus =
        volRatio >= 1.8 ? 0.2 : volRatio >= 1.4 ? 0.12 : volRatio >= 1.2 ? 0.06 : 0;
      const strength = Math.min(1, 0.55 + Math.min(0.25, sizeRatio * 0.12) + volBonus);
      detected.push({
        n: `Engulfing ▲${hasVol ? ' + Vol' : ''}`,
        d: 1,
        strength,
        detail: `Corps ${sizeRatio.toFixed(1)}× · Vol ${volRatio.toFixed(1)}×`,
      });
    } else if (
      c2.close > c2.open &&
      c1.close < c1.open &&
      c1Low <= c2Low &&
      c1High >= c2High
    ) {
      const sizeRatio = c1Body / c2Body;
      const volRatio = (c1.vol || avgVol) / avgVol;
      const hasVol = volRatio >= 1.2;
      const volBonus =
        volRatio >= 1.8 ? 0.2 : volRatio >= 1.4 ? 0.12 : volRatio >= 1.2 ? 0.06 : 0;
      const strength = Math.min(1, 0.55 + Math.min(0.25, sizeRatio * 0.12) + volBonus);
      detected.push({
        n: `Engulfing ▼${hasVol ? ' + Vol' : ''}`,
        d: -1,
        strength,
        detail: `Corps ${sizeRatio.toFixed(1)}× · Vol ${volRatio.toFixed(1)}×`,
      });
    }
  })();

  // ── PRIORITY 3 : INSIDE BAR BREAKOUT ─────────────────────────────────
  (() => {
    if (!c1 || !c2 || !c3) return;
    if (c2.high >= c3.high || c2.low <= c3.low) return;

    const breakRange = c1.high - c1.low;
    if (breakRange < 0.001) return;
    const breakBody = Math.abs(c1.close - c1.open);
    const bodyRatio = breakBody / breakRange;
    if (bodyRatio < 0.45) return;

    const motherRange = c3.high - c3.low || 1;

    if (c1.close > c3.high && c1.close > c1.open) {
      const overshoot = (c1.close - c3.high) / motherRange;
      const strength = Math.min(
        1,
        0.6 + Math.min(0.3, overshoot * 3) + Math.min(0.1, bodyRatio - 0.45),
      );
      detected.push({
        n: 'Inside Bar ▲',
        d: 1,
        strength,
        detail: `Break +${(overshoot * 100).toFixed(1)}% · corps ${Math.round(bodyRatio * 100)}%`,
      });
    } else if (c1.close < c3.low && c1.close < c1.open) {
      const overshoot = (c3.low - c1.close) / motherRange;
      const strength = Math.min(
        1,
        0.6 + Math.min(0.3, overshoot * 3) + Math.min(0.1, bodyRatio - 0.45),
      );
      detected.push({
        n: 'Inside Bar ▼',
        d: -1,
        strength,
        detail: `Break -${(overshoot * 100).toFixed(1)}% · corps ${Math.round(bodyRatio * 100)}%`,
      });
    }
  })();

  // ── DOMINANCE ────────────────────────────────────────────────────────
  const range = cur.high - cur.low || 1;
  const lowerWick = Math.min(cur.open, cur.close) - cur.low;
  const upperWick = cur.high - Math.max(cur.open, cur.close);
  const dominance = safe(0.5 + (lowerWick - upperWick) / (range * 2));

  // ── SCORE COMPOSITE ──────────────────────────────────────────────────
  if (!detected.length) {
    const domScore = (dominance - 0.5) * 0.4;
    return {
      score: safe(domScore),
      confidence: 0,
      patterns: [],
      dominance: safe(dominance, 0.5),
      mainPattern: '—',
      dir: 0,
    };
  }

  let bullW = 0;
  let bearW = 0;
  detected.forEach((p) => {
    if (p.d > 0) bullW += p.strength;
    else if (p.d < 0) bearW += p.strength;
  });
  const total = bullW + bearW || 1;
  const rawScore = (bullW - bearW) / total;

  const allBull = detected.every((p) => p.d > 0);
  const allBear = detected.every((p) => p.d < 0);
  const avgStr = detected.reduce((a, p) => a + p.strength, 0) / detected.length;
  const confidence = Math.round(
    Math.min(
      100,
      avgStr * 65 +
        (allBull || allBear ? 20 : 0) +
        (detected.length > 1 ? 10 : 0) +
        Math.abs(dominance - 0.5) * 10,
    ),
  );

  const mainP = detected.slice().sort((a, b) => b.strength - a.strength)[0]!;
  const dir: Direction = rawScore > 0.12 ? 1 : rawScore < -0.12 ? -1 : 0;

  return {
    score: Math.max(-1, Math.min(1, safe(rawScore))),
    confidence,
    patterns: detected,
    dominance: safe(dominance, 0.5),
    mainPattern: mainP.n,
    mainDetail: mainP.detail || '',
    dir,
  };
}
