/**
 * Trend indicators — direct ports from candleIndex2.html.
 *
 * Parity rule : do NOT change the arithmetic. Each function below mirrors
 * the HTML reference byte-for-byte. Validated by `tests/parity/trend.parity.test.ts`.
 */

import type { Candle } from '../../state/types.js';
import { ema, sma } from './moving-avg.js';
import { L } from './helpers.js';

/**
 * MACD — Moving Average Convergence Divergence.
 * Source: candleIndex2.html line 10563.
 *
 * Returns:
 *   - `last` : current histogram value (ml - sl)
 *   - `prev` : previous histogram value
 *   - `ml`   : current MACD line (ema12 - ema26)
 *   - `sl`   : current signal line (sma(macd, 9))
 *
 * Returns zeros if not enough data.
 */
export function macd(c: readonly number[]): {
  last: number;
  prev: number;
  ml: number;
  sl: number;
} {
  const e12 = ema(c, 12);
  const e26 = ema(c, 26);
  const ml = e12.map((v, i) => v - (e26[i] ?? 0)).slice(25);
  if (ml.length < 9) return { last: 0, prev: 0, ml: 0, sl: 0 };
  const sig = sma(ml, 9);
  const hist = ml.slice(ml.length - sig.length).map((v, i) => v - (sig[i] ?? 0));
  return {
    last: L(hist),
    prev: hist[hist.length - 2] ?? 0,
    ml: L(ml),
    sl: L(sig),
  };
}

/**
 * ADX — Average Directional Index, with +DI and -DI.
 * Source: candleIndex2.html line 10581.
 *
 * Returns defaults `{adx: 20, pdi: 25, mdi: 25}` if not enough data.
 */
export function adx(
  cd: readonly Candle[],
  p = 14,
): { adx: number; pdi: number; mdi: number } {
  if (cd.length < p * 3) return { adx: 20, pdi: 25, mdi: 25 };

  const tr: number[] = [];
  const pdm: number[] = [];
  const mdm: number[] = [];

  for (let i = 1; i < cd.length; i++) {
    const ci = cd[i]!;
    const cp = cd[i - 1]!;
    const h = ci.high;
    const l = ci.low;
    const ph = cp.high;
    const pl = cp.low;
    const pc = cp.close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    const up = h - ph;
    const dn = pl - l;
    pdm.push(up > dn && up > 0 ? up : 0);
    mdm.push(dn > up && dn > 0 ? dn : 0);
  }

  // Wilder smoothing : sum first p, then s = s - s/p + a[i]
  const ws = (a: readonly number[]): number[] => {
    let s = a.slice(0, p).reduce((x, y) => x + y);
    const r: number[] = [s];
    for (let i = p; i < a.length; i++) {
      s = s - s / p + a[i]!;
      r.push(s);
    }
    return r;
  };

  const str = ws(tr);
  const sp = ws(pdm);
  const sm = ws(mdm);

  const pdi = sp.map((v, i) => (str[i] ? (v / str[i]!) * 100 : 0));
  const mdi = sm.map((v, i) => (str[i] ? (v / str[i]!) * 100 : 0));

  const dx = pdi.map((v, i) => {
    const m = mdi[i] ?? 0;
    const s = v + m;
    return s ? (Math.abs(v - m) / s) * 100 : 0;
  });

  const ea = ema(dx, p);
  return { adx: L(ea) ?? 20, pdi: L(pdi) ?? 0, mdi: L(mdi) ?? 0 };
}

/**
 * PSAR — Parabolic Stop And Reverse.
 * Source: candleIndex2.html line 10582.
 *
 * Returns a signal direction (1 bull, -1 bear) and a display text.
 */
export function psar(cd: readonly Candle[]): { sig: -1 | 0 | 1; txt: string } {
  if (cd.length < 10) return { sig: 0, txt: '—' };

  let bull = true;
  let sar = cd[0]!.low;
  let ep = cd[0]!.high;
  let af = 0.02;
  const afMax = 0.2;

  for (let i = 1; i < cd.length; i++) {
    const ci = cd[i]!;
    sar = sar + af * (ep - sar);
    if (bull) {
      sar = Math.min(sar, cd[Math.max(0, i - 1)]!.low, cd[Math.max(0, i - 2)]!.low);
      if (ci.low < sar) {
        bull = false;
        sar = ep;
        ep = ci.low;
        af = 0.02;
      } else if (ci.high > ep) {
        ep = ci.high;
        af = Math.min(af + 0.02, afMax);
      }
    } else {
      sar = Math.max(sar, cd[Math.max(0, i - 1)]!.high, cd[Math.max(0, i - 2)]!.high);
      if (ci.high > sar) {
        bull = true;
        sar = ep;
        ep = ci.high;
        af = 0.02;
      } else if (ci.low < ep) {
        ep = ci.low;
        af = Math.min(af + 0.02, afMax);
      }
    }
  }

  return { sig: bull ? 1 : -1, txt: '$' + Math.round(sar).toLocaleString() };
}

/**
 * Supertrend.
 * Source: candleIndex2.html line 10583.
 *
 * Returns a signal (1 bull, -1 bear) and a display text.
 * Uses Wilder smoothed ATR(p) internally.
 */
