import { NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/tournaments/me — tournaments the current player is registered for,
// including their team (if formed) and partner info.
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player) return err('Player not found', 404);

  const { data, error } = await supabase
    .from('tournament_registrations')
    .select(`
      id, registered_at, preferred_partner_id, team_id,
      tournament:tournaments ( * ),
      team:tournament_teams!team_id (
        id, player1_id, player2_id,
        player1:players!player1_id ( id, first_name, last_name ),
        player2:players!player2_id ( id, first_name, last_name )
      )
    `)
    .eq('player_id', player.id)
    .order('registered_at', { ascending: false });

  if (error) return err(error.message);

  const result = (data ?? []).map((row: any) => {
    let partner = null;
    if (row.team) {
      const isP1 = row.team.player1_id === player.id;
      const partnerRow = isP1 ? row.team.player2 : row.team.player1;
      if (partnerRow) {
        partner = { id: partnerRow.id, name: `${partnerRow.first_name} ${partnerRow.last_name}` };
      }
    }
    return {
      registrationId: row.id,
      registeredAt: row.registered_at,
      preferredPartnerId: row.preferred_partner_id,
      tournament: row.tournament,
      teamId: row.team_id,
      partner,
    };
  });

  return NextResponse.json(result);
}
