import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getPlayerByClerkId, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/tournaments?status=registration_open — public list (used by announcements/register)
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');

  let query = supabase
    .from('tournaments')
    .select('*, tournament_registrations(count)')
    .order('start_date', { ascending: true });

  if (status) {
    const statuses = status.split(',').map(s => s.trim());
    query = query.in('status', statuses);
  }

  const { data, error } = await query;
  if (error) return err(error.message);

  const result = (data ?? []).map((t: any) => ({
    ...t,
    registration_count: t.tournament_registrations?.[0]?.count ?? 0,
    tournament_registrations: undefined,
  }));

  return NextResponse.json(result);
}

// POST /api/tournaments — admin creates a new tournament
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admin = await getPlayerByClerkId(auth.userId);

  const body = await req.json();
  const {
    name,
    description,
    isCasual,
    affectsElo,
    teamFormation,
    seasonId,
    startDate,
    endDate,
    status,
  } = body;

  if (!name || !startDate) return err('name and startDate are required');
  if (teamFormation && !['random', 'self_select'].includes(teamFormation)) {
    return err('teamFormation must be "random" or "self_select"');
  }

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name,
      description: description ?? null,
      is_casual: !!isCasual,
      affects_elo: affectsElo ?? !isCasual,
      team_formation: teamFormation ?? 'random',
      season_id: seasonId ?? null,
      start_date: startDate,
      end_date: endDate ?? null,
      status: status ?? 'registration_open',
      created_by: admin?.id ?? null,
    })
    .select()
    .single();

  if (error) return err(error.message);
  return NextResponse.json(data, { status: 201 });
}
