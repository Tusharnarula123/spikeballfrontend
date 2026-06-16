import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { sendNotificationEmail } from '@/lib/mail';
import { supabase } from '@/lib/supabase';

interface Registration {
  id: string;
  player_id: string;
  preferred_partner_id: string | null;
  team_id: string | null;
}

// POST /api/tournaments/[id]/form-teams — admin: pair registrants into teams
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

  // Fetch player details for notifications
  const allPlayerIds = pairs.flat();
  const { data: playerRows } = await supabase
    .from('players')
    .select('id, first_name, last_name, email')
    .in('id', allPlayerIds);

  const playerMap = new Map(
    (playerRows ?? []).map((p) => [p.id, p as { id: string; first_name: string; last_name: string; email: string }]),
  );

  // 3. Insert teams + update registrations + notify players
  const teamsCreated = [];
  const notifInserts: Record<string, unknown>[] = [];
  const mailPromises: Promise<void>[] = [];
  const tournamentLink = `/dashboard/tournaments/${tournamentId}`;

  for (const [p1, p2] of pairs) {
    const pA = playerMap.get(p1);
    const pB = playerMap.get(p2);
    const teamName = `${pA?.first_name ?? 'Player'} & ${pB?.first_name ?? 'Player'}`;

    const { data: team, error: teamError } = await supabase
      .from('tournament_teams')
      .insert({ tournament_id: tournamentId, player1_id: p1, player2_id: p2, name: teamName })
      .select()
      .single();
    if (teamError) return err(teamError.message);

    await supabase
      .from('tournament_registrations')
      .update({ team_id: team.id })
      .in('player_id', [p1, p2])
      .eq('tournament_id', tournamentId);

    teamsCreated.push(team);

    // Queue in-app notifications and emails for both players
    for (const [pid, partnerPid] of [[p1, p2], [p2, p1]]) {
      const player  = playerMap.get(pid);
      const partner = playerMap.get(partnerPid);
      if (!player || !partner) continue;

      const partnerName = `${partner.first_name} ${partner.last_name}`;
      const title = `You've been teamed up in ${tournament.name}!`;
      const body  = `You'll be playing with ${partnerName} in ${tournament.name}. Head to the tournament bracket to see your upcoming matches.`;

      notifInserts.push({
        player_id: pid,
        type: 'team_assigned',
        title,
        body,
        link: tournamentLink,
      });

      if (player.email) {
        mailPromises.push(
          sendNotificationEmail({
            to: player.email,
            subject: `Team assigned — ${tournament.name}`,
            title,
            body,
            link: tournamentLink,
            linkLabel: 'View Tournament Bracket',
          }),
        );
      }
    }
  }

  // Fire notifications + emails (best-effort, non-blocking)
  await Promise.allSettled([
    notifInserts.length > 0
      ? supabase.from('notifications').insert(notifInserts)
      : Promise.resolve(),
    ...mailPromises,
  ]);

  return NextResponse.json({ teamsCreated, unpaired, pairedCount: pairs.length * 2 });
}
