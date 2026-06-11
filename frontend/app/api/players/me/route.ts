import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
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

// PATCH /api/players/me — update own profile (name, university, bio).
// Name changes are synced to BOTH Clerk and the players table.
// If no players row exists yet for this Clerk account (e.g. the account was
// created directly in the Clerk dashboard), one is created automatically.
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));

  const firstName  = typeof body.firstName  === 'string' ? body.firstName.trim()  : undefined;
  const lastName   = typeof body.lastName   === 'string' ? body.lastName.trim()   : undefined;
  const university = typeof body.university === 'string' ? body.university.trim() : undefined;
  const bio        = typeof body.bio        === 'string' ? body.bio.trim()        : undefined;

  if (firstName === '') return err('First name cannot be empty');

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(auth.userId);

  // Find the player row — create it if this Clerk account never got one.
  let { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('clerk_user_id', auth.userId)
    .single();

  if (!player) {
    const { data: created, error: createError } = await supabase
      .from('players')
      .insert({
        clerk_user_id: auth.userId,
        first_name: firstName || clerkUser.firstName || 'Player',
        last_name:  lastName  ?? clerkUser.lastName  ?? '',
        email: clerkUser.primaryEmailAddress?.emailAddress
          ?? clerkUser.emailAddresses[0]?.emailAddress
          ?? `${auth.userId}@unknown.local`,
        // Admins are auto-active; regular players follow the normal approval flow.
        status: auth.role === 'admin' ? 'active' : 'pending',
      })
      .select('id')
      .single();
    if (createError || !created) {
      return err(`Could not create player record: ${createError?.message ?? 'unknown error'}`, 500);
    }
    player = created;
  }

  // Build the players-table update
  const updates: Record<string, unknown> = {};
  if (firstName  !== undefined && firstName !== '') updates.first_name = firstName;
  if (lastName   !== undefined) updates.last_name  = lastName;   // empty allowed
  if (university !== undefined) updates.university = university || null;
  if (bio        !== undefined) updates.bio        = bio || null;

  if (Object.keys(updates).length === 0) return err('Nothing to update');

  const { data: updated, error: updateError } = await supabase
    .from('players')
    .update(updates)
    .eq('id', player.id)
    .select()
    .single();
  if (updateError || !updated) return err(updateError?.message ?? 'Update failed', 500);

  // Keep Clerk in sync so greetings/avatars match (best-effort — a Clerk
  // hiccup shouldn't undo the saved profile).
  if (firstName || lastName !== undefined) {
    try {
      await client.users.updateUser(auth.userId, {
        ...(firstName ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
      });
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json(updated);
}