import { NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/notifications?unread=1&limit=50
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player) return err('Player not found', 404);

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unread') === '1' || url.searchParams.get('unread') === 'true';
  const limit = Number(url.searchParams.get('limit') ?? 50);

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('player_id', player.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) return err(error.message);
  return NextResponse.json(data ?? []);
}

// PATCH /api/notifications — mark ALL as read
export async function PATCH() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player) return err('Player not found', 404);

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('player_id', player.id)
    .eq('is_read', false);

  if (error) return err(error.message);
  return NextResponse.json({ success: true });
}
