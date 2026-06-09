import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { supabase } from './supabase';

export type ClerkUser = { userId: string; role: string };

/** Get current Clerk user + role. Returns 401 response if not authenticated. */
export async function requireAuth(): Promise<ClerkUser | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const role = (user.publicMetadata?.role as string) ?? 'player';
  return { userId, role };
}

/** Require admin role. Returns 403 if not admin. */
export async function requireAdmin(): Promise<ClerkUser | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (result.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return result;
}

/** Resolve a Clerk userId to our internal player row. */
export async function getPlayerByClerkId(clerkUserId: string) {
  const { data } = await supabase
    .from('players')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();
  return data;
}

/** Get the currently active season. */
export async function getActiveSeason() {
  const { data } = await supabase
    .from('seasons')
    .select('id, name, starting_elo')
    .eq('is_active', true)
    .single();
  return data;
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
