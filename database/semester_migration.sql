-- =============================================================================
-- OU Roundnet Club — Semester Migration
-- =============================================================================
-- Run in Supabase → SQL Editor AFTER schema.sql and tournaments_schema.sql.
--
-- Season model (new):
--   season  = academic year, e.g. "2025-2026"  (May 1 → Apr 30)
--   semester = one of three 4-month blocks per season:
--               Summer  May  1 – Aug 31
--               Fall    Sep  1 – Dec 31
--               Spring  Jan  1 – Apr 30  (of the NEXT calendar year)
--
-- ELO resets at the start of every semester.
-- Aggregate season stats (peak ELO, total W/L) are tracked separately.
-- =============================================================================


-- ─── 1. Upgrade `seasons` to year-level containers ───────────────────────────
-- Keep existing columns; add year markers. Remove is_active (now on semesters).

alter table seasons add column if not exists year_start smallint;   -- e.g. 2025
alter table seasons add column if not exists year_end   smallint;   -- e.g. 2026

-- Back-fill year markers from start_date for any existing rows
update seasons
   set year_start = extract(year from start_date)::smallint,
       year_end   = extract(year from end_date)::smallint
 where year_start is null;

-- is_active on seasons is no longer the source of truth (semesters drive that),
-- but we keep the column to avoid breaking existing queries while we migrate.


-- ─── 2. SEMESTERS ─────────────────────────────────────────────────────────────
create table if not exists semesters (
  id              uuid primary key default uuid_generate_v4(),
  season_id       uuid not null references seasons (id) on delete cascade,

  name            text not null,                      -- "Summer 2025"
  semester_type   text not null
                  check (semester_type in ('summer', 'fall', 'spring')),

  start_date      date not null,
  end_date        date not null,

  is_active       boolean not null default false,
  starting_elo    int  not null default 1200,

  created_at      timestamptz not null default now(),

  constraint semesters_dates_check check (end_date > start_date),
  unique (season_id, semester_type)
);

create index if not exists idx_semesters_season    on semesters (season_id);
create index if not exists idx_semesters_is_active on semesters (is_active) where is_active = true;

-- Only one active semester allowed at any time
create unique index if not exists idx_semesters_one_active
  on semesters (is_active)
  where is_active = true;


-- ─── 3. PLAYER SEMESTER STATS ─────────────────────────────────────────────────
-- Per-player, per-SEMESTER stats. ELO resets to starting_elo each semester.
-- (Replaces player_season_stats as the live ELO source.)

create table if not exists player_semester_stats (
  player_id                uuid not null references players (id) on delete cascade,
  semester_id              uuid not null references semesters (id) on delete cascade,
  season_id                uuid not null references seasons  (id) on delete cascade,

  elo                      int  not null default 1200,
  peak_elo                 int  not null default 1200,

  wins                     int  not null default 0,
  losses                   int  not null default 0,

  placement_matches_played smallint not null default 0
                           check (placement_matches_played >= 0
                              and placement_matches_played <= 10),

  rank                     int,

  primary key (player_id, semester_id)
);

create index if not exists idx_pss2_semester_elo on player_semester_stats (semester_id, elo desc);
create index if not exists idx_pss2_season       on player_semester_stats (season_id);


-- ─── 4. PLAYER SEASON STATS (repurposed as aggregate) ─────────────────────────
-- Season-level rollup: best ELO reached in any semester this season,
-- plus cumulative wins / losses across all semesters.

alter table player_season_stats add column if not exists peak_season_elo int not null default 1200;
alter table player_season_stats add column if not exists total_wins      int not null default 0;
alter table player_season_stats add column if not exists total_losses    int not null default 0;

-- Rename confusingly-named legacy columns (safe; no data yet in prod):
-- elo → current_semester_elo_snapshot (kept for backward compat — not used actively)
-- We just leave the old columns in place and use the new ones going forward.


-- ─── 5. Add semester_id to MATCHES ────────────────────────────────────────────
alter table matches add column if not exists semester_id uuid references semesters (id);

create index if not exists idx_matches_semester_id on matches (semester_id)
  where semester_id is not null;


-- ─── 6. Add semester_id to ELO_HISTORY ────────────────────────────────────────
alter table elo_history add column if not exists semester_id uuid references semesters (id);

create index if not exists idx_elo_history_semester
  on elo_history (player_id, semester_id, recorded_at);


-- ─── 7. Update leaderboard view ───────────────────────────────────────────────
-- Now reflects the active SEMESTER (ELO resets per semester).

drop view if exists leaderboard_active;

create or replace view leaderboard_active as
select
  p.id,
  p.first_name,
  p.last_name,
  p.gender,
  pss.elo,
  pss.peak_elo,
  pss.wins,
  pss.losses,
  pss.rank,
  pss.placement_matches_played,
  sem.id        as semester_id,
  sem.name      as semester_name,
  sem.season_id
from player_semester_stats pss
join players   p   on p.id   = pss.player_id
join semesters sem on sem.id = pss.semester_id
where sem.is_active = true
  and p.status      = 'active'
order by pss.elo desc;


-- ─── 8. RPC: upsert season aggregate after every approved match ───────────────
-- Called by the backend after each ELO update.
create or replace function upsert_player_season_aggregate(
  p_player_id uuid,
  p_season_id uuid,
  p_new_elo   int,
  p_won       boolean
) returns void language plpgsql as $$
begin
  insert into player_season_stats (player_id, season_id, peak_season_elo, total_wins, total_losses, elo, wins, losses)
  values (
    p_player_id, p_season_id,
    p_new_elo,
    case when p_won then 1 else 0 end,
    case when not p_won then 1 else 0 end,
    p_new_elo,
    case when p_won then 1 else 0 end,
    case when not p_won then 1 else 0 end
  )
  on conflict (player_id, season_id) do update
    set peak_season_elo = greatest(player_season_stats.peak_season_elo, p_new_elo),
        total_wins      = player_season_stats.total_wins  + case when p_won      then 1 else 0 end,
        total_losses    = player_season_stats.total_losses + case when not p_won then 1 else 0 end;
end;
$$;


-- ─── 9. Season aggregate view ─────────────────────────────────────────────────
create or replace view leaderboard_season as
select
  p.id,
  p.first_name,
  p.last_name,
  p.gender,
  psa.peak_season_elo,
  psa.total_wins,
  psa.total_losses,
  psa.season_id,
  s.name as season_name
from player_season_stats psa
join players p  on p.id  = psa.player_id
join seasons s  on s.id  = psa.season_id
where p.status = 'active'
order by psa.peak_season_elo desc;
