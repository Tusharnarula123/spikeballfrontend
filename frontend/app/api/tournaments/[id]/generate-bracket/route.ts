import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function isPow2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** Returns seed numbers in bracket-slot order for a bracket of size n.
 *  E.g. seededOrder(8) = [1,8,4,5,2,7,3,6]
 *  Adjacent pairs are match-ups: slot 0 = seeds 1 vs 8, slot 1 = seeds 4 vs 5 … */
function seededOrder(n: number): number[] {
  if (n === 1) return [1];
  const half = seededOrder(n / 2);
  return half.flatMap(s => [s, n + 1 - s]);
}

// ─── POST /api/tournaments/[id]/generate-bracket ──────────────────────────────

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id: tournamentId } = await params;

  // ── Validate tournament ──
  const { data: tournament } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).single();
  if (!tournament) return err('Tournament not found', 404);
  if (tournament.status !== 'in_progress') {
    return err('Set tournament status to "In Progress" before generating the bracket');
  }

  // ── Guard: no bracket already generated ──
  const { count: existingCount } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)
    .not('bracket_round', 'is', null);
  if ((existingCount ?? 0) > 0) {
    return err('Bracket already generated for this tournament. Reset matches first to regenerate.');
  }

  // ── Load teams with player ELO for seeding ──
  const { data: teams, error: teamsError } = await supabase
    .from('tournament_teams')
    .select(`
      id, player1_id, player2_id, name,
      player1:players!player1_id(id, current_elo, first_name, last_name),
      player2:players!player2_id(id, current_elo, first_name, last_name)
    `)
    .eq('tournament_id', tournamentId);

  if (teamsError) return err(teamsError.message);
  if (!teams || teams.length < 2) {
    return err('Need at least 2 teams. Run "Form Teams" first.');
  }

  const N = teams.length;

  // ── Validate bracket size ──
  if (!isPow2(N)) {
    const lo = nextPow2(N) / 2;
    const hi = nextPow2(N);
    return err(
      `Need exactly ${lo} or ${hi} teams for a clean bracket (currently ${N}). ` +
      `Add ${hi - N} more team${hi - N === 1 ? '' : 's'} or remove ${N - lo} team${N - lo === 1 ? '' : 's'}.`
    );
  }

  // ── Sort teams by average ELO desc (seed 1 = best) ──
  const sortedTeams = [...teams].sort((a, b) => {
    const eloA = (((a.player1 as unknown as { current_elo: number })?.current_elo ?? 1200) +
                  ((a.player2 as unknown as { current_elo: number })?.current_elo ?? 1200)) / 2;
    const eloB = (((b.player1 as unknown as { current_elo: number })?.current_elo ?? 1200) +
                  ((b.player2 as unknown as { current_elo: number })?.current_elo ?? 1200)) / 2;
    return eloB - eloA;
  });

  // ── Get season for new matches ──
  const seasonId: string | null = tournament.season_id ?? (
    await supabase.from('seasons').select('id').eq('is_active', true).single()
  ).data?.id ?? null;

  // ── Build seeded R1 match-ups ──
  const seeds = seededOrder(N); // N is a power of 2, so no byes
  const matchInserts: Record<string, unknown>[] = [];

  for (let i = 0; i < seeds.length; i += 2) {
    const s1 = seeds[i];     // higher seed (smaller number = better ELO)
    const s2 = seeds[i + 1]; // lower seed
    const slot = i / 2;

    const team1 = sortedTeams[s1 - 1]; // 0-indexed
    const team2 = sortedTeams[s2 - 1];

    matchInserts.push({
      tournament_id: tournamentId,
      season_id: seasonId,
      bracket_round: 1,
      bracket_slot: slot,
      team1_player1_id: (team1.player1 as { id: string }).id,
      team1_player2_id: (team1.player2 as { id: string }).id,
      team2_player1_id: (team2.player1 as { id: string }).id,
      team2_player2_id: (team2.player2 as { id: string }).id,
      status: 'pending',
      winning_team: null,
    });
  }

  const { data: created, error: insertError } = await supabase
    .from('matches')
    .insert(matchInserts)
    .select('id');

  if (insertError) return err(insertError.message);

  const totalRounds = Math.log2(N); // log2 of power-of-2 = integer

  return NextResponse.json({
    created: created?.length ?? 0,
    teams: N,
    totalRounds,
    message: `Bracket generated! ${created?.length} Round 1 match${(created?.length ?? 0) === 1 ? '' : 'es'} created. Players can now see and submit scores from the bracket page.`,
  }, { status: 201 });
}
