'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { EloLineChart } from '@/components/ui/elo-line-chart';
import { WinLossDonut } from '@/components/ui/win-loss-donut';
import { TrendingUp, TrendingDown, Users, BarChart3 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useApi } from '@/hooks/use-api';

interface MatchEntry {
  id: string;
  season_id: string;
  status: 'pending' | 'approved' | 'cancelled' | 'disputed';
  submitted_at: string;
  result: 'win' | 'loss' | null;
  myScore: number;
  opponentScore: number;
  eloChange: number | null;
  partner: { id: string; name: string };
  opponents: { id: string; name: string }[];
}

interface EloPoint {
  match_id: string;
  elo_before: number;
  elo_change: number;
  elo_after: number;
  recorded_at: string;
  season_id: string;
}

interface Season {
  id: string;
  name: string;
  is_active: boolean;
  start_date: string;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: 'up' | 'down' }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-1 shadow-sm">
      <p className="text-gray-400 text-xs uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-bold ${accent === 'up' ? 'text-green-600' : accent === 'down' ? 'text-red-500' : 'text-gray-900'}`}>
        {value}
      </p>
      {sub && <p className="text-gray-400 text-xs">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { isLoaded: userLoaded } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [matches, setMatches]       = useState<MatchEntry[]>([]);
  const [eloHistory, setEloHistory] = useState<EloPoint[]>([]);
  const [seasons, setSeasons]       = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [scope, setScope]           = useState<'season' | 'all'>('season');
  const [teammateId, setTeammateId] = useState<string>('all');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;

    const load = async () => {
      try {
        const [activeRes, seasonsRes, eloRes, matchesRes] = await Promise.all([
          apiFetch('/api/seasons/active'),
          apiFetch('/api/seasons'),
          fetchApi('/api/players/me/elo-history'),
          fetchApi('/api/matches/me'),
        ]);

        if (activeRes.ok) {
          const active = await activeRes.json();
          setActiveSeasonId(active?.id ?? null);
        }
        if (seasonsRes.ok) setSeasons(await seasonsRes.json());
        if (eloRes.ok) setEloHistory(await eloRes.json());
        if (matchesRes.ok) setMatches(await matchesRes.json());
      } catch {
        // silently fail — page still renders with whatever loaded
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userLoaded, authLoaded, fetchApi]);

  // Only approved matches count toward win/loss + ELO stats
  const approvedMatches = useMemo(() => matches.filter((m) => m.status === 'approved'), [matches]);

  // Unique teammates with aggregate record (across all seasons, all matches)
  const teammates = useMemo(() => {
    const map = new Map<string, { id: string; name: string; wins: number; losses: number; matches: number }>();
    for (const m of approvedMatches) {
      const p = m.partner;
      if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name, wins: 0, losses: 0, matches: 0 });
      const entry = map.get(p.id)!;
      entry.matches += 1;
      if (m.result === 'win') entry.wins += 1;
      else if (m.result === 'loss') entry.losses += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.matches - a.matches);
  }, [approvedMatches]);

  // Matches filtered by current scope + teammate selection
  const filteredMatches = useMemo(() => {
    return approvedMatches.filter((m) => {
      if (scope === 'season' && activeSeasonId && m.season_id !== activeSeasonId) return false;
      if (teammateId !== 'all' && m.partner.id !== teammateId) return false;
      return true;
    });
  }, [approvedMatches, scope, activeSeasonId, teammateId]);

  const wins   = filteredMatches.filter((m) => m.result === 'win').length;
  const losses = filteredMatches.filter((m) => m.result === 'loss').length;
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0.0';

  // ELO history points to plot, scoped + teammate-filtered
  const eloChartData = useMemo(() => {
    const sorted = [...eloHistory].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

    let points = sorted;
    if (teammateId !== 'all') {
      const matchIds = new Set(filteredMatches.map((m) => m.id));
      points = sorted.filter((p) => matchIds.has(p.match_id));
    } else if (scope === 'season' && activeSeasonId) {
      points = sorted.filter((p) => p.season_id === activeSeasonId);
    }

    return points.map((p) => ({ date: p.recorded_at, elo: p.elo_after }));
  }, [eloHistory, teammateId, filteredMatches, scope, activeSeasonId]);

  // Season divider markers — only meaningful for "All Seasons" + no teammate filter
  const seasonDividers = useMemo(() => {
    if (scope !== 'all' || teammateId !== 'all') return [];
    const sorted = [...eloHistory].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    const seen = new Set<string>();
    const dividers: { index: number; label: string }[] = [];
    sorted.forEach((p, i) => {
      if (!seen.has(p.season_id)) {
        seen.add(p.season_id);
        if (i > 0) {
          const season = seasons.find((s) => s.id === p.season_id);
          dividers.push({ index: i, label: season?.name ?? 'New Season' });
        }
      }
    });
    return dividers;
  }, [eloHistory, scope, teammateId, seasons]);

  const currentElo = eloChartData.length > 0 ? eloChartData[eloChartData.length - 1].elo : null;
  const eloDelta   = eloChartData.length > 1 ? eloChartData[eloChartData.length - 1].elo - eloChartData[0].elo : 0;

  const selectedTeammate = teammates.find((t) => t.id === teammateId);

  return (
    <DashboardShell
      title="Analytics"
      subtitle="Your ELO progression and match performance."
      loading={!userLoaded || !authLoaded || loading}
      width="wide"
    >
              <>
                {/* Filters */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex gap-2">
                    {([
                      { key: 'season', label: 'This Season' },
                      { key: 'all',    label: 'All Seasons' },
                    ] as const).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setScope(f.key)}
                        className="text-xs px-3 py-1 rounded-full border transition-all duration-200"
                        style={{
                          borderColor: scope === f.key ? '#FFB81C' : '#e5e5e5',
                          color: scope === f.key ? '#FFB81C' : '#888',
                          backgroundColor: scope === f.key ? 'rgba(255,184,28,0.08)' : 'transparent',
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <select
                      value={teammateId}
                      onChange={(e) => setTeammateId(e.target.value)}
                      className="text-xs border border-gray-200 rounded-full px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:border-[#FFB81C] cursor-pointer"
                    >
                      <option value="all">All Teammates</option>
                      {teammates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.wins}-{t.losses})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Current ELO" value={currentElo ?? '—'} />
                  <StatCard
                    label="ELO Change"
                    value={eloChartData.length > 1 ? `${eloDelta >= 0 ? '+' : ''}${eloDelta}` : '—'}
                    accent={eloDelta > 0 ? 'up' : eloDelta < 0 ? 'down' : undefined}
                    sub={scope === 'season' ? 'this season' : 'over period shown'}
                  />
                  <StatCard label="Record" value={`${wins} – ${losses}`} sub="Wins – Losses" />
                  <StatCard label="Win Rate" value={`${winRate}%`} sub={`${wins + losses} matches`} />
                </div>

                {/* ELO line chart */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#FFB81C' }}>
                        {teammateId !== 'all' && selectedTeammate
                          ? `With ${selectedTeammate.name}`
                          : scope === 'season' ? 'Current Season' : 'All Time'}
                      </p>
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-[#FFB81C]" />
                        ELO Progression
                      </h2>
                    </div>
                    {eloChartData.length > 1 && (
                      <span className={`text-sm font-semibold flex items-center gap-1 ${eloDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {eloDelta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {eloDelta >= 0 ? '+' : ''}{eloDelta}
                      </span>
                    )}
                  </div>
                  <EloLineChart
                    data={eloChartData}
                    dividers={seasonDividers}
                    emptyMessage={
                      teammateId !== 'all'
                        ? `No matches played with ${selectedTeammate?.name ?? 'this teammate'} yet`
                        : 'No ELO history yet — play a match to get started!'
                    }
                  />
                </div>

                {/* Win/Loss donut + teammate breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-col items-center">
                    <div className="self-start mb-2">
                      <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#FFB81C' }}>
                        {teammateId !== 'all' && selectedTeammate
                          ? `With ${selectedTeammate.name}`
                          : scope === 'season' ? 'Current Season' : 'All Time'}
                      </p>
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-[#FFB81C]" />
                        Win / Loss Ratio
                      </h2>
                    </div>
                    <div className="py-4">
                      <WinLossDonut
                        wins={wins}
                        losses={losses}
                        size={180}
                        emptyMessage={
                          teammateId !== 'all'
                            ? `No matches with ${selectedTeammate?.name ?? 'this teammate'} yet`
                            : 'No matches yet'
                        }
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                    <div className="mb-3">
                      <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#FFB81C' }}>
                        Teammates
                      </p>
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#FFB81C]" />
                        Played With
                      </h2>
                    </div>
                    {teammates.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No partnered matches yet</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {teammates.map((t) => {
                          const tWinRate = t.matches > 0 ? Math.round((t.wins / t.matches) * 100) : 0;
                          return (
                            <button
                              key={t.id}
                              onClick={() => setTeammateId(teammateId === t.id ? 'all' : t.id)}
                              className="w-full flex items-center justify-between py-3 text-left hover:bg-[#fffbf0] -mx-1 px-1 rounded-lg transition-colors"
                              style={{
                                backgroundColor: teammateId === t.id ? 'rgba(255,184,28,0.08)' : undefined,
                              }}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
                                <p className="text-xs text-gray-400 truncate">{t.matches} matches together</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-gray-900 whitespace-nowrap">{t.wins} – {t.losses}</p>
                                <p className="text-xs text-gray-400 whitespace-nowrap">{tWinRate}% win rate</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
    </DashboardShell>
  );
}
