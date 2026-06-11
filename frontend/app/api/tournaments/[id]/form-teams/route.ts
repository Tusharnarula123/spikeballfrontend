import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

interface Registration {
  id: string;
  player_id: string;
  preferred_partner_id: string | null;
  team_id: string | null;
}

// POST /api/tournaments/[id]/form-teams — admin: pair registrants into teams
//
// For 'self_select' tournaments, mutual preferred-partner pairs are matched
// first. Everyone else (and everyone in 'random' tournaments) is shuffled
// and paired sequentially. If an odd number of players remain, the last one
// is left unpaired (returned as `unpaired`).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id: tournamentId } = await params;

  const { data: tournament } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).single();
  if (!tournament) return err('Tournament not found', 404);

  const { data: registrations, error: regError } = await supabase
    .from('tournament_registrations')
    .select('id, player_id, preferred_partner_id, team_id')
    .eq('tournament_id', tournamentId)
    .is('team_id', null) as { data: Registration[] | null; error: unknown };

  if (regError) return err('Failed to load registrations');
  const pool = registrations ?? [];
  if (pool.length < 2) return err('Need at least 2 unpaired players to form teams');

  const byPlayer = new Map(pool.map(r => [r.player_id, r]));
  const paired = new Set<string>();
  const pairs: [string, string][] = [];

  // 1. Mutual preferred-partner pairs (self_select tournaments)
  if (tournament.team_formation === 'self_select') {
    for (const reg of pool) {
      if (paired.has(reg.player_id)) continue;
      const partnerId = reg.preferred_partner_id;
      if (!partnerId) continue;
      const partnerReg = byPlayer.get(partnerId);
      if (!partnerReg || paired.has(partnerId)) continue;
      if (partnerReg.preferred_partner_id === reg.player_id) {
        pairs.push([reg.player_id, partnerId]);
        paired.add(reg.player_id);
        paired.add(partnerId);
      }
    }
  }

  // 2. Shuffle + pair everyone remaining
  const remaining = pool.map(r => r.player_id).filter(id => !paired.has(id));
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  let unpaired: string | null = null;
  for (let i = 0; i + 1 < remaining.length; i += 2) {
    pairs.push([remaining[i], remaining[i + 1]]);
  }
  if (remaining.length % 2 === 1) unpaired = remaining[remaining.length - 1];

  // 3. Insert teams + update registrations
  const teamsCreated = [];
  for (const [p1, p2] of pairs) {
    const { data: team, error: teamError } = await supabase
      .from('tournament_teams')
      .insert({ tournament_id: tournamentId, player1_id: p1, player2_id: p2 })
      .select()
      .single();
    if (teamError) return err(teamError.message);

    await supabase
      .from('tournament_registrations')
      .update({ team_id: team.id })
      .in('player_id', [p1, p2])
      .eq('tournament_id', tournamentId);

    teamsCreated.push(team);
  }

  return NextResponse.json({ teamsCreated, unpaired, pairedCount: pairs.length * 2 });
}
