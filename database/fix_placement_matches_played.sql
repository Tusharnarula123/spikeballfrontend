-- Fix placement_matches_played on the players table.
--
-- Root cause: the approve() flow was writing placement_matches_played to
-- player_semester_stats but NOT back to the players row, which is what
-- the profile page reads. This script syncs them.
--
-- Placement threshold = 5 matches (first 5 use K_PLACEMENT=60, after that K_STANDARD=24).
--
-- Run in Supabase → SQL Editor. Safe to re-run (idempotent).

-- Step 1 — preview what will be corrected
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.placement_matches_played        AS players_table_value,
  pss.placement_matches_played      AS semester_stats_value,
  s.name                            AS active_semester
FROM players p
JOIN player_semester_stats pss ON pss.player_id = p.id
JOIN semesters s ON s.id = pss.semester_id AND s.is_active = true
WHERE p.placement_matches_played IS DISTINCT FROM pss.placement_matches_played
ORDER BY p.last_name, p.first_name;

-- Step 2 — apply the fix (sync players table from active semester stats)
UPDATE players p
SET placement_matches_played = pss.placement_matches_played
FROM player_semester_stats pss
JOIN semesters s ON s.id = pss.semester_id AND s.is_active = true
WHERE pss.player_id = p.id
  AND p.placement_matches_played IS DISTINCT FROM pss.placement_matches_played;
