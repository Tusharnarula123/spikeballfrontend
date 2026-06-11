import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// PATCH /api/matches/[id] — admin: edit a pending match's score/winner/notes
// before approving it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id: matchId } = await params;

  const { data: match } = await supabase
    .from('matches').select('status').eq('id', matchId).single();
  if (!match) return err('Match not found', 404);
  if (match.status !== 'pending') return err('Only pending matches can be edited');

  const body = await req.json();
  const { winningTeam, scoreTeam1, scoreTeam2, notes } = body;

  const update: Record<string, unknown> = {};
  if (winningTeam !== undefined) {
    if (![1, 2].includes(winningTeam)) return err('winningTeam must be 1 or 2');
    update.winning_team = winningTeam;
  }
  if (scoreTeam1 !== undefined) {
    if (typeof scoreTeam1 !== 'number' || scoreTeam1 < 0) return err('scoreTeam1 must be a non-negative number');
    update.score_team1 = scoreTeam1;
  }
  if (scoreTeam2 !== undefined) {
    if (typeof scoreTeam2 !== 'number' || scoreTeam2 < 0) return err('scoreTeam2 must be a non-negative number');
    update.score_team2 = scoreTeam2;
  }
  if (notes !== undefined) update.notes = notes;

  if (Object.keys(update).length === 0) return err('No valid fields to update');

  const { data, error } = await supabase
    .from('matches')
    .update(update)
    .eq('id', matchId)
    .select()
    .single();

  if (error) return err(error.message);
  return NextResponse.json(data);
}
