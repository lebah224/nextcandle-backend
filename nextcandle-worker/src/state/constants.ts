/**
 * Time constants (milliseconds).
 * Match candleIndex2.html line 11526.
 */
export const M5_MS = 5 * 60 * 1000;
export const M15_MS = 15 * 60 * 1000;
export const H1_MS = 60 * 60 * 1000;
export const H4_MS = 4 * 60 * 60 * 1000;
export const D_MS = 24 * 60 * 60 * 1000;

/**
 * Score model version — incremented when the formula or weights change.
 * Logged with each prediction in the database for audit / A/B testing.
 * Source: candleIndex2.html line 11533.
 */
export const SCORE_MODEL_VERSION = 'v4.7';

/**
 * Exchange base weights for the multi-exchange consensus.
 * Source: candleIndex2.html line 11406.
 */
export const EXCH_BASE_WEIGHTS = {
  bnb: 0.4,
  byb: 0.25,
  cb: 0.2,
  kr: 0.15,
} as const;

/**
 * ML system constants.
 * Source: candleIndex2.html line 7282.
 */
export const ML_WARMUP = 50;
export const ML_ROLLING = 50;
export const ML_RELIABLE = 200;
export const ML_MIN_ACC = 0.48;
export const ML_MAX_HIST = 500;

/**
 * Setup TTLs by timeframe (ms).
 * Source: candleIndex2.html line 8205.
 */
export const SETUP_TTL = {
  m5: 60 * 60 * 1000, // 1 h
  m15: 3 * 60 * 60 * 1000, // 3 h
  h1: 12 * 60 * 60 * 1000, // 12 h
} as const;
