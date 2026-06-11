import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/tournaments/[id] — public, includes registration count
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: tournament, error } = await supabase
    .from('tournaments').select('*').eq('id', id).single();
  if (error || !tournament) return err('Tournament not found', 404);

  const { count } = await supabase
    .from('tournament_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', id);

  return NextResponse.json({ ...tournament, registration_count: count ?? 0 });
}

// PATCH /api/tournaments/[id] — admin updates tournament details/status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json();

  const allowed = [
    'name', 'description', 'isCasual', 'affectsElo', 'teamFormation',
    'seasonId', 'startDate', 'endDate', 'status',
  ] as const;

  const fieldMap: Record<string, string> = {
    isCasual: 'is_casual',
    affectsElo: 'affects_elo',
    teamFormation: 'team_formation',
    seasonId: 'season_id',
    startDate: 'start_date',
    endDate: 'end_date',
  };

  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      update[fieldMap[key] ?? key] = body[key];
    }
  }

  if (Object.keys(update).length === 0) return err('No valid fields to update');

  if (update.team_formation && !['random', 'self_select'].includes(update.team_formation as string)) {
    return err('teamFormation must be "random" or "self_select"');
  }
  if (update.status && !['upcoming','registration_open','in_progress','completed','cancelled'].includes(update.status as string)) {
    return err('Invalid status');
  }

  const { data, error } = await supabase
    .from('tournaments')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return err(error.message);
  return NextResponse.json(data);
}
