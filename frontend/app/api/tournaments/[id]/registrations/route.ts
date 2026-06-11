import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/tournaments/[id]/registrations — admin: list registrants + team assignments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id: tournamentId } = await params;

  const { data, error } = await supabase
    .from('tournament_registrations')
    .select(`
      id, registered_at, preferred_partner_id, team_id,
      player:players!player_id ( id, first_name, last_name, email, age, gender, university, current_elo ),
      preferred_partner:players!preferred_partner_id ( id, first_name, last_name ),
      team:tournament_teams!team_id ( id, player1_id, player2_id )
    `)
    .eq('tournament_id', tournamentId)
    .order('registered_at', { ascending: true });

  if (error) return err(error.message);
  return NextResponse.json(data);
}
