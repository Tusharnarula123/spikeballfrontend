import { NextRequest, NextResponse } from 'next/server';
import { err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params;
  const gender = req.nextUrl.searchParams.get('gender');

  let query = supabase
    .from('player_season_stats')
    .select('*, players!inner(id, first_name, last_name, gender, status)')
    .eq('season_id', seasonId)
    .eq('players.status', 'active')
    .order('elo', { ascending: false });

  if (gender) query = query.eq('players.gender', gender);

  const { data, error } = await query;
  if (error) return err(error.message);

  return NextResponse.json(
    (data ?? []).map((p, i) => ({ ...p, rank: i + 1 })),
  );
}
