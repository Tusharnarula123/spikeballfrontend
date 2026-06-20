-- Adds a round number to round-robin pool matches so the schedule can be
-- displayed grouped under "Round 1", "Round 2", etc. instead of one flat list.
-- Run in Supabase → SQL Editor before generating any new round-robin schedules.
--
-- Existing pool matches (generated before this migration) will have
-- rr_round = null and will show up under an "Unscheduled" group until the
-- schedule is regenerated.

alter table matches
  add column if not exists rr_round smallint;

create index if not exists idx_matches_rr_round
  on matches (tournament_id, rr_pool, rr_round)
  where rr_round is not null;
