import { NextRequest, NextResponse } from 'next/server';
import { err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seasonId = req.nextUrl.searchParams.get('seasonId');

  let query = supabase
    .from('elo_history')
    .select('elo_before, elo_change, elo_after, recorded_at, season_id')
    .eq('player_id', id)
    .order('recorded_at', { ascending: true });

  if (seasonId) query = query.eq('season_id', seasonId);

  const { data, error } = await query;
  if (error) return err(error.message);
  return NextResponse.json(data);
}
