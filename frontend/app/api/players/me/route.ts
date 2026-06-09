import { NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabase
    .from('players')
    .select('*, player_badges(badge_id, awarded_at, badges(name, icon_name, description))')
    .eq('clerk_user_id', auth.userId)
    .single();

  if (error || !data) return err('Player not found', 404);
  return NextResponse.json(data);
}
