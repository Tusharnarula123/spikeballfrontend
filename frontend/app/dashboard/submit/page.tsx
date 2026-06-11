'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/modern-side-bar';
import {
  Swords, Trophy, Loader2, Check, Users,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  current_elo: number;
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  affects_elo: boolean;
}

interface MyRegistration {
  registrationId: string;
  tournament: Tournament;
  teamId: string | null;
  partner: { id: string; first_name: string; last_name: string } | null;
}

const fullName = (p: Player | { id: string; first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;

export default function SubmitScorePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [me, setMe] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeTournamentRegs, setActiveTournamentRegs] = useState<MyRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const [tournamentId, setTournamentId] = useState<string>(''); // '' = regular season match
  const [partnerId, setPartnerId] = useState('');
  const [opponent1Id, setOpponent1Id] = useState('');
  const [opponent2Id, setOpponent2Id] = useState('');
  const [winningTeam, setWinningTeam] = useState<1 | 2>(1);
  const [scoreTeam1, setScoreTeam1] = useState('');
  const [scoreTeam2, setScoreTeam2] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const load = async () => {
      try {
        const [meRes, playersRes, regsRes] = await Promise.all([
          fetch('/api/players/me'),
          fetch('/api/players?excludeSelf=true'),
          fetch('/api/tournaments/me'),
        ]);
        if (meRes.ok) setMe(await meRes.json());
        if (playersRes.ok) setPlayers(await playersRes.json());
        if (regsRes.ok) {
          const regs: MyRegistration[] = await regsRes.json();
          setActiveTournamentRegs(
            regs.filter(r => r.tournament.status === 'in_progress' && r.teamId && r.partner),
          );
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isLoaded]);

  const selectedTournamentReg = useMemo(
    () => activeTournamentRegs.find(r => r.tournament.id === tournamentId) ?? null,
    [activeTournamentRegs, tournamentId],
  );

  // When switching to a tournament match, lock the partner to the assigned teammate
  useEffect(() => {
    if (selectedTournamentReg?.partner) {
      setPartnerId(selectedTournamentReg.partner.id);
    } else {
      setPartnerId('');
    }
  }, [selectedTournamentReg]);

  const usedIds = useMemo(() => new Set([me?.id, partnerId, opponent1Id, opponent2Id].filter(Boolean)), [me, partnerId, opponent1Id, opponent2Id]);

  const availableFor = (current: string) => players.filter(p => p.id === current || !usedIds.has(p.id));

  const resetForm = () => {
    setOpponent1Id('');
    setOpponent2Id('');
    setScoreTeam1('');
    setScoreTeam2('');
    setNotes('');
    setWinningTeam(1);
    if (!selectedTournamentReg) setPartnerId('');
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!me) {
      setError('Could not load your player profile.');
      return;
    }
    if (!partnerId || !opponent1Id || !opponent2Id) {
      setError('Please select all 4 players.');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        team1Player1Id: me.id,
        team1Player2Id: partnerId,
        team2Player1Id: opponent1Id,
        team2Player2Id: opponent2Id,
        winningTeam,
        notes: notes || undefined,
      };
      if (scoreTeam1 !== '') body.scoreTeam1 = Number(scoreTeam1);
      if (scoreTeam2 !== '') body.scoreTeam2 = Number(scoreTeam2);
      if (tournamentId) body.tournamentId = tournamentId;

      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit match');
        return;
      }
      setSuccess('Match submitted! It will appear once an admin approves it.');
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName  = user?.firstName ?? '';
  const lastName   = user?.lastName  ?? '';
  const initials   = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const displayName = me ? fullName(me) : `${firstName} ${lastName}`.trim() || 'Player';

  return (
    <div className="flex h-screen bg-[#f5f4f0] overflow-hidden">
      <Sidebar
        playerName={displayName}
        playerInitials={initials}
        playerRole="Active Player"
        onSignOut={() => signOut(() => router.push('/'))}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="ml-14 md:ml-0">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Submit Score</h1>
            <p className="text-sm text-gray-400 mt-0.5">Submit a match result for admin approval.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

            {/* ── Match Type ── */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Swords className="w-5 h-5 text-[#FFB81C]" />
                <h2 className="text-lg font-bold text-gray-900">Match Type</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTournamentId('')}
                  className="text-sm px-4 py-2 rounded-lg border transition-all duration-200 flex items-center gap-1.5"
                  style={{
                    borderColor: tournamentId === '' ? '#FFB81C' : '#e5e5e5',
                    color: tournamentId === '' ? '#FFB81C' : '#888',
                    backgroundColor: tournamentId === '' ? 'rgba(255,184,28,0.08)' : 'transparent',
                  }}
                >
                  <Users className="w-3.5 h-3.5" />
                  Regular Season
                </button>

                {activeTournamentRegs.map(r => (
                  <button
                    key={r.tournament.id}
                    type="button"
                    onClick={() => setTournamentId(r.tournament.id)}
                    className="text-sm px-4 py-2 rounded-lg border transition-all duration-200 flex items-center gap-1.5"
                    style={{
                      borderColor: tournamentId === r.tournament.id ? '#FFB81C' : '#e5e5e5',
                      color: tournamentId === r.tournament.id ? '#FFB81C' : '#888',
                      backgroundColor: tournamentId === r.tournament.id ? 'rgba(255,184,28,0.08)' : 'transparent',
                    }}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    {r.tournament.name}
                  </button>
                ))}
              </div>

              {selectedTournamentReg && !selectedTournamentReg.tournament.affects_elo && (
                <p className="text-xs text-gray-400 mt-3">
                  This is a casual tournament — results from this match won&apos;t affect ELO.
                </p>
              )}
              {activeTournamentRegs.length === 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  You&apos;re not currently on a team in any live tournament.
                </p>
              )}
            </section>

            {/* ── Players ── */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Players</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Team</p>
                  <div className="space-y-2">
                    <div className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500">
                      {me ? fullName(me) : '—'} <span className="text-xs text-gray-400">(you)</span>
                    </div>
                    {selectedTournamentReg ? (
                      <div className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500">
                        {selectedTournamentReg.partner ? fullName(selectedTournamentReg.partner) : '—'} <span className="text-xs text-gray-400">(teammate)</span>
                      </div>
                    ) : (
                      <select
                        value={partnerId}
                        onChange={e => setPartnerId(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent"
                      >
                        <option value="">Select your partner</option>
                        {availableFor(partnerId).map(p => (
                          <option key={p.id} value={p.id}>{fullName(p)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Opponents</p>
                  <div className="space-y-2">
                    <select
                      value={opponent1Id}
                      onChange={e => setOpponent1Id(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent"
                    >
                      <option value="">Select opponent 1</option>
                      {availableFor(opponent1Id).map(p => (
                        <option key={p.id} value={p.id}>{fullName(p)}</option>
                      ))}
                    </select>
                    <select
                      value={opponent2Id}
                      onChange={e => setOpponent2Id(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent"
                    >
                      <option value="">Select opponent 2</option>
                      {availableFor(opponent2Id).map(p => (
                        <option key={p.id} value={p.id}>{fullName(p)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Result ── */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Result</h2>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Winning Team</label>
                <div className="flex gap-2">
                  {([1, 2] as const).map(team => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setWinningTeam(team)}
                      className="flex-1 text-sm px-3 py-2.5 rounded-lg border transition-all duration-200"
                      style={{
                        borderColor: winningTeam === team ? '#FFB81C' : '#e5e5e5',
                        color: winningTeam === team ? '#FFB81C' : '#888',
                        backgroundColor: winningTeam === team ? 'rgba(255,184,28,0.08)' : 'transparent',
                      }}
                    >
                      {team === 1 ? 'Your Team' : 'Opponents'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Your Score <span className="text-gray-400 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={scoreTeam1}
                    onChange={e => setScoreTeam1(e.target.value)}
                    placeholder="21"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Opponent Score <span className="text-gray-400 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={scoreTeam2}
                    onChange={e => setScoreTeam2(e.target.value)}
                    placeholder="18"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Notes <span className="text-gray-400 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Anything an admin should know about this match"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent resize-none"
                />
              </div>
            </section>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <Check className="w-4 h-4" />
                {success}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full px-5 py-3 bg-[#FFB81C] rounded-lg text-sm font-bold text-[#0a0a0a] hover:bg-[#e6a418] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              Submit Match
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
