import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { data, error } = await supabase
    .from('players')
    .update({ status: 'suspended' })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) return err('Player not found', 404);
  return NextResponse.json(data);
}
