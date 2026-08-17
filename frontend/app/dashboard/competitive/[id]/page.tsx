'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { Swords, Users, Loader2, Check, Trophy, Shuffle } from 'lucide-react';
import { useApi } from '@/hooks/use-api';

interface PlayerRef { id: string; first_name: string; last_name: string }

interface NetMatch {
  id: string;
  rr_pool: number;
  rr_round: number;
  status: 'pending' | 'approved' | 'cancelled' | 'disputed';
  winning_team: 1 | 2 | null;
  score_team1: number | null;
  score_team2: number | null;
  team1_player1: PlayerRef | null;
  team1_player2: PlayerRef | null;
  team1_player3: PlayerRef | null;
  team2_player1: PlayerRef | null;
  team2_player2: PlayerRef | null;
  team2_player3: PlayerRef | null;
}

interface Session {
  id: string;
  name: string;
  description: string | null;
  status: string;
  tournament_type: string;
  registration_count: number;
}

interface Standing { id: string; name: string; wins: number; losses: number }

const name = (p: PlayerRef | null) => (p ? `${p.first_name} ${p.last_name}` : null);
const side = (...ps: (PlayerRef | null)[]) =>
  ps.map(name).filter(Boolean).join(' & ') || '—';
const teamOf = (m: NetMatch, n: 1 | 2) =>
  n === 1
    ? [m.team1_player1, m.team1_player2, m.team1_player3].filter(Boolean)
    : [m.team2_player1, m.team2_player2, m.team2_player3].filter(Boolean);

export default function CompetitiveSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoaded: userLoaded } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();
  const isAdmin = user?.publicMetadata?.role === 'admin';

  const [session, setSession]     = useState<Session | null>(null);
  const [rounds, setRounds]       = useState<{ round: number; nets: NetMatch[] }[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [roundsRes, myRes] = await Promise.all([
        fetchApi(`/api/tournaments/${id}/rounds`),
        fetchApi('/api/tournaments/me'),
      ]);
      if (roundsRes.ok) {
        const data = await roundsRes.json();
        setSession(data.tournament);
        setRounds(data.rounds ?? []);
        setStandings(data.standings ?? []);
      }
      if (myRes.ok) {
        const regs: { tournament_id: string }[] = await myRes.json();
        setRegistered((regs ?? []).some(r => r.tournament_id === id));
      }
    } finally {
      setLoading(false);
    }
  }, [fetchApi, id]);

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;
    load();
  }, [userLoaded, authLoaded, load]);

  const act = async (url: string, method: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchApi(url, { method });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error ?? d?.message ?? 'Something went wrong');
        return;
      }
      await load();
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy(false);
    }
  };

  const latestRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const roundIncomplete = !!latestRound && latestRound.nets.some(n => n.status === 'pending');

  return (
    <DashboardShell
      title={session?.name ?? 'Competitive'}
      subtitle="New teammates and a new net every round, matched on ELO."
      loading={!userLoaded || !authLoaded || loading}
      width="wide"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="w-4 h-4 text-gray-300" />
          {session?.registration_count ?? 0} registered
          {rounds.length > 0 && <span className="text-gray-300">· {rounds.length} round{rounds.length !== 1 ? 's' : ''} played</span>}
        </div>

        <div className="flex items-center gap-2">
          {/* Late signups allowed mid-session — the next round picks them up. */}
          {(session?.status === 'registration_open' || session?.status === 'in_progress') && (
            registered ? (
              <button
                onClick={() => act(`/api/tournaments/${id}/register`, 'DELETE')}
                disabled={busy}
                className="text-xs px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Leave session'}
              </button>
            ) : (
              <button
                onClick={() => act(`/api/tournaments/${id}/register`, 'POST')}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold text-black transition-all hover:scale-105 disabled:opacity-50"
                style={{ backgroundColor: '#FFB81C' }}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Sign up
              </button>
            )
          )}

          {registered && session?.status !== 'registration_open' && session?.status !== 'in_progress' && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <Check className="w-3.5 h-3.5" /> You&apos;re in
            </span>
          )}

          {isAdmin && (
            <button
              onClick={() => act(`/api/tournaments/${id}/generate-round`, 'POST')}
              disabled={busy || roundIncomplete}
              title={roundIncomplete ? 'Finish scoring the current round first' : undefined}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold border border-[#FFB81C] text-[#FFB81C] hover:bg-[#FFB81C]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />}
              Generate Round {rounds.length + 1}
            </button>
          )}
        </div>
      </div>

      {/* Rounds */}
      {rounds.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Swords className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No rounds yet.</p>
          <p className="text-xs mt-1">
            {isAdmin ? 'Generate the first round once players have signed up.' : 'Nets appear once an admin starts the session.'}
          </p>
        </div>
      ) : (
        [...rounds].reverse().map(({ round, nets }) => (
          <section key={round}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Round {round}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {nets.map((m) => {
                const sizes = [teamOf(m, 1).length, teamOf(m, 2).length];
                const uneven = sizes[0] !== sizes[1];
                return (
                  <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#FFB81C' }}>
                        Net {m.rr_pool + 1}
                      </p>
                      <div className="flex items-center gap-2">
                        {uneven && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                            {sizes[0]}v{sizes[1]}
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          m.status === 'approved' ? 'bg-green-50 text-green-700' :
                          m.status === 'pending'  ? 'bg-yellow-50 text-yellow-700' :
                                                    'bg-gray-100 text-gray-500'
                        }`}>
                          {m.status === 'approved' ? 'Final' : m.status === 'pending' ? 'Awaiting score' : m.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {([1, 2] as const).map((teamNo) => {
                        const label = side(...teamOf(m, teamNo));
                        const score = teamNo === 1 ? m.score_team1 : m.score_team2;
                        const won = m.winning_team === teamNo;
                        return (
                          <div key={teamNo} className="flex items-center justify-between gap-3">
                            <p className={`text-sm truncate ${won ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                              {label}
                            </p>
                            <span className={`text-sm font-bold flex-shrink-0 ${won ? 'text-gray-900' : 'text-gray-400'}`}>
                              {score ?? '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* Standings */}
      {standings.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <div className="mb-3">
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#FFB81C' }}>Session</p>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#FFB81C]" />
              Standings
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {standings.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-300 w-5 flex-shrink-0">{i + 1}</span>
                  <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                </div>
                <p className="text-sm font-bold text-gray-900 flex-shrink-0">{s.wins} – {s.losses}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
