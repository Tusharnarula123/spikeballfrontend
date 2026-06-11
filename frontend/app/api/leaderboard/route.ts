import { NextRequest, NextResponse } from 'next/server';
import { err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

// GET /api/leaderboard?gender=male|female
// Reads the leaderboard_active view and normalizes its raw columns
// (first_name / elo / ...) into the shape every page consumes
// (display_name / current_elo / total_matches / win_rate / ...).
export async function GET(req: NextRequest) {
  const gender = req.nextUrl.searchParams.get('gender');

  let query = supabase.from('leaderboard_active').select('*');
  if (gender) query = query.eq('gender', gender);

  const { data, error } = await query;
  if (error) return err(error.message);

  return NextResponse.json(
    (data ?? []).map((p, i) => {
      const wins = p.wins ?? 0;
      const losses = p.losses ?? 0;
      const totalMatches = wins + losses;
      return {
        rank: i + 1,
        player_id: p.id,
        display_name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        gender: p.gender ?? null,
        current_elo: p.elo ?? 1200,
        peak_elo: p.peak_elo ?? p.elo ?? 1200,
        wins,
        losses,
        total_matches: totalMatches,
        win_rate: totalMatches > 0 ? (wins / totalMatches) * 100 : 0,
        placement_matches_played: p.placement_matches_played ?? 0,
      };
    }),
  );
}
