-- ── Tournament Bracket Migration ──────────────────────────────────────────────
-- Run this in Supabase SQL editor

-- 1. Add team name to tournament_teams
ALTER TABLE tournament_teams
  ADD COLUMN IF NOT EXISTS name TEXT;

-- 2. Backfill names for existing teams using player first names
UPDATE tournament_teams tt
SET name = (
  SELECT CONCAT(p1.first_name, ' & ', p2.first_name)
  FROM players p1, players p2
  WHERE p1.id = tt.player1_id AND p2.id = tt.player2_id
)
WHERE name IS NULL;

-- Done. No schema changes needed to matches — bracket_round and bracket_slot
-- columns already exist from a previous migration.
-- The generate-bracket endpoint creates pending matches for Round 1.
-- When matches are approved, the approve endpoint auto-creates the next-round match.
