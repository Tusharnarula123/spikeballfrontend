-- =============================================================================
-- OU Roundnet Club — Bracket Migration
-- =============================================================================
-- Run in Supabase → SQL Editor AFTER tournaments_schema.sql has been applied.
-- Adds bracket_round and bracket_slot to matches so tournament matches can be
-- organised into a visual single-elimination bracket.
--
--   bracket_round   1 = Round of 64 … up to the final round number
--                   Convention used by the frontend:
--                     1  = first round (R64 / R32 / R16 depending on field size)
--                     …
--                     N-1 = Semi-finals
--                     N   = Final
--                     N+1 = 3rd-place match (optional)
--
--   bracket_slot    0-based position within the round (top → bottom in bracket)
-- =============================================================================

alter table matches add column if not exists bracket_round smallint;
alter table matches add column if not exists bracket_slot  smallint;

create index if not exists idx_matches_bracket
  on matches (tournament_id, bracket_round, bracket_slot)
  where tournament_id is not null;
