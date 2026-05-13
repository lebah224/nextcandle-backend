-- ════════════════════════════════════════════════════════════════════════
--  NextCandle Worker — Initial Schema (Migration 001)
--  Purpose: bootstrap the 3 critical tables needed for the worker to start
--  Date: 2026-05
-- ════════════════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ════════════════════════════════════════════════════════════════════════
--  1. live_state — single row, hot oracle state for all 3 TFs
-- ════════════════════════════════════════════════════════════════════════
create table if not exists live_state (
    id              smallint primary key default 1,
    -- Last tick timing
    updated_at      timestamptz not null default now(),
    btc_price       numeric not null,
    -- Oracle results per TF (JSONB to keep schema flexible during V1)
    oracle_m5       jsonb,
    oracle_m15      jsonb,
    oracle_h1       jsonb,
    -- CVD live (per TF)
    cvd_m5          numeric not null default 0,
    cvd_m15         numeric not null default 0,
    cvd_h1          numeric not null default 0,
    -- Smoothed probabilities (per TF) — persisted between ticks
    smoothed_m5     numeric not null default 50,
    smoothed_m15    numeric not null default 50,
    smoothed_h1     numeric not null default 50,
    dir_consist_m5  smallint not null default 0,
    dir_consist_m15 smallint not null default 0,
    dir_consist_h1  smallint not null default 0,
    -- Worker metadata
    worker_version  text not null default 'v0.1.0',
    model_version   text not null default 'v4.7',
    -- Constraint: only one row ever
    constraint live_state_singleton check (id = 1)
);

comment on table live_state is 'Hot state — single row updated ~1Hz by the worker. Read by frontend via Realtime.';

-- ════════════════════════════════════════════════════════════════════════
--  2. predictions — append-only timeseries, one row per Oracle close per TF
-- ════════════════════════════════════════════════════════════════════════
create table if not exists predictions (
    id              bigserial primary key,
    ts              timestamptz not null,
    tf              text not null check (tf in ('m5', 'm15', 'h1')),
    -- Output
    score           numeric not null,                -- 0-100 (probHausse final)
    direction       smallint not null check (direction in (-1, 0, 1)),
    btc_price       numeric not null,
    regime          text not null,
    -- Components (15)
    components      jsonb not null,                  -- {tech, mtf, fund, ...}
    -- Multipliers
    multipliers     jsonb not null,                  -- {rm, mm, volFactor, ...}
    -- Raw stages
    raw_score       numeric not null,
    raw_score_adj   numeric not null,
    raw_prob        numeric not null,
    alpha_used      numeric not null,
    -- ML validation
    ml_filters_ok   smallint,
    ml_high_conf    boolean,
    ml_tf_coherent  boolean,
    -- Versioning
    model_version   text not null,
    -- Outcome (filled by outcomes_cron after N candles)
    outcome_dir     smallint,                        -- direction réelle après close
    outcome_ok      smallint,                        -- 1 si outcome_dir == direction
    outcome_resolved_at timestamptz,
    -- Audit
    created_at      timestamptz not null default now()
);

create index if not exists idx_predictions_tf_ts on predictions (tf, ts desc);
create index if not exists idx_predictions_unresolved on predictions (tf, ts) where outcome_resolved_at is null;
create index if not exists idx_predictions_model_version on predictions (model_version, ts desc);

comment on table predictions is 'Append-only timeseries of Oracle predictions. Outcomes resolved by cron 5min later.';

-- ════════════════════════════════════════════════════════════════════════
--  3. ml_state — one row per TF, current calibration
-- ════════════════════════════════════════════════════════════════════════
create table if not exists ml_state (
    tf                  text primary key check (tf in ('m5', 'm15', 'h1')),
    is_active           boolean not null default true,
    weight_mult         jsonb not null,                  -- 13 components
    comp_stats          jsonb not null default '{}'::jsonb,
    regime_acc          jsonb not null default '{"bull":{"c":0,"t":0},"bear":{"c":0,"t":0},"range":{"c":0,"t":0},"breakout":{"c":0,"t":0}}'::jsonb,
    current_regime      text not null default 'range',
    signal_consecutive  integer not null default 0,
    last_signal_dir     smallint not null default 0,
    pending_pred        jsonb,
    ready               boolean not null default false,
    updated_at          timestamptz not null default now()
);

comment on table ml_state is 'ML adaptive layer state — one row per TF. Replaces localStorage nc_ml_v3_*.';

-- ════════════════════════════════════════════════════════════════════════
--  4. ml_history — append-only history of resolved ML predictions
-- ════════════════════════════════════════════════════════════════════════
create table if not exists ml_history (
    id          bigserial primary key,
    tf          text not null check (tf in ('m5', 'm15', 'h1')),
    ts          timestamptz not null,
    dir_pred    smallint not null check (dir_pred in (-1, 0, 1)),
    prob        numeric not null,
    regime      text not null,
    dir_actual  smallint not null check (dir_actual in (-1, 1)),
    ok          smallint not null check (ok in (0, 1)),
    components  jsonb not null,
    created_at  timestamptz not null default now()
);

create index if not exists idx_ml_history_tf_ts on ml_history (tf, ts desc);

comment on table ml_history is 'Resolved ML predictions for the rolling window (used for recalibration).';

-- ════════════════════════════════════════════════════════════════════════
--  Initial seed for ml_state — 3 rows with default multipliers
-- ════════════════════════════════════════════════════════════════════════
insert into ml_state (tf, weight_mult)
values
    ('m5',  '{"tech":1,"mtf":1,"fund":1,"press":1,"cvd":1,"struct":1,"htf":1,"liq":1,"candle":1,"ob":1,"cvdaccel":1,"fvg":1,"va":1}'::jsonb),
    ('m15', '{"tech":1,"mtf":1,"fund":1,"press":1,"cvd":1,"struct":1,"htf":1,"liq":1,"candle":1,"ob":1,"cvdaccel":1,"fvg":1,"va":1}'::jsonb),
    ('h1',  '{"tech":1,"mtf":1,"fund":1,"press":1,"cvd":1,"struct":1,"htf":1,"liq":1,"candle":1,"ob":1,"cvdaccel":1,"fvg":1,"va":1}'::jsonb)
on conflict (tf) do nothing;

-- ════════════════════════════════════════════════════════════════════════
--  Initial seed for live_state
-- ════════════════════════════════════════════════════════════════════════
insert into live_state (id, btc_price)
values (1, 0)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════
--  Realtime subscriptions (Supabase enables them via the supabase_realtime publication)
-- ════════════════════════════════════════════════════════════════════════
-- Run these manually in the Supabase SQL editor after migration:
--   alter publication supabase_realtime add table live_state;
--   alter publication supabase_realtime add table predictions;
--   alter publication supabase_realtime add table notifications; -- when created
