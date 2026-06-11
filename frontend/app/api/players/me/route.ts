import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, err } from '@/lib/api-helpers';
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

// PATCH /api/players/me — update own profile fields (university, bio)
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (typeof body.university === 'string') updates.university = body.university.trim() || null;
  if (typeof body.bio === 'string') updates.bio = body.bio.trim() || null;

  if (Object.keys(updates).length === 0) {
    return err('Nothing to update — provide university and/or bio');
  }

  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('clerk_user_id', auth.userId)
    .select()
    .single();

  if (error || !data) return err('Player not found', 404);
  return NextResponse.json(data);
}
