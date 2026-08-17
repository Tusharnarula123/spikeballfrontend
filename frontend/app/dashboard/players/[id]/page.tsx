'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { apiFetch } from '@/lib/api';
import { useApi } from '@/hooks/use-api';
import Image from 'next/image';
import {
  ArrowLeft, TrendingUp, Star, Award, Users, Calendar,
  Trophy, CheckCircle, Clock, ChevronDown, Swords,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Badge {
  badge_id: string;
  awarded_at: string;
  tournament_id?: string | null;
  badges: { name: string; icon_name: string | null; icon_url: string | null; description: string };
  tournament?: { id: string; name: string } | null;
}

interface PlayerProfile {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  age: number | null;
  university: string | null;
  bio: string | null;
  avatar_url: string | null;
  current_elo: number;
  peak_elo: number;
  rank: number | null;
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
  placement_matches_played: number;
  is_ranked: boolean;
  member_since: string;
  badges: Badge[];
}

interface MatchEntry {
  id: string;
  date: string | null;
  status: string;
  tournament: { id: string; name: string } | null;
  partner: { id: string; first_name: string; last_name: string; avatar_url: string | null } | null;
  opponents: { id: string; first_name: string; last_name: string; avatar_url: string | null }[];
  won: boolean;
  score_for: number | null;
  score_against: number | null;
  games: { team1: number; team2: number }[] | null;
}

interface H2HResult {
  player: { id: string; first_name: string; last_name: string; avatar_url: string | null; current_elo: number };
  other: { id: string; first_name: string; last_name: string; avatar_url: string | null; current_elo: number };
  wins: number;
  losses: number;
  total_matches: number;
  matches: { id: string; date: string | null; tournament: { id: string; name: string } | null; winner: string; score_player: number | null; score_against: number | null }[];
}

interface Season {
  id: string;
  name: string;
  is_active: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_ELO = 1200;

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
};

function Avatar({ url, name, size = 80 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  if (url) {
    return (
      <div className="rounded-full overflow-hidden ring-4 ring-white shadow-lg flex-shrink-0" style={{ width: size, height: size }}>
        <Image src={url} alt={name} width={size} height={size} className="object-cover w-full h-full" />
      </div>
    );
  }
  return (
    <div className="rounded-full bg-gradient-to-br from-[#841617] to-[#a01a1b] ring-4 ring-white shadow-lg flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <span className="text-white font-bold" style={{ fontSize: size * 0.3 }}>{initials}</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col gap-1 shadow-sm text-center">
      <p className="text-gray-400 text-xs uppercase tracking-widest">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-gray-400 text-xs">{sub}</p>}
    </div>
  );
}

function BadgeShelf({ badges }: { badges: Badge[] }) {
  if (!badges || badges.length === 0) return (
    <p className="text-gray-400 text-sm py-4 text-center">No badges yet</p>
  );
  return (
    <div className="flex flex-wrap gap-3">
      {badges.map((b) => (
        <div key={b.badge_id} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2" title={b.badges.description}>
          {b.badges.icon_url ? (
            <Image src={b.badges.icon_url} alt={b.badges.name} width={24} height={24} className="object-contain" />
          ) : (
            <Award className="h-5 w-5 text-amber-500" />
          )}
          <div>
            <p className="text-xs font-semibold text-amber-700">{b.badges.name}</p>
            {b.tournament && <p className="text-xs text-amber-500">{b.tournament.name}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchRow({ match, myName }: { match: MatchEntry; myName: string }) {
  const partnerName = match.partner ? `${match.partner.first_name} ${match.partner.last_name}` : '—';
  const oppNames = match.opponents.map(o => `${o.first_name} ${o.last_name}`).join(' & ') || '—';
  const dateStr = match.date ? new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${match.won ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${match.won ? 'bg-green-500' : 'bg-red-400'}`}>
        {match.won
          ? <CheckCircle className="h-4 w-4 text-white" />
          : <span className="text-white text-xs font-bold">L</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900">
            {myName} &amp; {partnerName}
          </p>
          <span className="text-xs text-gray-400 flex-shrink-0">{dateStr}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">vs {oppNames}</p>
        {match.tournament && (
          <p className="text-xs text-[#841617] mt-0.5 flex items-center gap-1">
            <Trophy className="h-3 w-3" /> {match.tournament.name}
          </p>
        )}
        {match.status === 'pending' && (
          <p className="text-xs text-amber-500 mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Awaiting approval
          </p>
        )}
      </div>
      {(match.score_for != null || match.score_against != null) && (
        <div className="flex-shrink-0 text-right">
          <p className={`font-bold text-sm ${match.won ? 'text-green-600' : 'text-red-500'}`}>
            {match.score_for ?? '?'} – {match.score_against ?? '?'}
          </p>
        </div>
      )}
    </div>
  );
}

function H2HSection({
  myPlayerId,
  viewedPlayerId,
  viewedName,
  fetchApi,
}: {
  myPlayerId: string;
  viewedPlayerId: string;
  viewedName: string;
  fetchApi: (url: string, init?: RequestInit) => Promise<Response>;
}) {
  const [data, setData] = useState<H2HResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetchApi(`/api/players/${myPlayerId}/vs/${viewedPlayerId}`);
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [myPlayerId, viewedPlayerId, fetchApi]);

  if (loading) return <div className="text-center py-8 text-gray-400 text-sm animate-pulse">Loading head-to-head...</div>;
  if (!data) return <div className="text-center py-8 text-gray-400 text-sm">Could not load h2h data</div>;
  if (data.total_matches === 0) return (
    <div className="text-center py-12">
      <Swords className="h-10 w-10 text-gray-200 mx-auto mb-3" />
      <p className="text-gray-400 text-sm">You haven't played {viewedName} yet</p>
    </div>
  );

  const myWinPct = data.total_matches > 0 ? Math.round((data.wins / data.total_matches) * 100) : 0;
  const theirWinPct = 100 - myWinPct;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <Avatar url={data.player.avatar_url} name={`${data.player.first_name} ${data.player.last_name}`} size={48} />
            <p className="text-sm font-semibold text-gray-900 mt-2">You</p>
            <p className="text-3xl font-bold text-[#841617] mt-1">{data.wins}</p>
          </div>
          <div className="text-gray-300 font-bold text-xl">VS</div>
          <div className="text-center flex-1">
            <Avatar url={data.other.avatar_url} name={`${data.other.first_name} ${data.other.last_name}`} size={48} />
            <p className="text-sm font-semibold text-gray-900 mt-2">{viewedName}</p>
            <p className="text-3xl font-bold text-gray-700 mt-1">{data.losses}</p>
          </div>
        </div>
        {/* Win bar */}
        <div className="mt-2">
          <div className="flex rounded-full overflow-hidden h-2">
            <div className="bg-[#841617] transition-all" style={{ width: `${myWinPct}%` }} />
            <div className="bg-gray-200 transition-all" style={{ width: `${theirWinPct}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>{myWinPct}% win rate</span>
            <span>{data.total_matches} match{data.total_matches !== 1 ? 'es' : ''}</span>
          </div>
        </div>
      </div>

      {/* Match list */}
      <div className="space-y-2">
        {data.matches.map(m => {
          const dateStr = m.date ? new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
          const won = m.winner === 'player';
          return (
            <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border ${won ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${won ? 'bg-green-500' : 'bg-red-400'}`}>
                  {won ? 'W' : 'L'}
                </div>
                <div>
                  <p className="text-xs text-gray-500">{dateStr}</p>
                  {m.tournament && <p className="text-xs text-[#841617]">{m.tournament.name}</p>}
                </div>
              </div>
              {(m.score_player != null || m.score_against != null) && (
                <p className={`text-sm font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>
                  {m.score_player ?? '?'} – {m.score_against ?? '?'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'stats' | 'matches' | 'vs';

export default function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('stats');
  const [profileLoading, setProfileLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

  // Load seasons
  useEffect(() => {
    apiFetch('/api/seasons').then(r => r.json()).then((data: Season[]) => {
      setSeasons(data ?? []);
      const active = (data ?? []).find(s => s.is_active);
      if (active) { setActiveSeasonId(active.id); setSelectedSeasonId(active.id); }
    }).catch(() => {});
  }, []);

  // Load my player id (for vs tab)
  useEffect(() => {
    if (!userLoaded || !authLoaded) return;
    fetchApi('/api/players/me').then(r => r.json()).then((me: { id: string }) => {
      setMyPlayerId(me?.id ?? null);
    }).catch(() => {});
  }, [userLoaded, authLoaded, fetchApi]);

  // Load profile
  const loadProfile = useCallback(async (seasonId: string | null) => {
    setProfileLoading(true);
    try {
      const params = seasonId ? `?seasonId=${seasonId}` : '';
      const res = await apiFetch(`/api/players/${id}/profile${params}`);
      if (res.ok) setProfile(await res.json());
      else setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [id]);

  useEffect(() => { loadProfile(selectedSeasonId); }, [selectedSeasonId, loadProfile]);

  // Load match history when tab is selected
  const loadMatches = useCallback(async (seasonId: string | null) => {
    setMatchesLoading(true);
    try {
      const params = seasonId ? `?seasonId=${seasonId}` : '';
      const res = await apiFetch(`/api/players/${id}/match-history${params}`);
      if (res.ok) setMatches(await res.json());
      else setMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (tab === 'matches') loadMatches(selectedSeasonId);
  }, [tab, selectedSeasonId, loadMatches]);

  const isMe = myPlayerId === id;
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : '—';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardShell title="Player Profile">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Back */}
        <button
          onClick={() => router.push('/dashboard/players')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Players
        </button>

        {/* Season filter */}
        <div className="flex items-center justify-end mb-6">
          <div className="relative">
            <select
              value={selectedSeasonId ?? ''}
              onChange={e => setSelectedSeasonId(e.target.value || null)}
              className="pl-3 pr-8 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#841617]/30 bg-white appearance-none cursor-pointer"
            >
              <option value="">All time</option>
              {seasons.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.is_active ? ' (current)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {profileLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/4" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-100 h-20" />)}
            </div>
          </div>
        ) : !profile ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Player not found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Hero card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-start gap-5">
                <Avatar url={profile.avatar_url} name={displayName} size={80} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-gray-900 truncate">{displayName}</h2>
                  {profile.university && <p className="text-gray-500 text-sm mt-0.5 truncate">{profile.university}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {profile.gender && (
                      <span className="text-gray-400 text-xs">{GENDER_LABELS[profile.gender] ?? profile.gender}</span>
                    )}
                    {profile.age && <span className="text-gray-400 text-xs">{profile.age} years old</span>}
                    <span className="text-gray-400 text-xs flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Member since {new Date(profile.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  {profile.is_ranked && profile.rank ? (
                    <div className="mt-2 inline-flex items-center gap-1 bg-[#841617]/10 text-[#841617] text-xs font-semibold px-2 py-1 rounded-lg">
                      <Star className="h-3 w-3" /> Rank #{profile.rank}
                    </div>
                  ) : (
                    <div className="mt-2 inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-xs font-semibold px-2 py-1 rounded-lg">
                      Placement {profile.placement_matches_played}/5 matches
                    </div>
                  )}
                </div>
              </div>

              {profile.bio && (
                <p className="mt-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-4 text-justify">{profile.bio}</p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Current ELO" value={profile.is_ranked ? (profile.current_elo ?? DEFAULT_ELO) : '—'} sub={!profile.is_ranked ? `${profile.placement_matches_played}/5 placements` : undefined} />
              <StatCard label="Peak ELO"    value={profile.is_ranked ? (profile.peak_elo ?? DEFAULT_ELO) : '—'} />
              <StatCard label="Win Rate"    value={profile.is_ranked ? `${Math.round(profile.win_rate)}%` : '—'} sub={profile.is_ranked ? `${profile.total_matches} matches` : undefined} />
              <StatCard label="Wins"    value={profile.wins} />
              <StatCard label="Losses"  value={profile.losses} />
              <StatCard label="Matches" value={profile.total_matches} />
            </div>

            {/* Badges */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Badges</h3>
              </div>
              <BadgeShelf badges={profile.badges ?? []} />
            </div>

            {/* Tabs */}
            <div>
              <div className="flex border-b border-gray-200 mb-4">
                {(['stats', 'matches', ...(myPlayerId && !isMe ? ['vs'] : [])] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      tab === t
                        ? 'border-[#841617] text-[#841617]'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t === 'stats' ? 'Stats' : t === 'matches' ? 'Match History' : `vs ${profile.first_name}`}
                  </button>
                ))}
              </div>

              {/* Stats tab */}
              {tab === 'stats' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#841617]" /> ELO Overview
                    </h3>
                    {(() => {
                      const unranked = !profile.is_ranked;
                      return (
                        <>
                          {unranked && (
                            <div className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                              Placement in progress — {profile.placement_matches_played}/5 matches completed
                            </div>
                          )}
                          <div className="flex items-center justify-between py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Current ELO</span>
                            <span className="font-bold text-gray-900">{unranked ? '—' : (profile.current_elo ?? DEFAULT_ELO)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Peak ELO</span>
                            <span className="font-bold text-amber-500">{unranked ? '—' : (profile.peak_elo ?? DEFAULT_ELO)}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Rank</span>
                            <span className="font-bold text-gray-900">{profile.rank ? `#${profile.rank}` : '—'}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Wins</span>
                            <span className="font-bold text-green-600">{profile.wins}</span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-gray-50">
                            <span className="text-sm text-gray-500">Losses</span>
                            <span className="font-bold text-red-500">{profile.losses}</span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-500">Win Rate</span>
                            <span className="font-bold text-gray-900">{unranked ? '—' : `${Math.round(profile.win_rate)}%`}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Match history tab */}
              {tab === 'matches' && (
                <div>
                  {matchesLoading ? (
                    <div className="space-y-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-gray-50 rounded-xl h-16 animate-pulse" />
                      ))}
                    </div>
                  ) : matches.length === 0 ? (
                    <div className="text-center py-12">
                      <Trophy className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No matches in this period</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {matches.map(m => (
                        <MatchRow key={m.id} match={m} myName={profile.first_name} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* vs You tab */}
              {tab === 'vs' && myPlayerId && !isMe && (
                <H2HSection
                  myPlayerId={myPlayerId}
                  viewedPlayerId={id}
                  viewedName={profile.first_name}
                  fetchApi={fetchApi}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
