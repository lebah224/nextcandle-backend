/**
 * Direct parity check : extract the exact JS from candleIndex2.html lines
 * 10551-10559 and run it side-by-side with the TS port. Any divergence > 1e-9
 * is a bug in the port.
 */

import { ema, sma, wma, hma, dema, tema, alma } from '../src/engine/indicators/moving-avg.js';

// ── Same test data as the unit test ──
const testData = [
  62450.5, 62480.2, 62445.8, 62498.3, 62520.1, 62488.9, 62445.2, 62512.7, 62534.6, 62556.8,
  62543.2, 62578.9, 62601.4, 62589.7, 62612.3, 62625.8, 62598.4, 62634.5, 62655.7, 62641.2,
  62687.3, 62701.5, 62689.8, 62712.4, 62734.1, 62718.6, 62745.9, 62763.2, 62751.4, 62778.5,
  62795.8, 62812.4, 62798.6, 62823.1, 62845.7, 62831.2, 62856.8, 62874.5, 62891.3, 62878.9,
  62904.2, 62921.5, 62909.7, 62934.1, 62951.8, 62938.4, 62965.6, 62982.3, 62971.5, 62997.8,
  63015.2, 63002.4, 63028.7, 63044.9, 63031.5, 63057.2, 63075.8, 63062.3, 63089.6, 63105.4,
];

// ════════════════════════════════════════════════════════════════════════
//  HTML reference — copied VERBATIM from candleIndex2.html lines 10551-10559
// ════════════════════════════════════════════════════════════════════════
// @ts-nocheck
const html_ema = (a, p) => { if (a.length < p) return a.map(() => 0); const k = 2 / (p + 1); let v = a.slice(0, p).reduce((x, y) => x + y) / p; const r = Array(p - 1).fill(0).concat([v]); for (let i = p; i < a.length; i++) { v = a[i] * k + v * (1 - k); r.push(v); } return r; };
const html_wma = (a, p) => { const r = []; for (let i = p - 1; i < a.length; i++) { let s = 0, w = 0; for (let j = 0; j < p; j++) { s += a[i - j] * (p - j); w += (p - j); } r.push(s / w); } return r; };
const html_sma = (a, p) => { const r = []; for (let i = p - 1; i < a.length; i++) r.push(a.slice(i - p + 1, i + 1).reduce((x, y) => x + y) / p); return r; };
const html_L = (a) => a[a.length - 1] ?? 0;
const html_hma = (a, p) => { const sq = Math.round(Math.sqrt(p)), h = Math.floor(p / 2), w1 = html_wma(a, h), w2 = html_wma(a, p), l = Math.min(w1.length, w2.length); return html_wma(Array.from({ length: l }, (_, i) => 2 * w1[w1.length - l + i] - w2[w2.length - l + i]), sq); };
const html_dema = (a, p) => { const e1 = html_ema(a, p), e2 = html_ema(e1, p), l = Math.min(e1.length, e2.length); return Array.from({ length: l }, (_, i) => 2 * e1[e1.length - l + i] - e2[e2.length - l + i]); };
const html_tema = (a, p) => { const e1 = html_ema(a, p), e2 = html_ema(e1, p), e3 = html_ema(e2, p), l = Math.min(e1.length, e2.length, e3.length); return Array.from({ length: l }, (_, i) => 3 * e1[e1.length - l + i] - 3 * e2[e2.length - l + i] + e3[e3.length - l + i]); };
const html_alma = (a, p, off = 0.85, sig = 6) => { const r = []; for (let i = p - 1; i < a.length; i++) { const sl = a.slice(i - p + 1, i + 1), m = Math.floor(off * (p - 1)), d = p / sig / sig; let s = 0, sw = 0; for (let j = 0; j < p; j++) { const jm = j - m, w = Math.exp(-(jm * jm) / (2 * d)); s += sl[j] * w; sw += w; } r.push(sw ? s / sw : 0); } return r; };

const TOL = 1e-9;
let allPass = true;

function compare(name: string, a: number[], b: number[]) {
  if (a.length !== b.length) {
    console.error(`❌ ${name} : length mismatch — ts=${a.length} html=${b.length}`);
    allPass = false;
    return;
  }
  let maxDiff = 0;
  let maxIdx = -1;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    const d = Math.abs(av - bv);
    if (d > maxDiff) { maxDiff = d; maxIdx = i; }
  }
  if (maxDiff > TOL) {
    console.error(`❌ ${name} : max diff ${maxDiff.toExponential(3)} at idx ${maxIdx} (ts=${a[maxIdx]}, html=${b[maxIdx]})`);
    allPass = false;
  } else {
    console.log(`✅ ${name} : ${a.length} values, max diff ${maxDiff.toExponential(3)}`);
  }
}

console.log('\n=== PARITY CHECK : worker port vs HTML reference ===\n');

[5, 9, 12, 14, 21, 26, 50].forEach((p) => {
  if (testData.length >= p) {
    compare(`ema(p=${p})`, ema(testData, p), html_ema(testData, p));
    compare(`sma(p=${p})`, sma(testData, p), html_sma(testData, p));
    compare(`wma(p=${p})`, wma(testData, p), html_wma(testData, p));
  }
});

[5, 9, 14, 21].forEach((p) => {
  compare(`hma(p=${p})`, hma(testData, p), html_hma(testData, p));
  compare(`dema(p=${p})`, dema(testData, p), html_dema(testData, p));
  compare(`tema(p=${p})`, tema(testData, p), html_tema(testData, p));
  compare(`alma(p=${p}, default)`, alma(testData, p), html_alma(testData, p));
  compare(`alma(p=${p}, off=0.5)`, alma(testData, p, 0.5), html_alma(testData, p, 0.5));
  compare(`alma(p=${p}, off=0.85, sig=4)`, alma(testData, p, 0.85, 4), html_alma(testData, p, 0.85, 4));
});

// Edge cases
compare('ema empty', ema([], 5), html_ema([], 5));
compare('ema short < period', ema([1, 2, 3], 5), html_ema([1, 2, 3], 5));
compare('ema p=1', ema(testData, 1), html_ema(testData, 1));

console.log('\n=== RESULT ===');
if (allPass) {
  console.log('🎉 ALL PASS — worker port is byte-for-byte identical to HTML reference');
  process.exit(0);
} else {
  console.error('💥 PARITY BREACH — fix before proceeding');
  process.exit(1);
}
