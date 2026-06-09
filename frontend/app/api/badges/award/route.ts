import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { playerId, badgeId } = await req.json();
  const admin = await getPlayerByClerkId(auth.userId);

  const { data, error } = await supabase
    .from('player_badges')
    .insert({ player_id: playerId, badge_id: badgeId, awarded_by: admin?.id })
    .select().single();

  if (error) return err(error.message);
  return NextResponse.json(data, { status: 201 });
}
