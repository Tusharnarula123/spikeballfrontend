import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Deactivate current
  await supabase.from('seasons').update({ is_active: false }).eq('is_active', true);

  const { data, error } = await supabase
    .from('seasons').update({ is_active: true }).eq('id', id).select().single();

  if (error || !data) return err('Season not found', 404);
  return NextResponse.json(data);
}
