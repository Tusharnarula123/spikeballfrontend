-- Run in Supabase → SQL Editor.
--
-- Lets a match be submitted as either a single game or a best-of-3 — players
-- enter the raw score(s) per game, and the winner/overall score is computed
-- automatically (highest score wins a single game; 2-out-of-3 game wins
-- decides a best-of-3). The raw per-game scores are kept in `games` so the
-- breakdown can still be shown later; score_team1/score_team2 continue to
-- hold the overall result (the single game's score, or the games-won tally
-- e.g. 2-1 for a best-of-3) so existing approval/ELO code is unaffected.

alter table matches
  add column if not exists games jsonb;

comment on column matches.games is
  'Raw per-game scores, e.g. [{"team1":21,"team2":15}] for a single game or three entries for a best-of-3. Null for matches submitted the old way (no per-game breakdown).';
