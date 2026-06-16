import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getActiveSeason, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

const PLAYER_FIELDS = 'id, first_name, last_name';

// ─── GET /api/tournaments/[id]/bracket ────────────────────────────────────────
// Returns bracket rounds and matches for the tournament bracket page.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tournamentId } = await params;

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, status, affects_elo')
    .eq('id', tournamentId)
    .single();

  if (!tournament) return err('Tournament not found', 404);

  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      id, bracket_round, bracket_slot, status, winning_team, score_team1, score_team2,
      team1_player1:players!matches_team1_player1_id_fkey(${PLAYER_FIELDS}),
      team1_player2:players!matches_team1_player2_id_fkey(${PLAYER_FIELDS}),
      team2_player1:players!matches_team2_player1_id_fkey(${PLAYER_FIELDS}),
      team2_player2:players!matches_team2_player2_id_fkey(${PLAYER_FIELDS})
    `)
    .eq('tournament_id', tournamentId)
    .not('bracket_round', 'is', null)
    .order('bracket_round', { ascending: true })
    .order('bracket_slot', { ascending: true });

  if (error) return err(error.message);

  // Group into rounds
  const roundMap = new Map<number, typeof matches>();
  for (const m of matches ?? []) {
    const r = m.bracket_round!;
    if (!roundMap.has(r)) roundMap.set(r, []);
    roundMap.get(r)!.push(m);
  }

  const rounds = Array.from(roundMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([round, roundMatches]) => ({ round, matches: roundMatches }));

  return NextResponse.json({ tournament, rounds });
}

// ─── POST /api/tournaments/[id]/bracket ───────────────────────────────────────
// Admin-only. Generates round 1 bracket matches from formed teams.
// Shuffles teams and pairs them sequentially.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id: tournamentId } = await params;

  // Validate tournament exists
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, status, season_id')
    .eq('id', tournamentId)
    .single();

  if (!tournament) return err('Tournament not found', 404);

  // Check no bracket matches already exist
  const { count } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .not('bracket_round', 'is', null);

  if ((count ?? 0) > 0) {
    return err('Bracket already generated. Delete existing bracket matches first.');
  }

  // Fetch formed teams
  const { data: teams, error: teamsError } = await supabase
    .from('tournament_teams')
    .select('id, player1_id, player2_id')
    .eq('tournament_id', tournamentId);

  if (teamsError) return err('Failed to load teams');
  if (!teams || teams.length < 2) return err('Need at least 2 teams to generate a bracket');

  // Resolve season_id — prefer tournament's season, fall back to active season
  let seasonId = tournament.season_id as string | null;
  if (!seasonId) {
    const season = await getActiveSeason();
    if (!season) return err('No season linked to this tournament and no active season found');
    seasonId = season.id;
  }

  // Shuffle teams (Fisher-Yates)
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Pair teams into round 1 matches
  const matchInserts = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) {
    const t1 = shuffled[i];
    const t2 = shuffled[i + 1];
    matchInserts.push({
      season_id:        seasonId,
      tournament_id:    tournamentId,
      team1_player1_id: t1.player1_id,
      team1_player2_id: t1.player2_id,
      team2_player1_id: t2.player1_id,
      team2_player2_id: t2.player2_id,
      status:           'pending',
      bracket_round:    1,
      bracket_slot:     i / 2,
    });
  }

  const unpaired = shuffled.length % 2 === 1 ? shuffled[shuffled.length - 1] : null;

  const { data: created, error: insertError } = await supabase
    .from('matches')
    .insert(matchInserts)
    .select('id');

  if (insertError) return err(insertError.message);

  // Advance tournament to in_progress if still in registration
  if (tournament.status === 'registration_open' || tournament.status === 'upcoming') {
    await supabase
      .from('tournaments')
      .update({ status: 'in_progress' })
      .eq('id', tournamentId);
  }

  return NextResponse.json({
    matchesCreated: created?.length ?? 0,
    unpaired: unpaired ? { player1_id: unpaired.player1_id, player2_id: unpaired.player2_id } : null,
  }, { status: 201 });
}
