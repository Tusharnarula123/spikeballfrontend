import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';
import { calculate2v2 } from '@/lib/elo';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id: matchId } = await params;

  const { data: match } = await supabase
    .from('matches').select('*').eq('id', matchId).single();
  if (!match) return err('Match not found', 404);
  if (match.status !== 'pending') return err('Match is not pending');

  const admin = await getPlayerByClerkId(auth.userId);

  const playerIds: string[] = [
    match.team1_player1_id, match.team1_player2_id,
    match.team2_player1_id, match.team2_player2_id,
  ];

  // Fetch or default season stats for all 4 players
  const { data: statsRows } = await supabase
    .from('player_season_stats')
    .select('player_id, elo, placement_matches_played, wins, losses')
    .eq('season_id', match.season_id)
    .in('player_id', playerIds);

  const statMap: Record<string, { elo: number; placement: number; wins: number; losses: number }> = {};
  for (const pid of playerIds) {
    const s = statsRows?.find(x => x.player_id === pid);
    statMap[pid] = { elo: s?.elo ?? 1200, placement: s?.placement_matches_played ?? 0, wins: s?.wins ?? 0, losses: s?.losses ?? 0 };
  }

  // Calculate ELO
  const { deltas, newElos } = calculate2v2(
    [statMap[match.team1_player1_id].elo, statMap[match.team1_player2_id].elo],
    [statMap[match.team2_player1_id].elo, statMap[match.team2_player2_id].elo],
    match.winning_team,
    [statMap[match.team1_player1_id].placement, statMap[match.team1_player2_id].placement,
     statMap[match.team2_player1_id].placement, statMap[match.team2_player2_id].placement],
  );

  // Write elo_history
  await supabase.from('elo_history').insert(
    playerIds.map((pid, i) => ({
      player_id: pid, match_id: matchId, season_id: match.season_id,
      elo_before: [statMap[match.team1_player1_id].elo, statMap[match.team1_player2_id].elo,
                   statMap[match.team2_player1_id].elo, statMap[match.team2_player2_id].elo][i],
      elo_change: deltas[i], elo_after: newElos[i],
    })),
  );

  // Upsert player_season_stats
  for (let i = 0; i < 4; i++) {
    const pid  = playerIds[i];
    const won  = (i < 2 && match.winning_team === 1) || (i >= 2 && match.winning_team === 2);
    await supabase.from('player_season_stats').upsert({
      player_id: pid, season_id: match.season_id,
      elo:       newElos[i],
      peak_elo:  Math.max(newElos[i], statMap[pid].elo),
      wins:      won ? statMap[pid].wins + 1 : statMap[pid].wins,
      losses:    !won ? statMap[pid].losses + 1 : statMap[pid].losses,
      placement_matches_played: Math.min(statMap[pid].placement + 1, 10),
    }, { onConflict: 'player_id,season_id' });
  }

  // Update cached current_elo
  for (let i = 0; i < 4; i++) {
    await supabase.from('players').update({ current_elo: newElos[i] }).eq('id', playerIds[i]);
  }

  // Approve match
  const { data: approved } = await supabase
    .from('matches')
    .update({ status: 'approved', approved_by: admin?.id, approved_at: new Date().toISOString() })
    .eq('id', matchId).select().single();

  return NextResponse.json({ match: approved, deltas, newElos });
}
