/**
 * Trading session detection (Tokyo / London / NY / Overlap).
 * Source: candleIndex2.html line 10811.
 *
 * Uses UTC clock. The session multiplier (`sessionMult` in the Oracle) is
 * derived from this in the aggregator (batch 2.4) — this file only returns
 * the metadata for the current UTC time.
 */

export interface Session {
  tok: boolean;
  lon: boolean;
  ny: boolean;
  ov: boolean;
  sc: 0 | 1 | 2;
  nm: string;
  /** Current UTC time as fractional hours, e.g. 14.5 = 14:30 UTC */
  t: number;
}

/**
 * Returns the current trading session metadata.
 *
 * The function accepts an optional `now` argument for deterministic tests.
 * In production code, call it without arguments.
 */
export function getSession(now: Date = new Date()): Session {
  const t = now.getUTCHours() + now.getUTCMinutes() / 60;
  const tok = t >= 0 && t < 9;
  const lon = t >= 7 && t < 16;
  const ny = t >= 13 && t < 22;
  const ov = t >= 13 && t < 16;

  let sc: 0 | 1 | 2 = 0;
  let nm = 'Hors session';
  if (ov) {
    sc = 2;
    nm = 'Overlap';
  } else if (lon || ny) {
    sc = 1;
    nm = lon && !ny ? 'London' : 'New York';
  } else if (tok) {
    sc = 0;
    nm = 'Tokyo';
  }

  return { tok, lon, ny, ov, sc, nm, t };
}
