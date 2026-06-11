import { supabase } from './supabase';

/**
 * Auto-award badges to the 4 players of a just-approved match, based on the
 * trigger rules defined in the `badges` table:
 *   elo_threshold  — new ELO crossed trigger_value
 *   match_count    — total approved matches reached trigger_value
 *   win_streak     — last trigger_value approved matches were all wins
 *   placement_done — all 10 placement matches completed
 * ('manual' badges are only awarded by admins via /api/badges/award.)
 *
 * Existing awards are skipped via the (player_id, badge_id) unique constraint;
 * we also pre-check to keep inserts clean. Failures here must never block
 * match approval, so everything is wrapped defensively.
 */
export async function autoAwardBadges(opts: {
  matchId: string;
  playerIds: string[];
  newElos: number[];
  placementCounts: number[]; // AFTER this match (capped at 10)
}): Promise<void> {
  try {
    const { matchId, playerIds, newElos, placementCounts } = opts;

    const { data: badges } = await supabase
      .from('badges')
      .select('id, trigger_type, trigger_value')
      .neq('trigger_type', 'manual');
    if (!badges || badges.length === 0) return;

    // Badges each player already has
    const { data: owned } = await supabase
      .from('player_badges')
      .select('player_id, badge_id')
      .in('player_id', playerIds);
    const ownedSet = new Set((owned ?? []).map(o => `${o.player_id}:${o.badge_id}`));

    const inserts: { player_id: string; badge_id: string; match_id: string }[] = [];

    for (let i = 0; i < playerIds.length; i++) {
      const pid = playerIds[i];

      // Per-player approved match history (most recent first) for streak/count checks
      const needsHistory = badges.some(b => b.trigger_type === 'match_count' || b.trigger_type === 'win_streak');
      let totalMatches = 0;
      let results: boolean[] = []; // true = win, most recent first

      if (needsHistory) {
        const { data: history } = await supabase
          .from('matches')
          .select('id, winning_team, team1_player1_id, team1_player2_id')
          .eq('status', 'approved')
          .or(
            `team1_player1_id.eq.${pid},team1_player2_id.eq.${pid},` +
            `team2_player1_id.eq.${pid},team2_player2_id.eq.${pid}`,
          )
          .order('approved_at', { ascending: false })
          .limit(200);

        const rows = history ?? [];
        totalMatches = rows.length;
        results = rows.map(m => {
          const onTeam1 = m.team1_player1_id === pid || m.team1_player2_id === pid;
          return onTeam1 ? m.winning_team === 1 : m.winning_team === 2;
        });
      }

      for (const badge of badges) {
        if (ownedSet.has(`${pid}:${badge.id}`)) continue;

        let earned = false;
        switch (badge.trigger_type) {
          case 'elo_threshold':
            earned = badge.trigger_value != null && newElos[i] >= badge.trigger_value;
            break;
          case 'match_count':
            earned = badge.trigger_value != null && totalMatches >= badge.trigger_value;
            break;
          case 'win_streak': {
            const n = badge.trigger_value ?? 0;
            earned = n > 0 && results.length >= n && results.slice(0, n).every(Boolean);
            break;
          }
          case 'placement_done':
            earned = placementCounts[i] >= 10;
            break;
        }

        if (earned) {
          inserts.push({ player_id: pid, badge_id: badge.id, match_id: matchId });
          ownedSet.add(`${pid}:${badge.id}`);
        }
      }
    }

    if (inserts.length > 0) {
      await supabase
        .from('player_badges')
        .upsert(inserts, { onConflict: 'player_id,badge_id', ignoreDuplicates: true });
    }
  } catch {
    // Badge awarding is best-effort — never block match approval.
  }
}

/**
 * Recompute and cache season ranks (1 = highest ELO) after stats change.
 * Only active players are ranked, matching the leaderboard view.
 */
export async function recomputeSeasonRanks(seasonId: string): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from('player_season_stats')
      .select('player_id, elo, players!inner(status)')
      .eq('season_id', seasonId)
      .eq('players.status', 'active')
      .order('elo', { ascending: false });

    if (!rows) return;

    await Promise.all(
      rows.map((r, i) =>
        supabase
          .from('player_season_stats')
          .update({ rank: i + 1 })
          .eq('player_id', r.player_id)
          .eq('season_id', seasonId),
      ),
    );
  } catch {
    // Rank caching is best-effort.
  }
}
