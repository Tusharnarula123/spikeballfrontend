-- =============================================================================
-- OU Roundnet Club — Supabase PostgreSQL Schema
-- =============================================================================
-- Run this in Supabase → SQL Editor (run top-to-bottom, once)
-- Auth is handled by Clerk; clerk_user_id links Clerk users to our players table.
-- =============================================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- =============================================================================
-- PLAYERS
-- One row per club member. Status starts as 'pending' until an admin approves.
-- clerk_user_id comes from Clerk's user.id (format: "user_xxxxxxxxxxxx")
-- =============================================================================
create table if not exists players (
  id               uuid primary key default uuid_generate_v4(),
  clerk_user_id    text unique not null,          -- Clerk auth ID
  first_name       text not null,
  last_name        text not null,
  email            text unique not null,
  age              smallint check (age >= 16 and age <= 99),
  gender           text check (gender in ('male','female','non_binary','prefer_not_to_say')),

  -- Account state
  status           text not null default 'pending'
                   check (status in ('pending','active','suspended')),

  -- Cached current ELO across all seasons (for fast leaderboard queries)
  -- Updated by a trigger whenever player_season_stats changes.
  current_elo      int not null default 1200,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_players_clerk_user_id on players (clerk_user_id);
create index if not exists idx_players_status        on players (status);
create index if not exists idx_players_current_elo   on players (current_elo desc);


-- =============================================================================
-- SEASONS
-- Semester-based (e.g. "Fall 2024", "Spring 2025").
-- Only one season should have is_active = true at a time.
-- =============================================================================
create table if not exists seasons (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null unique,        -- "Fall 2024"
  start_date          date not null,
  end_date            date not null,
  is_active           boolean not null default false,
  starting_elo        int  not null default 1200,  -- ELO all players start with
  created_at          timestamptz not null default now(),

  constraint seasons_dates_check check (end_date > start_date)
);

-- Only one active season allowed
create unique index if not exists idx_seasons_one_active
  on seasons (is_active)
  where is_active = true;


-- =============================================================================
-- PLAYER SEASON STATS
-- Per-player, per-season stats and ELO.
-- A row is created for each player at the start of every season.
-- =============================================================================
create table if not exists player_season_stats (
  player_id               uuid not null references players (id) on delete cascade,
  season_id               uuid not null references seasons (id) on delete cascade,

  elo                     int  not null default 1200,
  peak_elo                int  not null default 1200,

  wins                    int  not null default 0,
  losses                  int  not null default 0,

  -- Tracks how many of the first 10 matches (placement) have been played.
  -- K-factor = 60 while placement_matches_played < 10, then drops to 24.
  placement_matches_played smallint not null default 0
                           check (placement_matches_played >= 0 and placement_matches_played <= 10),

  -- Cached rank within the season (recomputed after each approved match)
  rank                    int,

  primary key (player_id, season_id)
);

create index if not exists idx_pss_season_elo on player_season_stats (season_id, elo desc);


-- =============================================================================
-- MATCHES
-- Every ranked 2v2 game. Teams are stored directly on the match row for
-- simplicity. ELO changes are in elo_history.
-- Status flow: pending → approved (or disputed / cancelled)
-- =============================================================================
create table if not exists matches (
  id               uuid primary key default uuid_generate_v4(),
  season_id        uuid not null references seasons (id),

  -- Team 1
  team1_player1_id uuid not null references players (id),
  team1_player2_id uuid not null references players (id),

  -- Team 2
  team2_player1_id uuid not null references players (id),
  team2_player2_id uuid not null references players (id),

  -- Result
  winning_team     smallint check (winning_team in (1, 2)),
  score_team1      smallint check (score_team1 >= 0),   -- optional, e.g. 21
  score_team2      smallint check (score_team2 >= 0),

  -- Workflow
  status           text not null default 'pending'
                   check (status in ('pending','approved','disputed','cancelled')),

  submitted_by     uuid not null references players (id),
  submitted_at     timestamptz not null default now(),

  approved_by      uuid references players (id),       -- null until approved
  approved_at      timestamptz,

  notes            text,                                -- admin/dispute notes

  -- A player cannot be on both teams
  constraint no_duplicate_players check (
    team1_player1_id <> team1_player2_id and
    team1_player1_id <> team2_player1_id and
    team1_player1_id <> team2_player2_id and
    team1_player2_id <> team2_player1_id and
    team1_player2_id <> team2_player2_id and
    team2_player1_id <> team2_player2_id
  )
);

create index if not exists idx_matches_season_status  on matches (season_id, status);
create index if not exists idx_matches_submitted_at   on matches (submitted_at desc);
create index if not exists idx_matches_team1_p1       on matches (team1_player1_id);
create index if not exists idx_matches_team1_p2       on matches (team1_player2_id);
create index if not exists idx_matches_team2_p1       on matches (team2_player1_id);
create index if not exists idx_matches_team2_p2       on matches (team2_player2_id);


-- =============================================================================
-- ELO HISTORY
-- One row per player per approved match.
-- 4 rows are inserted for every approved match (one per participant).
-- Used for the ELO graph on profile pages.
-- =============================================================================
create table if not exists elo_history (
  id           uuid primary key default uuid_generate_v4(),
  player_id    uuid not null references players (id) on delete cascade,
  match_id     uuid not null references matches (id) on delete cascade,
  season_id    uuid not null references seasons (id),

  elo_before   int not null,
  elo_change   int not null,           -- positive = won, negative = lost
  elo_after    int not null,

  recorded_at  timestamptz not null default now()
);

create index if not exists idx_elo_history_player     on elo_history (player_id, recorded_at desc);
create index if not exists idx_elo_history_match      on elo_history (match_id);
create index if not exists idx_elo_history_season     on elo_history (player_id, season_id, recorded_at);


-- =============================================================================
-- BADGES
-- Badge definitions. Trigger types:
--   elo_threshold   → awarded when player ELO passes trigger_value
--   win_streak      → awarded when player wins trigger_value matches in a row
--   match_count     → awarded after trigger_value total approved matches
--   placement_done  → awarded when all 10 placement matches are complete
--   manual          → admin awards manually, trigger_value unused
-- =============================================================================
create table if not exists badges (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null unique,
  description    text not null,
  icon_name      text not null,        -- maps to a Lucide icon or custom SVG name
  trigger_type   text not null
                 check (trigger_type in (
                   'elo_threshold','win_streak','match_count',
                   'placement_done','manual'
                 )),
  trigger_value  int,                  -- null for 'manual' and 'placement_done'
  created_at     timestamptz not null default now()
);

-- Seed with starter badges
insert into badges (name, description, icon_name, trigger_type, trigger_value) values
  ('Placement Complete', 'Finished all 10 placement matches',       'check-circle',  'placement_done',  null),
  ('Rookie',            'Played your first ranked match',           'star',          'match_count',     1),
  ('Veteran',           'Played 50 ranked matches',                 'shield',        'match_count',     50),
  ('Century',           'Played 100 ranked matches',                'award',         'match_count',     100),
  ('On Fire',           'Won 5 matches in a row',                   'flame',         'win_streak',      5),
  ('Unstoppable',       'Won 10 matches in a row',                  'zap',           'win_streak',      10),
  ('Silver',            'Reached 1300 ELO',                         'medal',         'elo_threshold',   1300),
  ('Gold',              'Reached 1500 ELO',                         'trophy',        'elo_threshold',   1500),
  ('Elite',             'Reached 1800 ELO',                         'crown',         'elo_threshold',   1800)
on conflict (name) do nothing;


-- =============================================================================
-- PLAYER BADGES
-- Records which players have earned which badges and when.
-- match_id is null for manually awarded badges.
-- =============================================================================
create table if not exists player_badges (
  id           uuid primary key default uuid_generate_v4(),
  player_id    uuid not null references players (id) on delete cascade,
  badge_id     uuid not null references badges (id)  on delete cascade,
  awarded_at   timestamptz not null default now(),
  awarded_by   uuid references players (id),   -- null = system, set = admin
  match_id     uuid references matches (id),   -- the match that triggered it

  unique (player_id, badge_id)                 -- a player earns each badge once
);

create index if not exists idx_player_badges_player on player_badges (player_id);


-- =============================================================================
-- TRIGGERS
-- updated_at auto-refresh on players
-- =============================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_players_updated_at on players;
create trigger trg_players_updated_at
  before update on players
  for each row execute function set_updated_at();


-- =============================================================================
-- VIEWS
-- =============================================================================

-- Active season leaderboard (fast read for homepage)
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
  pss.placement_matches_played
from player_season_stats pss
join players p        on p.id = pss.player_id
join seasons s        on s.id = pss.season_id
where s.is_active = true
  and p.status    = 'active'
order by pss.elo desc;

-- Head-to-head record between two players across all seasons
create or replace view head_to_head as
select
  p1.id   as player_a_id,
  p2.id   as player_b_id,
  count(*) filter (where
    (m.team1_player1_id = p1.id or m.team1_player2_id = p1.id) and m.winning_team = 1 or
    (m.team2_player1_id = p1.id or m.team2_player2_id = p1.id) and m.winning_team = 2
  )        as player_a_wins,
  count(*) filter (where
    (m.team1_player1_id = p2.id or m.team1_player2_id = p2.id) and m.winning_team = 1 or
    (m.team2_player1_id = p2.id or m.team2_player2_id = p2.id) and m.winning_team = 2
  )        as player_b_wins,
  count(*) as total_shared_matches
from matches m
cross join players p1
cross join players p2
where m.status = 'approved'
  and p1.id < p2.id   -- one row per pair, no duplicates
  and (
    m.team1_player1_id in (p1.id, p2.id) or
    m.team1_player2_id in (p1.id, p2.id) or
    m.team2_player1_id in (p1.id, p2.id) or
    m.team2_player2_id in (p1.id, p2.id)
  )
group by p1.id, p2.id;
