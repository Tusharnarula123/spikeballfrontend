'use client';

import { useEffect, useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/modern-side-bar';
import { Trophy, X as XIcon, Clock, AlertTriangle } from 'lucide-react';

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

interface Season {
  id: string;
  name: string;
  is_active: boolean;
}

export default function MatchHistoryPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [matches, setMatches]     = useState<MatchEntry[]>([]);
  const [seasons, setSeasons]     = useState<Season[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [scope, setScope]         = useState<'season' | 'all'>('season');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    const load = async () => {
      try {
        const [activeRes, seasonsRes] = await Promise.all([
          fetch('/api/seasons/active'),
          fetch('/api/seasons'),
        ]);

        let activeId: string | null = null;
        if (activeRes.ok) {
          const active = await activeRes.json();
          activeId = active?.id ?? null;
          setActiveSeasonId(activeId);
        }
        if (seasonsRes.ok) {
          setSeasons(await seasonsRes.json());
        }

        const url = activeId ? `/api/matches/me?seasonId=${activeId}` : '/api/matches/me';
        const matchesRes = await fetch(url);
        if (matchesRes.ok) setMatches(await matchesRes.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isLoaded]);

  const handleScopeChange = async (next: 'season' | 'all') => {
    setScope(next);
    setLoading(true);
    try {
      const url = next === 'season' && activeSeasonId
        ? `/api/matches/me?seasonId=${activeSeasonId}`
        : '/api/matches/me';
      const res = await fetch(url);
      if (res.ok) setMatches(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const seasonName = (id: string) => seasons.find(s => s.id === id)?.name ?? 'Unknown Season';

  const firstName  = user?.firstName ?? '';
  const lastName   = user?.lastName  ?? '';
  const initials   = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const displayName = `${firstName} ${lastName}`.trim() || 'Player';

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f5f4f0] overflow-hidden">
      <Sidebar
        playerName={displayName}
        playerInitials={initials}
        playerRole="Player"
        onSignOut={() => signOut(() => router.push('/'))}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="ml-14 md:ml-0">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Match History</h1>
            <p className="text-sm text-gray-400 mt-0.5">Every match you've played, win or lose.</p>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">

              {/* Filter header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                <div>
                  <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#FFB81C' }}>
                    {scope === 'season' ? 'Current Season' : 'All Time'}
                  </p>
                  <h2 className="text-xl font-bold text-gray-900">Recent Matches</h2>
                </div>
                <div className="flex gap-2">
                  {([
                    { key: 'season', label: 'This Season' },
                    { key: 'all',    label: 'All Seasons' },
                  ] as const).map(f => (
                    <button
                      key={f.key}
                      onClick={() => handleScopeChange(f.key)}
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
              </div>

              {/* List */}
              {loading ? (
                <div className="px-4 py-16 text-center">
                  <div className="w-6 h-6 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : matches.length === 0 ? (
                <div className="px-4 py-16 text-center text-sm text-gray-400">
                  No matches yet — submit a score to start building your history!
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {matches.map((m) => (
                    <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#fffbf0] transition-colors">

                      {/* Result badge */}
                      <div className="flex-shrink-0 w-16">
                        {m.status === 'approved' ? (
                          <span
                            className="inline-flex items-center justify-center w-12 h-7 rounded-lg text-xs font-bold"
                            style={{
                              backgroundColor: m.result === 'win' ? 'rgba(34,197,94,0.1)' : 'rgba(248,113,113,0.1)',
                              color: m.result === 'win' ? '#16a34a' : '#ef4444',
                            }}
                          >
                            {m.result === 'win' ? 'WIN' : 'LOSS'}
                          </span>
                        ) : m.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        ) : m.status === 'disputed' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                            <AlertTriangle className="w-3 h-3" /> Disputed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                            <XIcon className="w-3 h-3" /> Cancelled
                          </span>
                        )}
                      </div>

                      {/* Matchup */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="flex items-center gap-1.5 font-semibold text-gray-900 truncate">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0"
                              style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
                              YOU
                            </span>
                            <span className="truncate">& {m.partner.name}</span>
                          </div>
                          <span className="text-gray-300 flex-shrink-0">vs</span>
                          <div className="text-gray-500 truncate">
                            {m.opponents.map(o => o.name).join(' & ')}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(m.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}
                          {seasonName(m.season_id)}
                        </p>
                      </div>

                      {/* Score */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {m.myScore}<span className="text-gray-300 mx-0.5">–</span>{m.opponentScore}
                        </p>
                        {m.eloChange !== null && (
                          <p className={`text-xs font-semibold mt-0.5 ${m.eloChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {m.eloChange >= 0 ? '+' : ''}{m.eloChange} ELO
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!loading && matches.length > 0 && (
              <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[#FFB81C]" />
                Showing your {matches.length} most recent {scope === 'season' ? 'matches this season' : 'matches'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
