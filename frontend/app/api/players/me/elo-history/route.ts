import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player) return err('Player not found', 404);

  const seasonId = req.nextUrl.searchParams.get('seasonId');

  let query = supabase
    .from('elo_history')
    .select('elo_before, elo_change, elo_after, recorded_at, season_id')
    .eq('player_id', player.id)
    .order('recorded_at', { ascending: true });

  if (seasonId) query = query.eq('season_id', seasonId);

  const { data, error } = await query;
  if (error) return err(error.message);
  return NextResponse.json(data);
}
