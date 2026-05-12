/**
 * Core domain types — shared across the engine.
 * Keep in sync with the HTML reference (candleIndex2.html).
 */

export type TF = 'm5' | 'm15' | 'h1';
export type HTF = 'h4' | 'd';
export type AnyTF = TF | HTF;

export type Direction = -1 | 0 | 1;

export type Regime = 'bull' | 'bear' | 'range' | 'breakout';
export type MarketRegimeLabel = 'normal' | 'trend' | 'range' | 'breakout';

export type AlphaMode = 'standard' | 'reactif' | 'impulsion';

export type Exchange = 'bnb' | 'byb' | 'cb' | 'kr';

/**
 * OHLCV candle — matches the shape used throughout the HTML reference.
 * Fields use the same casing as the reference (open/high/low/close/vol).
 */
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  /** Open timestamp in ms (optional, populated from feeds) */
  ts?: number;
}

/** Composante directionnelle dans [-1, 1] */
export type ComponentScore = number;

export const ML_COMPONENT_NAMES = [
  'tech',
  'mtf',
  'fund',
  'press',
  'cvd',
  'struct',
  'htf',
  'liq',
  'candle',
  'ob',
  'cvdaccel',
  'fvg',
  'va',
] as const;

export type MLComponentName = (typeof ML_COMPONENT_NAMES)[number];

export type ComponentMultipliers = Record<MLComponentName, number>;

export const TF_LIST: readonly TF[] = ['m5', 'm15', 'h1'] as const;
