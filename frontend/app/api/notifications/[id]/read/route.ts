import { NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// PATCH /api/notifications/[id]/read
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player) return err('Player not found', 404);

  const { id } = await params;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('player_id', player.id); // security: own notifications only

  if (error) return err(error.message);
  return NextResponse.json({ success: true });
}
