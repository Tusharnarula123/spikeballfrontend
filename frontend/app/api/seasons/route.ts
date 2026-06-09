import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('seasons').select('*').order('start_date', { ascending: false });
  if (error) return err(error.message);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { name, startDate, endDate, startingElo } = await req.json();

  const { data, error } = await supabase
    .from('seasons')
    .insert({ name, start_date: startDate, end_date: endDate, starting_elo: startingElo ?? 1200, is_active: false })
    .select().single();

  if (error) return err(error.message);
  return NextResponse.json(data, { status: 201 });
}
