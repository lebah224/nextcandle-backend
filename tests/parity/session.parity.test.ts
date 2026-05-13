/**
 * Unit tests for `getSession`. Uses injected Date to be timezone-deterministic.
 * Logic mirrors candleIndex2.html line 10811.
 */

import { describe, it, expect } from 'vitest';
import { getSession } from '../../src/engine/time/session.js';

/* eslint-disable */
// @ts-nocheck
const html_getSession = (now) => { const t = now.getUTCHours() + now.getUTCMinutes() / 60, tok = (t >= 0 && t < 9), lon = t >= 7 && t < 16, ny = t >= 13 && t < 22, ov = t >= 13 && t < 16; let sc = 0, nm = 'Hors session'; if (ov) { sc = 2; nm = 'Overlap'; } else if (lon || ny) { sc = 1; nm = lon && !ny ? 'London' : 'New York'; } else if (tok) { sc = 0; nm = 'Tokyo'; } return { tok, lon, ny, ov, sc, nm, t }; };
/* eslint-enable */

const HOURS = [0, 3, 7, 8, 9, 11, 13, 14, 15, 16, 17, 20, 22, 23];

describe('PARITY — getSession matches HTML reference', () => {
  HOURS.forEach((h) => {
    [0, 15, 30, 45].forEach((m) => {
      it(`UTC ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} matches HTML`, () => {
        const d = new Date(Date.UTC(2026, 4, 12, h, m));
        expect(getSession(d)).toEqual(html_getSession(d));
      });
    });
  });

  it('current call (default Date) returns valid session', () => {
    const s = getSession();
    expect(typeof s.t).toBe('number');
    expect(['Hors session', 'Tokyo', 'London', 'New York', 'Overlap']).toContain(s.nm);
    expect([0, 1, 2]).toContain(s.sc);
  });
});
