import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// POST /api/tournaments/[id]/register — current player registers for a tournament
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: tournamentId } = await params;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player || player.status !== 'active') {
    return err('Only active players can register for tournaments', 403);
  }

  const { data: tournament } = await supabase
    .from('tournaments').select('*').eq('id', tournamentId).single();
  if (!tournament) return err('Tournament not found', 404);
  if (tournament.status !== 'registration_open') {
    return err('Registration is not open for this tournament');
  }

  const body = await req.json().catch(() => ({}));
  const preferredPartnerId: string | null = body?.preferredPartnerId ?? null;

  if (preferredPartnerId === player.id) {
    return err('You cannot select yourself as a teammate');
  }

  const { data, error } = await supabase
    .from('tournament_registrations')
    .insert({
      tournament_id: tournamentId,
      player_id: player.id,
      preferred_partner_id: preferredPartnerId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return err('You are already registered for this tournament');
    return err(error.message);
  }
  return NextResponse.json(data, { status: 201 });
}

// DELETE /api/tournaments/[id]/register — current player withdraws registration
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: tournamentId } = await params;

  const player = await getPlayerByClerkId(auth.userId);
  if (!player) return err('Player not found', 404);

  const { data: tournament } = await supabase
    .from('tournaments').select('status').eq('id', tournamentId).single();
  if (tournament && tournament.status === 'in_progress') {
    return err('Cannot withdraw once the tournament is in progress');
  }

  const { error } = await supabase
    .from('tournament_registrations')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('player_id', player.id);

  if (error) return err(error.message);
  return NextResponse.json({ success: true });
}
