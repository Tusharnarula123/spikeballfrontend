-- Run in Supabase → SQL Editor.
--
-- Deletes every player account with status = 'suspended'.
--
-- Safe automatically, via existing "on delete cascade":
--   player_season_stats, elo_history, player_badges,
--   player_semester_stats, tournament_registrations
--
-- NOT cascaded — these have no "on delete cascade" on their players FK,
-- so Postgres will reject the delete below with a foreign-key-violation
-- error if a suspended player still shows up in any of them:
--   matches (team1_player1_id, team1_player2_id, team2_player1_id,
--            team2_player2_id, submitted_by, approved_by)
--   tournament_teams (player1_id, player2_id)
--   tournaments (created_by)
--   tournament_registrations (preferred_partner_id)
--   player_badges (awarded_by)
--
-- Step 1 — see who's about to be deleted (sanity check before running step 3):
select id, first_name, last_name, email, status
from players
where status = 'suspended';

-- Step 2 — if step 3 fails with a foreign-key error, run this to see exactly
-- which table/row is still referencing a suspended player (swap in the
-- table name from the error message, e.g. matches, tournament_teams,
-- tournaments, player_badges):
-- select * from matches
-- where team1_player1_id in (select id from players where status = 'suspended')
--    or team1_player2_id in (select id from players where status = 'suspended')
--    or team2_player1_id in (select id from players where status = 'suspended')
--    or team2_player2_id in (select id from players where status = 'suspended')
--    or submitted_by     in (select id from players where status = 'suspended')
--    or approved_by      in (select id from players where status = 'suspended');

-- Step 3 — the actual delete. This is irreversible — make sure step 1's
-- result is exactly who you want gone before running this.
delete from players
where status = 'suspended';
