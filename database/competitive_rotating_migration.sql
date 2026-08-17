-- =============================================================================
-- Competitive (Rotating Teams) Migration
-- Run in Supabase → SQL Editor.
--
-- Adds the 'rotating' tournament type: a competitive session where players
-- register individually and get a new teammate and new opponents every round,
-- matched on ELO.
--
-- Team formation: everyone pairs up; when the player count is odd, exactly one
-- team takes a third player (13 players -> five 2s and one 3). A team with no
-- opponent that round sits out, and byes rotate.
--
-- Rounds/nets reuse the existing round-robin columns on matches:
--   rr_round = round number (1, 2, 3, ...)
--   rr_pool  = net number within that round (0-indexed)
-- =============================================================================

-- ─── 1. Allow the new tournament type ────────────────────────────────────────
alter table tournaments drop constraint if exists tournaments_tournament_type_check;
alter table tournaments
  add constraint tournaments_tournament_type_check
  check (tournament_type in ('bracket', 'round_robin', 'rotating'));


-- ─── 2. Third player slot per side ───────────────────────────────────────────
-- Only used by the odd-player-out team in a rotating session; null everywhere
-- else, so existing 2v2 matches are unaffected.
alter table matches add column if not exists team1_player3_id uuid references players (id);
alter table matches add column if not exists team2_player3_id uuid references players (id);


-- ─── 3. No player may appear twice in a match ────────────────────────────────
-- Replaces the original 4-column check with one covering all six slots.
-- Nulls are ignored, so 2v2 and 3v2 both pass.
alter table matches drop constraint if exists no_duplicate_players;
alter table matches drop constraint if exists matches_distinct_players_check;

create or replace function match_players_distinct(m matches) returns boolean as $$
  select count(*) = count(distinct id)
  from unnest(array[
    m.team1_player1_id, m.team1_player2_id, m.team1_player3_id,
    m.team2_player1_id, m.team2_player2_id, m.team2_player3_id
  ]) as id
  where id is not null;
$$ language sql immutable;

alter table matches
  add constraint matches_distinct_players_check
  check (match_players_distinct(matches));


-- ─── 4. Verify ───────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.columns
    where table_name = 'matches' and column_name = 'team1_player3_id')  as has_t1_p3,
  (select count(*) from information_schema.columns
    where table_name = 'matches' and column_name = 'team2_player3_id')  as has_t2_p3,
  (select count(*) from information_schema.columns
    where table_name = 'matches' and column_name = 'rr_round')          as has_rr_round,
  (select count(*) from information_schema.columns
    where table_name = 'matches' and column_name = 'rr_pool')           as has_rr_pool;
-- All four should be 1.
