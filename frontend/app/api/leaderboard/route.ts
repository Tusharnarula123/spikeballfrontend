import { NextRequest, NextResponse } from 'next/server';
import { err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const gender = req.nextUrl.searchParams.get('gender');

  let query = supabase.from('leaderboard_active').select('*');
  if (gender) query = query.eq('gender', gender);

  const { data, error } = await query;
  if (error) return err(error.message);

  return NextResponse.json(
    (data ?? []).map((p, i) => ({ ...p, rank: i + 1 })),
  );
}
