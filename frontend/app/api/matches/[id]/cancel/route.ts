import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { notes } = await req.json().catch(() => ({}));

  const { data, error } = await supabase
    .from('matches').update({ status: 'cancelled', notes }).eq('id', id).select().single();

  if (error || !data) return err('Match not found', 404);
  return NextResponse.json(data);
}
