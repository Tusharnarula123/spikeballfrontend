import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

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
