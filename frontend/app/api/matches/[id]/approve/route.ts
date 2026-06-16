import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';
import { calculate2v2 } from '@/lib/elo';
import { autoAwardBadges, recomputeSeasonRanks } from '@/lib/badges';

// ─── Bracket helpers ──────────────────────────────────────────────────────────

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** After a bracket match is approved, advance the winner to the next round.
 *  Creates the next-round match only once both "sibling" R1 matches are done. */
async function advanceWinner(
  tournamentId: string,
  seasonId: string | null,
  currentRound: number,
  currentSlot: number,
  winnerP1: string,
  winnerP2: string,
) {
  const nextRound   = currentRound + 1;
  const nextSlot    = Math.floor(currentSlot / 2);
  const isTeam1Pos  = currentSlot % 2 === 0; // even slot → winner becomes team1 of next match
  const siblingSlot = isTeam1Pos ? currentSlot + 1 : currentSlot - 1;

  // Case A: next-round match was already created by the sibling slot winning first
  const { data: existingNext } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('bracket_round', nextRound)
    .eq('bracket_slot', nextSlot)
    .maybeSingle();

  if (existingNext) {
    // Fill in our winner slot (the sibling already filled theirs)
    const update = isTeam1Pos
      ? { team1_player1_id: winnerP1, team1_player2_id: winnerP2 }
      : { team2_player1_id: winnerP1, team2_player2_id: winnerP2 };
    await supabase.from('matches').update(update).eq('id', existingNext.id);
    return;
  }

  // Case B: check if the sibling match is already approved
  const { data: sibling } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('bracket_round', currentRound)
    .eq('bracket_slot', siblingSlot)
    .eq('status', 'approved')
    .maybeSingle();

  if (!sibling) {
    // Sibling not done yet — do nothing; the sibling's approval will create the match
    return;
  }

  // Both slots done — create the next-round match with both winners
  const sibP1 = sibling.winning_team === 1 ? sibling.team1_player1_id : sibling.team2_player1_id;
  const sibP2 = sibling.winning_team === 1 ? sibling.team1_player2_id : sibling.team2_player2_id;

  const team1P1 = isTeam1Pos ? winnerP1 : sibP1;
  const team1P2 = isTeam1Pos ? winnerP2 : sibP2;
  const team2P1 = isTeam1Pos ? sibP1    : winnerP1;
  const team2P2 = isTeam1Pos ? sibP2    : winnerP2;

  await supabase.from('matches').insert({
    tournament_id:    tournamentId,
    season_id:        seasonId,
    bracket_round:    nextRound,
    bracket_slot:     nextSlot,
    team1_player1_id: team1P1,
    team1_player2_id: team1P2,
    team2_player1_id: team2P1,
    team2_player2_id: team2P2,
    status:           'pending',
    winning_team:     null,
  });
}

// ─── PATCH /api/matches/[id]/approve ─────────────────────────────────────────

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

      // Still advance bracket winner even for casual tournaments
      await maybeBracketAdvance(match, approved);

      return NextResponse.json({ match: approved, deltas: null, newElos: null });
    }
  }

  const playerIds: string[] = [
    match.team1_player1_id, match.team1_player2_id,
    match.team2_player1_id, match.team2_player2_id,
  ];

  // Fetch (or default) season stats for all 4 players
  const { data: statsRows } = await supabase
    .from('player_season_stats')
    .select('player_id, elo, peak_elo, placement_matches_played, wins, losses')
    .eq('season_id', match.season_id)
    .in('player_id', playerIds);

  const statMap: Record<string, { elo: number; peak: number; placement: number; wins: number; losses: number }> = {};
  for (const pid of playerIds) {
    const s = statsRows?.find(x => x.player_id === pid);
    statMap[pid] = {
      elo:       s?.elo ?? 1200,
      peak:      s?.peak_elo ?? s?.elo ?? 1200,
      placement: s?.placement_matches_played ?? 0,
      wins:      s?.wins ?? 0,
      losses:    s?.losses ?? 0,
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

  // Write elo_history
  const { error: historyError } = await supabase.from('elo_history').insert(
    playerIds.map((pid, i) => ({
      player_id: pid, match_id: matchId, season_id: match.season_id,
      elo_before: elosBefore[i],
      elo_change: deltas[i], elo_after: newElos[i],
    })),
  );
  if (historyError) return err(`Failed to record ELO history: ${historyError.message}`, 500);

  // Upsert player_season_stats + cached players.current_elo
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

  // Post-approval housekeeping
  await Promise.all([
    recomputeSeasonRanks(match.season_id),
    autoAwardBadges({ matchId, playerIds, newElos, placementCounts: newPlacements }),
  ]);

  // Auto-advance bracket winner (non-blocking, errors logged but not thrown)
  await maybeBracketAdvance(match, approved);

  return NextResponse.json({ match: approved, deltas, newElos });
}

// ─── Bracket advancement ──────────────────────────────────────────────────────

async function maybeBracketAdvance(
  match: Record<string, unknown>,
  approved: Record<string, unknown> | null,
) {
  const bracketRound = match.bracket_round as number | null;
  const tournamentId = match.tournament_id as string | null;
  if (!bracketRound || !tournamentId) return;

  // Determine total rounds from team count so we don't advance past the Final
  const { count: teamCount } = await supabase
    .from('tournament_teams')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId);

  const N = teamCount ?? 0;
  if (N < 2) return;

  const totalRounds = Math.log2(nextPow2(N));

  // Don't advance from the Final or beyond
  if (bracketRound >= totalRounds) return;

  const winningTeam = (approved ?? match).winning_team as 1 | 2;
  const winnerP1 = winningTeam === 1
    ? match.team1_player1_id as string
    : match.team2_player1_id as string;
  const winnerP2 = winningTeam === 1
    ? match.team1_player2_id as string
    : match.team2_player2_id as string;

  try {
    await advanceWinner(
      tournamentId,
      match.season_id as string | null,
      bracketRound,
      match.bracket_slot as number,
      winnerP1,
      winnerP2,
    );
  } catch (e) {
    console.error('[bracket-advance] Failed to advance winner:', e);
  }
}
