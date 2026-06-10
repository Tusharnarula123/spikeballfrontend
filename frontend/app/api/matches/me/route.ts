import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/matches/me?seasonId=  — match history for the current player
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player) return err('Player not found', 404);

  const seasonId = req.nextUrl.searchParams.get('seasonId');

  let query = supabase
    .from('matches')
    .select('*')
    .or(
      `team1_player1_id.eq.${player.id},team1_player2_id.eq.${player.id},` +
      `team2_player1_id.eq.${player.id},team2_player2_id.eq.${player.id}`,
    )
    .order('submitted_at', { ascending: false })
    .limit(100);

  if (seasonId) query = query.eq('season_id', seasonId);

  const { data: matches, error } = await query;
  if (error) return err(error.message);

  const rows = matches ?? [];
  if (rows.length === 0) return NextResponse.json([]);

  // Collect every player id involved across all matches
  const ids = new Set<string>();
  for (const m of rows) {
    ids.add(m.team1_player1_id);
    ids.add(m.team1_player2_id);
    ids.add(m.team2_player1_id);
    ids.add(m.team2_player2_id);
  }

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name')
    .in('id', Array.from(ids));

  const nameMap = new Map(
    (players ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`]),
  );

  // ELO change for this player on each match (if processed)
  const matchIds = rows.map(m => m.id);
  const { data: eloRows } = await supabase
    .from('elo_history')
    .select('match_id, elo_change')
    .eq('player_id', player.id)
    .in('match_id', matchIds);

  const eloMap = new Map((eloRows ?? []).map(e => [e.match_id, e.elo_change]));

  const result = rows.map(m => {
    const onTeam1 = m.team1_player1_id === player.id || m.team1_player2_id === player.id;
    const myTeam = onTeam1 ? 1 : 2;

    const partnerId = onTeam1
      ? (m.team1_player1_id === player.id ? m.team1_player2_id : m.team1_player1_id)
      : (m.team2_player1_id === player.id ? m.team2_player2_id : m.team2_player1_id);

    const opponentIds = onTeam1
      ? [m.team2_player1_id, m.team2_player2_id]
      : [m.team1_player1_id, m.team1_player2_id];

    const myScore       = onTeam1 ? m.score_team1 : m.score_team2;
    const opponentScore = onTeam1 ? m.score_team2 : m.score_team1;

    return {
      id: m.id,
      season_id: m.season_id,
      status: m.status,
      submitted_at: m.submitted_at,
      result: m.status === 'approved' ? (m.winning_team === myTeam ? 'win' : 'loss') : null,
      myScore,
      opponentScore,
      eloChange: eloMap.get(m.id) ?? null,
      partner:   { id: partnerId, name: nameMap.get(partnerId) ?? 'Unknown' },
      opponents: opponentIds.map(id => ({ id, name: nameMap.get(id) ?? 'Unknown' })),
    };
  });

  return NextResponse.json(result);
}
