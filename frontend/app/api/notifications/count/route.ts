import { NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/notifications/count — { count: number }
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player) return NextResponse.json({ count: 0 });

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', player.id)
    .eq('is_read', false);

  if (error) return err(error.message);
  return NextResponse.json({ count: count ?? 0 });
}
