/**
 * State interfaces for the flow-analysis modules (batch 2.2).
 *
 * In the HTML, these live as module-level mutable variables
 * (cvdSpeedHist, frVelData, fgVelData, etc). The worker passes them
 * explicitly as arguments — keeps each function pure (mutates state in place
 * to match the HTML semantics exactly, then returns the result).
 */

/**
 * State for CVD acceleration scoring.
 * Source: candleIndex2.html lines ~10878-10888.
 */
export interface CVDAccelState {
  /** Current CVD speed (signed). */
  cvdSpeed: number;
  /** Rolling history of abs(cvdSpeed). */
  cvdSpeedHist: number[];
  cvdBigBuys: number;
  cvdBigSells: number;
}

/**
 * State for CVD direction probability (per active TF).
 * Source: candleIndex2.html lines ~11555-11567.
 */
export interface CVDDirState {
  /** CVD of the candle currently forming. */
  curCVD: number;
  /** Closed-candle CVDs for the active TF (m5/m15/h1). */
  closedCVDs: number[];
}

/**
 * Funding-rate data (latest snapshot from feeds).
 */
export interface FundData {
  /** Latest funding rate, in percent (e.g. 0.01 = 0.01%). */
  fundingRate: number;
  /** Open-interest change, in percent. */
  oiChange: number;
}

/**
 * State for funding-rate velocity (rolling history).
 * Source: candleIndex2.html lines ~10913-10934.
 */
export interface FRVelState {
  history: Array<{ fr: number; t: number }>;
  lastFR: number;
  velocity: number;
  score: number;
}

/**
 * State for OI divergence.
 */
export interface OIDivState {
  divergence: number;
  score: number;
}

/**
 * State for perp/spot premium.
 * Source: candleIndex2.html lines ~10975-11001.
 */
export interface PerpSpotState {
  premium: number;
  premHistory: number[];
  score: number;
  dir: -1 | 0 | 1;
  loaded: boolean;
}

/**
 * State for funding-rate cross-exchange divergence.
 * Source: candleIndex2.html lines ~11013-11028.
 */
export interface FRCrossState {
  divergence: number;
  score: number;
  dir: -1 | 0 | 1;
  loaded: boolean;
}

/**
 * State for fear-and-greed velocity.
 * Source: candleIndex2.html lines ~11039-11060.
 */
export interface FGVelState {
  current: number;
  prev48h: number;
  velocity: number;
  score: number;
  history: Array<{ value: number; t: number }>;
}

/**
 * Volume-profile result (POC + Value Area).
 * Source: candleIndex2.html lines ~10857-10874.
 */
export interface VolumeProfileResult {
  poc: number;
  vah: number;
  val: number;
  loaded: boolean;
}

/**
 * A single Fair Value Gap.
 */
export interface FVG {
  top: number;
  bot: number;
  mid: number;
  size: number;
  filled: boolean;
}

/**
 * FVG detection result.
 * Source: candleIndex2.html lines ~10828-10854.
 */
export interface FVGResult {
  bullish: FVG[];
  bearish: FVG[];
  score: number;
  dir: -1 | 0 | 1;
  nearBull: FVG | null;
  nearBear: FVG | null;
}

/**
 * Swing point detected on a candle series.
 */
export interface SwingPoint {
  i: number;
  price: number;
}

/**
 * Result of detectSwings.
 */
export interface SwingsResult {
  sh: SwingPoint[];
  sl: SwingPoint[];
}

/**
 * Result of detectMarketStructure.
 * Source: candleIndex2.html lines ~14003-14033.
 */
export interface MarketStructureResult {
  dir: -1 | 0 | 1;
  msb: -1 | 0 | 1;
  choch: boolean;
  label: string;
  swingH: SwingPoint | null;
  swingL: SwingPoint | null;
}

/**
 * Volume absorption result.
 * Source: candleIndex2.html lines ~11072-11104.
 */
export interface VolumeAbsorptionResult {
  score: number;
  dir: -1 | 0 | 1;
  signal: string;
}
