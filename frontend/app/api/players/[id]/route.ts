import { NextRequest, NextResponse } from 'next/server';
import { err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, gender, current_elo, status, created_at, player_badges(badge_id, awarded_at, badges(name, icon_name, description))')
    .eq('id', id)
    .single();

  if (error || !data) return err('Player not found', 404);
  if (data.status !== 'active') return err('Player not found', 404);
  return NextResponse.json(data);
}