export function supertrend(
  cd: readonly Candle[],
  p = 10,
  m = 3,
): { sig: -1 | 0 | 1; txt: string } {
  if (cd.length < p * 3) return { sig: 0, txt: '—' };

  const tr: number[] = [];
  for (let i = 1; i < cd.length; i++) {
    const ci = cd[i]!;
    const cp = cd[i - 1]!;
    const h = ci.high;
    const l = ci.low;
    const pc = cp.close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }

  let av = tr.slice(0, p).reduce((a, b) => a + b) / p;
  for (let i = p; i < tr.length; i++) {
    av = (av * (p - 1) + tr[i]!) / p;
  }

  let trend: -1 | 1 = 1;
  let st = 0;
  let prev: -1 | 1 = 1;
  for (let i = p; i < cd.length; i++) {
    const ci = cd[i]!;
    const hl2 = (ci.high + ci.low) / 2;
    const up = hl2 + m * av;
    const lo = hl2 - m * av;
    if (prev === 1) {
      st = lo;
      if (ci.close < st) {
        trend = -1;
        st = up;
      }
    } else {
      st = up;
      if (ci.close > st) {
        trend = 1;
        st = lo;
      }
    }
    prev = trend;
  }

  return { sig: trend, txt: '$' + Math.round(st).toLocaleString() };
}

/**
 * Ichimoku — simplified bias signal (does not return all 5 lines).
 * Source: candleIndex2.html line 10584.
 *
 * Returns:
 *   - `sig` : 1 (above cloud, bullish), -1 (below cloud, bearish), 0 (in cloud)
 *   - `txt` : Tenkan/Kijun display
 */
export function ichimoku(cd: readonly Candle[]): { sig: -1 | 0 | 1; txt: string } {
  if (cd.length < 52) return { sig: 0, txt: '—' };

  const dn = (arr: readonly Candle[], n: number): number => {
    const s = arr.slice(-n);
    return (Math.max(...s.map((c) => c.high)) + Math.min(...s.map((c) => c.low))) / 2;
  };

  const ten = dn(cd, 9);
  const kij = dn(cd, 26);
  const price = cd[cd.length - 1]!.close;
  const old = cd.slice(0, -26);

  if (old.length < 52) {
    return {
      sig: price > ten && ten > kij ? 1 : price < ten && ten < kij ? -1 : 0,
      txt: `T:${Math.round(ten)}`,
    };
  }

  const sA = (dn(old, 9) + dn(old, 26)) / 2;
  const sB = dn(old, 52);
  const top = Math.max(sA, sB);
  const bot = Math.min(sA, sB);
  let sig: -1 | 0 | 1 = 0;
  if (price > top && ten > kij) sig = 1;
  else if (price < bot && ten < kij) sig = -1;
  return { sig, txt: `T:${Math.round(ten)} K:${Math.round(kij)}` };
}

/**
 * Heikin Ashi — last candle direction.
 * Source: candleIndex2.html line 10585.
 *
 * Returns the signal (1 bull, -1 bear), a label, and the last computed HA candle.
 */
export function heikinAshi(cd: readonly Candle[]): {
  sig: -1 | 1;
  txt: string;
  last: { open: number; close: number; high: number; low: number };
} {
  const r: Array<{ open: number; close: number; high: number; low: number }> = [];
  cd.forEach((c, i) => {
    const pc = r[i - 1] ?? c;
    const haC = (c.open + c.high + c.low + c.close) / 4;
    const haO = (pc.open + pc.close) / 2;
    const haH = Math.max(c.high, haC, haO);
    const haL = Math.min(c.low, haC, haO);
    r.push({ open: haO, close: haC, high: haH, low: haL });
  });
  const last = r[r.length - 1]!;
  const sig: -1 | 1 = last.close > last.open ? 1 : -1;
  return { sig, txt: sig > 0 ? 'Bull' : 'Bear', last };
}

/**
 * Linear regression slope over the last `p` closes.
 * Source: candleIndex2.html line 10599.
 *
 * Returns the slope (price per bar) and a sign signal.
 */
export function linregSlope(
  c: readonly number[],
  p = 20,
): { val: number; sig: -1 | 0 | 1 } {
  if (c.length < p) return { val: 0, sig: 0 };
  const sl = c.slice(-p);
  const n = sl.length;
  const sx = (n * (n - 1)) / 2;
  const sx2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sy = sl.reduce((a, b) => a + b, 0);
  const sxy = sl.reduce((a, b, i) => a + i * b, 0);
  const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  return { val: slope, sig: slope > 0 ? 1 : slope < 0 ? -1 : 0 };
}

/**
 * Kaufman's Efficiency Ratio over the last `p` closes.
 * Source: candleIndex2.html line 10600.
 *
 * Returns the ratio in [0, 1] and a "trending" signal (1 if > 0.6, else 0).
 */
export function efficiencyRatio(
  c: readonly number[],
  p = 10,
): { val: number; sig: 0 | 1 } {
  if (c.length < p + 1) return { val: 0, sig: 0 };
  const dir = Math.abs(c[c.length - 1]! - c[c.length - 1 - p]!);
  const noise = c
    .slice(-p)
    .reduce((a, b, i, ar) => a + (i > 0 ? Math.abs(b - ar[i - 1]!) : 0), 0);
  const val = noise ? dir / noise : 0;
  return { val, sig: val > 0.6 ? 1 : 0 };
}
