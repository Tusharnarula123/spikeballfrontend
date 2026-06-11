-- =============================================================================
-- OU Roundnet Club — Tournaments Schema (additive migration)
-- =============================================================================
-- Run this in Supabase → SQL Editor AFTER schema.sql has already been applied.
-- Adds tournament creation/registration/teams + links matches to tournaments.
-- Also adds `university` and `bio` columns to `players` (referenced by the
-- profile page already, but never added to the schema).
-- =============================================================================

-- ─── Players: profile fields used on Profile + Register pages ────────────────
alter table players add column if not exists university text;
alter table players add column if not exists bio         text;


-- =============================================================================
-- TOURNAMENTS
-- Created by an admin. Drives announcements, registration, and live matches.
--   is_casual    — purely informational label shown to players
--   affects_elo  — when false, approved matches in this tournament skip
--                   elo_history / player_season_stats / players.current_elo
--   team_formation:
--     'random'      — admin randomly pairs registrants into teams
--     'self_select' — players pick a preferred partner; mutual picks are
--                      paired automatically, leftovers paired randomly
--   status flow: upcoming -> registration_open -> in_progress -> completed
--                (or -> cancelled at any point)
-- =============================================================================
create table if not exists tournaments (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  description     text,

  is_casual       boolean not null default false,
  affects_elo     boolean not null default true,
  team_formation  text not null default 'random'
                  check (team_formation in ('random','self_select')),

  season_id       uuid references seasons (id),

  start_date      date not null,
  end_date        date,

  status          text not null default 'upcoming'
                  check (status in ('upcoming','registration_open','in_progress','completed','cancelled')),

  created_by      uuid references players (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint tournaments_dates_check check (end_date is null or end_date >= start_date)
);

create index if not exists idx_tournaments_status     on tournaments (status);
create index if not exists idx_tournaments_start_date on tournaments (start_date desc);

drop trigger if exists trg_tournaments_updated_at on tournaments;
create trigger trg_tournaments_updated_at
  before update on tournaments
  for each row execute function set_updated_at();


-- =============================================================================
-- TOURNAMENT TEAMS
-- A 2-player team formed for a specific tournament (via "Form Teams" action).
-- =============================================================================
create table if not exists tournament_teams (
  id             uuid primary key default uuid_generate_v4(),
  tournament_id  uuid not null references tournaments (id) on delete cascade,
  player1_id     uuid not null references players (id),
  player2_id     uuid not null references players (id),
  created_at     timestamptz not null default now(),

  constraint tournament_teams_distinct_players check (player1_id <> player2_id)
);

create index if not exists idx_tournament_teams_tournament on tournament_teams (tournament_id);


-- =============================================================================
-- TOURNAMENT REGISTRATIONS
-- One row per player registered for a tournament.
--   preferred_partner_id — used for 'self_select' team formation; the player
--                           requesting this partner
--   team_id              — set once "Form Teams" has run
-- =============================================================================
create table if not exists tournament_registrations (
  id                    uuid primary key default uuid_generate_v4(),
  tournament_id         uuid not null references tournaments (id) on delete cascade,
  player_id             uuid not null references players (id) on delete cascade,
  preferred_partner_id  uuid references players (id),
  team_id               uuid references tournament_teams (id) on delete set null,
  registered_at         timestamptz not null default now(),

  unique (tournament_id, player_id)
);

create index if not exists idx_tournament_registrations_tournament on tournament_registrations (tournament_id);
create index if not exists idx_tournament_registrations_player     on tournament_registrations (player_id);


-- =============================================================================
-- MATCHES: link to tournament (nullable — regular season matches stay null)
-- =============================================================================
alter table matches add column if not exists tournament_id uuid references tournaments (id);

create index if not exists idx_matches_tournament_id on matches (tournament_id);
