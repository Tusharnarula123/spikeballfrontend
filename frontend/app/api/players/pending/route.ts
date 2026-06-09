import { NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, email, age, gender, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return err(error.message);
  return NextResponse.json(data);
}
