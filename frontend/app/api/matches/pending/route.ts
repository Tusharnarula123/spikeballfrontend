import { NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/matches/pending — admin: pending matches awaiting approval, with
// player names and tournament info joined for the Approvals page.
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      team1_player1:players!team1_player1_id ( id, first_name, last_name ),
      team1_player2:players!team1_player2_id ( id, first_name, last_name ),
      team2_player1:players!team2_player1_id ( id, first_name, last_name ),
      team2_player2:players!team2_player2_id ( id, first_name, last_name ),
      tournament:tournaments ( id, name, is_casual, affects_elo )
    `)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });

  if (error) return err(error.message);
  return NextResponse.json(data);
}
