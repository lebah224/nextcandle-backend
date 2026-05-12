# NextCandle Worker

Background worker for the **NextCandle** BTC/USDT analysis tool.
Migrates the existing single-file HTML (~18k lines) to a 24/7 server architecture
without losing any logic.

## Stack

- **Render Background Worker** (Node 20 + TypeScript strict, $25/mo)
- **Supabase Postgres + Realtime** ($25/mo)
- **Vercel Next.js** frontend (free)
- **Upstash Redis** for hot state cache (~$0-5/mo)

Total : ~$50–55/month.

## Status

🟢 **Phase 1 complete** — full audit of the HTML reference (see `/audit/*.md`)
🟡 **Phase 2 in progress** — repo scaffolded, first indicators ported with parity tests

### What works today

- TypeScript strict mode, ESLint, Prettier, Vitest
- 7 moving averages ported : `ema`, `sma`, `wma`, `hma`, `dema`, `tema`, `alma`
- 3 momentum indicators : `rsi`, `stochRsi`, `stochKD`
- **38 parity tests** passing — output is **byte-for-byte identical** to the HTML reference (max diff < 1e-9)
- Initial Supabase schema for the 3 critical tables : `live_state`, `predictions`, `ml_state`, `ml_history`
- Render deployment config

### Still to do (Phase 2 continuation)

In rough order:

1. Remaining indicators (~40 functions, lines 10560–10606 of HTML reference)
2. Structure detection (`detectSwings`, `detectMarketStructure`, `analyzeCandleStructure`, `detectFVG`)
3. Flow indicators (`cvdDirectionProb`, `computeCVDAccelScore`, `computePredictiveScore`, `computePerpSpotScore`, `computeFRCrossScore`, `computeFGVelocityScore`, `computeVolumeAbsorption`)
4. MTF + consensus (`calcMTF`, `computeExchangeScore`, `computeWeightedConsensus`, `computeHTFBiasFromSources`, `rebalanceWeights`)
5. Wyckoff + Maturity (`computeWyckoffPhase`, `computeTrendMaturity`)
6. Regime detection (`detectMarketRegime` + cross-exchange consensus)
7. Oracle aggregator (the formula at line 15129 — the core)
8. ML adaptive layer (`_mlCapture`, `_mlRecord`, `_mlRecalibrate`, `_mlValidateSignal`)
9. Trading plan (`calcTradeSetup`, `_selectBestSetup`)
10. Feeds : Binance WS + 4 exchanges REST
11. Orchestrator (tick loop + scheduler)
12. State persistence (Supabase + Redis snapshots)
13. Observability (Sentry + prom-client)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure env
cp .env.example .env
# Edit .env with your Supabase + Upstash credentials

# 3. Run database migrations (manual via Supabase SQL editor)
# Paste the content of src/db/migrations/001_initial.sql

# 4. Run tests
npm test                    # all tests (unit + parity)
npm run test:parity         # parity tests only
npm run test:coverage       # with coverage report

# 5. Local dev
npm run dev                 # tsx watch mode

# 6. Build
npm run build               # → dist/
npm start                   # run compiled output

# 7. Lint + typecheck
npm run lint
npm run typecheck
```

## Architecture

See `/audit/MIGRATION_MAP_v2.md` for the complete mapping of:
- 289 functions from the HTML reference → modules in this worker
- 67 global state variables → typed `WorkerState` interface
- 44 timers → unified scheduler
- 47 localStorage usages → Supabase tables
- 9 external REST hosts → typed feed clients

```
src/
├── engine/          ── PURE LOGIC (zero DOM, zero I/O)
│   ├── indicators/  ── ema, rsi, macd, etc.
│   ├── structure/   ── swings, market structure, FVG, volume profile
│   ├── flow/        ── CVD, pressure, predictive, perp/spot
│   ├── regime/      ── market regime, volatility, circuit breaker
│   ├── consensus/   ── exchange scores, weighted consensus, HTF bias
│   ├── oracle/      ── components + aggregator + smoothing
│   ├── ml/          ── adaptive layer (calibration online)
│   └── plan/        ── trading setups, levels, TPs, SL
├── feeds/           ── Binance/Bybit/Coinbase/Kraken/etc. clients
├── state/           ── typed singleton store + persistence
├── orchestrator/    ── tick loop + scheduler + handlers
├── db/              ── Supabase client + schemas
├── observability/   ── logger + metrics + Sentry
└── server.ts        ── /health + /metrics endpoints
```

## Parity guarantee

Every function ported from the HTML reference is validated against the
**verbatim HTML JavaScript** with a tolerance of `1e-9` (numerical identity
modulo floating point rounding). The reference code is embedded inline in
`tests/parity/*.parity.test.ts` so any drift from the HTML triggers a CI failure.

**No function is considered "ported" until its parity test passes.**

## Critical files (HTML reference)

- `candleIndex2.html` line 12856 : `_runAnalysis()` — the main orchestrator (~2150 lines)
- line 15129 : the `rawScoreRaw` formula — the heart of the Oracle
- line 7280 : ML adaptive layer entry point
- line 11533 : `SCORE_MODEL_VERSION` — bumped on every formula change

## Decisions

See `/audit/DECISIONS.md` for the 20 architectural decisions taken.
Headlines :

- Multi-TF parallel computation (worker computes M5+M15+H1 every tick)
- Single worker instance (no horizontal scaling)
- ML state in Postgres + hot cache in Redis
- Notifications via Supabase Realtime (no custom WebSocket)
- Score formula identical to HTML in V1, recalibration in V2
- Fresh start (no migration of localStorage history from Railway)

## License

Private — all rights reserved © Sadou Bah 2026.
