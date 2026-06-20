-- Run in Supabase → SQL Editor.
--
-- "Stoney Creek Beach Tournament" had its Round Robin schedule generated
-- before the rr_round column/migration existed, so those 10 pool matches
-- have rr_round = null and show up under "Unscheduled" instead of Round 1/2/3.
-- All of them are still 'pending' (no scores submitted), so it's safe to
-- delete them and click "Generate Schedule" again on the admin tournaments
-- page — the regenerated matches will carry proper round numbers.

-- 1) Sanity check — confirm these are the matches you expect to clear
--    (all should show status = 'pending').
select id, status, rr_pool, rr_round
from matches
where tournament_id = (select id from tournaments where name = 'Stoney Creek Beach Tournament')
  and rr_pool is not null;

-- 2) Delete them, then go re-click "Generate Schedule" in the admin UI.
delete from matches
where tournament_id = (select id from tournaments where name = 'Stoney Creek Beach Tournament')
  and rr_pool is not null
  and status = 'pending';
