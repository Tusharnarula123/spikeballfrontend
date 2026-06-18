-- Round Robin Migration
-- Run against Supabase SQL editor

-- 1. Add tournament_type to tournaments ('bracket' is the default for all existing tournaments)
alter table tournaments
  add column if not exists tournament_type text not null default 'bracket'
  check (tournament_type in ('bracket', 'round_robin'));

-- 2. Add rr_pool to matches
--    null  → not a round-robin pool match (could be bracket or finals)
--    0     → Pool A
--    1     → Pool B
alter table matches
  add column if not exists rr_pool smallint;

-- 3. Index for fast pool-match lookups per tournament
create index if not exists idx_matches_rr_pool
  on matches (tournament_id, rr_pool)
  where rr_pool is not null;
