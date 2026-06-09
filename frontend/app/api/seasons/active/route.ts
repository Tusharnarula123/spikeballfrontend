import { NextResponse } from 'next/server';
import { err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('seasons').select('*').eq('is_active', true).single();
  if (error) return err('No active season', 404);
  return NextResponse.json(data);
}
