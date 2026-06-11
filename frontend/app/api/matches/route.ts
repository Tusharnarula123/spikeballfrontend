import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, getActiveSeason, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/matches?playerId=&seasonId=&status=
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const playerId = searchParams.get('playerId');
  const seasonId = searchParams.get('seasonId');
  const status   = searchParams.get('status');

  let query = supabase
    .from('matches')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(50);

  if (seasonId) query = query.eq('season_id', seasonId);
  if (status)   query = query.eq('status', status);
  if (playerId) {
    query = query.or(
      `team1_player1_id.eq.${playerId},team1_player2_id.eq.${playerId},` +
      `team2_player1_id.eq.${playerId},team2_player2_id.eq.${playerId}`,
    );
  }

  const { data, error } = await query;
  if (error) return err(error.message);
  return NextResponse.json(data);
}

// POST /api/matches — submit a match
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player || player.status !== 'active') {
    return err('Only active players can submit matches', 403);
  }

  const body = await req.json();
  const { team1Player1Id, team1Player2Id, team2Player1Id, team2Player2Id,
          winningTeam, scoreTeam1, scoreTeam2, notes, tournamentId } = body;

  const playerIds = [team1Player1Id, team1Player2Id, team2Player1Id, team2Player2Id];
  if (!playerIds.includes(player.id)) {
    return err('You must be one of the players in the match', 403);
  }

  const season = await getActiveSeason();
  if (!season) return err('No active season');

  // Tournament match: validate it's live and all 4 players are registered
  if (tournamentId) {
    const { data: tournament } = await supabase
      .from('tournaments').select('id, status').eq('id', tournamentId).single();
    if (!tournament) return err('Tournament not found', 404);
    if (tournament.status !== 'in_progress') {
      return err('This tournament is not currently in progress');
    }

    const { data: regs } = await supabase
      .from('tournament_registrations')
      .select('player_id')
      .eq('tournament_id', tournamentId)
      .in('player_id', playerIds);

    if (!regs || regs.length < 4) {
      return err('All 4 players must be registered for this tournament');
    }
  }

  const { data, error } = await supabase
    .from('matches')
    .insert({
      season_id:        season.id,
      team1_player1_id: team1Player1Id,
      team1_player2_id: team1Player2Id,
      team2_player1_id: team2Player1Id,
      team2_player2_id: team2Player2Id,
      winning_team:     winningTeam,
      score_team1:      scoreTeam1,
      score_team2:      scoreTeam2,
      notes,
      submitted_by:     player.id,
      status:           'pending',
      tournament_id:    tournamentId ?? null,
    })
    .select()
    .single();

  if (error) return err(error.message);
  return NextResponse.json(data, { status: 201 });
}
