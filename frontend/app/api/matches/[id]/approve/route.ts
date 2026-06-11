import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';
import { calculate2v2 } from '@/lib/elo';
import { autoAwardBadges, recomputeSeasonRanks } from '@/lib/badges';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id: matchId } = await params;

  const { data: match } = await supabase
    .from('matches').select('*').eq('id', matchId).single();
  if (!match) return err('Match not found', 404);
  if (match.status !== 'pending') return err('Match is not pending');
  if (match.winning_team !== 1 && match.winning_team !== 2) {
    return err('Match has no winner set — edit it before approving');
  }

  const admin = await getPlayerByClerkId(auth.userId);

  // Tournament matches marked as not affecting ELO: just mark approved.
  if (match.tournament_id) {
    const { data: tournament } = await supabase
      .from('tournaments').select('affects_elo').eq('id', match.tournament_id).single();
    if (tournament && tournament.affects_elo === false) {
      const { data: approved } = await supabase
        .from('matches')
        .update({ status: 'approved', approved_by: admin?.id, approved_at: new Date().toISOString() })
        .eq('id', matchId).select().single();

      return NextResponse.json({ match: approved, deltas: null, newElos: null });
    }
  }

  const playerIds: string[] = [
    match.team1_player1_id, match.team1_player2_id,
    match.team2_player1_id, match.team2_player2_id,
  ];

  // Fetch (or default) season stats for all 4 players — including peak_elo,
  // so a temporary ELO dip can never erase a previously reached peak.
  const { data: statsRows } = await supabase
    .from('player_season_stats')
    .select('player_id, elo, peak_elo, placement_matches_played, wins, losses')
    .eq('season_id', match.season_id)
    .in('player_id', playerIds);

  const statMap: Record<string, { elo: number; peak: number; placement: number; wins: number; losses: number }> = {};
  for (const pid of playerIds) {
    const s = statsRows?.find(x => x.player_id === pid);
    statMap[pid] = {
      elo: s?.elo ?? 1200,
      peak: s?.peak_elo ?? s?.elo ?? 1200,
      placement: s?.placement_matches_played ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
    };
  }

  const elosBefore = playerIds.map(pid => statMap[pid].elo);

  // Calculate ELO
  const { deltas, newElos } = calculate2v2(
    [elosBefore[0], elosBefore[1]],
    [elosBefore[2], elosBefore[3]],
    match.winning_team,
    [statMap[playerIds[0]].placement, statMap[playerIds[1]].placement,
     statMap[playerIds[2]].placement, statMap[playerIds[3]].placement],
  );

  // Write elo_history (one row per participant)
  const { error: historyError } = await supabase.from('elo_history').insert(
    playerIds.map((pid, i) => ({
      player_id: pid, match_id: matchId, season_id: match.season_id,
      elo_before: elosBefore[i],
      elo_change: deltas[i], elo_after: newElos[i],
    })),
  );
  if (historyError) return err(`Failed to record ELO history: ${historyError.message}`, 500);

  // Upsert player_season_stats + cached players.current_elo, in parallel
  const newPlacements = playerIds.map(pid => Math.min(statMap[pid].placement + 1, 10));

  await Promise.all(playerIds.flatMap((pid, i) => {
    const won = (i < 2 && match.winning_team === 1) || (i >= 2 && match.winning_team === 2);
    return [
      supabase.from('player_season_stats').upsert({
        player_id: pid, season_id: match.season_id,
        elo:       newElos[i],
        peak_elo:  Math.max(newElos[i], statMap[pid].peak),
        wins:      won ? statMap[pid].wins + 1 : statMap[pid].wins,
        losses:    !won ? statMap[pid].losses + 1 : statMap[pid].losses,
        placement_matches_played: newPlacements[i],
      }, { onConflict: 'player_id,season_id' }),
      supabase.from('players').update({ current_elo: newElos[i] }).eq('id', pid),
    ];
  }));

  // Approve match
  const { data: approved, error: approveError } = await supabase
    .from('matches')
    .update({ status: 'approved', approved_by: admin?.id, approved_at: new Date().toISOString() })
    .eq('id', matchId).select().single();
  if (approveError) return err(approveError.message, 500);

  // Post-approval housekeeping: cached ranks + automatic badge awards.
  await Promise.all([
    recomputeSeasonRanks(match.season_id),
    autoAwardBadges({ matchId, playerIds, newElos, placementCounts: newPlacements }),
  ]);

  return NextResponse.json({ match: approved, deltas, newElos });
}
