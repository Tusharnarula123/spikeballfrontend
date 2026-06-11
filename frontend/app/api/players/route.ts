import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/players?status=active|pending|suspended|all&excludeSelf=true&search=foo
// Used for teammate/opponent pickers (default status=active) and the admin
// Members page (status=all — admin only, returns the full roster).
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status') ?? 'active';
  const excludeSelf = searchParams.get('excludeSelf') === 'true';
  const search = searchParams.get('search');

  // Anything beyond the default active-player picker is admin-only.
  if (status !== 'active' && auth.role !== 'admin') {
    return err('Forbidden', 403);
  }

  let query = supabase
    .from('players')
    .select('id, first_name, last_name, email, age, gender, university, current_elo, status, created_at')
    .order('first_name', { ascending: true });

  if (status !== 'all') query = query.eq('status', status);
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

  if (excludeSelf) {
    const me = await getPlayerByClerkId(auth.userId);
    if (me) query = query.neq('id', me.id);
  }

  const { data, error } = await query;
  if (error) return err(error.message);
  return NextResponse.json(data);
}

// POST /api/players  — register after Clerk signup
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { firstName, lastName, email, age, gender } = body;

  if (!firstName || !lastName || !email || !age || !gender) {
    return err('Missing required fields');
  }

  const existing = await getPlayerByClerkId(auth.userId);
  if (existing) return err('Player already registered', 409);

  const { data, error } = await supabase
    .from('players')
    .insert({
      clerk_user_id: auth.userId,
      first_name: firstName,
      last_name: lastName,
      email,
      age: Number(age),
      gender,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return err(error.message);
  return NextResponse.json(data, { status: 201 });
}
