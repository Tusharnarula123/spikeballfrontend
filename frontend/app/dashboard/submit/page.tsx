'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { DashboardShell, Chip } from '@/components/ui/dashboard-shell';
import {
  Swords, Trophy, Loader2, Check, Users, ChevronRight, ChevronLeft, X,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';

// ─── Types ────────────────────────────────────────────────────────────────────

const PLACEMENT_MATCHES = 5;

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  current_elo: number;
  placement_matches_played?: number;
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  affects_elo: boolean;
  tournament_type?: 'bracket' | 'round_robin';
}

interface BracketMatch {
  id: string;
  bracket_round: number | null;
  bracket_slot: number | null;
  rr_pool: number | null;
  _poolLabel?: string; // injected client-side for RR pool matches
  status: 'pending' | 'approved' | 'disputed' | 'cancelled';
  winning_team: 1 | 2 | null;
  score_team1: number | null;
  score_team2: number | null;
  team1_player1: { id: string; first_name: string; last_name: string };
  team1_player2: { id: string; first_name: string; last_name: string };
  team2_player1: { id: string; first_name: string; last_name: string };
  team2_player2: { id: string; first_name: string; last_name: string };
}

interface MyRegistration {
  registrationId: string;
  tournament: Tournament;
  teamId: string | null;
  partner: { id: string; name: string } | null;
}

type Step = 'tournament' | 'match' | 'score' | 'regular';

const fn = (p: { id: string; first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;
const teamLabel = (a: { first_name: string }, b: { first_name: string }) => `${a.first_name} & ${b.first_name}`;

function roundLabel(round: number, total: number): string {
  if (round === total)     return 'Final';
  if (round === total + 1) return '3rd Place';
  if (round === total - 1) return 'Semi-finals';
  if (round === total - 2) return 'Quarter-finals';
  return `Round of ${Math.pow(2, total - round + 1)}`;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepBar({ step }: { step: Step }) {
  const steps = [
    { key: 'tournament', label: 'Tournament' },
    { key: 'match',      label: 'Select Match' },
    { key: 'score',      label: 'Submit Score' },
  ];
  const regularSteps = [
    { key: 'regular', label: 'Players' },
    { key: 'score',   label: 'Submit Score' },
  ];

  const active = step === 'regular' ? regularSteps : steps;
  const currentIdx = active.findIndex(s => s.key === step);

  return (
    <div className="flex items-center gap-0 mb-6">
      {active.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                i <= currentIdx
                  ? 'bg-[#FFB81C] border-[#FFB81C] text-[#0a0a0a]'
                  : 'bg-transparent border-gray-200 text-gray-400'
              }`}
            >
              {i < currentIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i <= currentIdx ? 'text-gray-700' : 'text-gray-400'}`}>
              {s.label}
            </span>
          </div>
          {i < active.length - 1 && (
            <div className={`flex-1 h-px mx-3 ${i < currentIdx ? 'bg-[#FFB81C]' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubmitScorePage() {
  const { isLoaded: userLoaded } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [me, setMe] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [regs, setRegs] = useState<MyRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  // Step state
  const [step, setStep] = useState<Step>('tournament');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [selectedReg, setSelectedReg] = useState<MyRegistration | null>(null);
  const [bracketMatches, setBracketMatches] = useState<BracketMatch[]>([]);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<BracketMatch | null>(null);

  // Regular-season player form
  const [partnerId, setPartnerId] = useState('');
  const [opponent1Id, setOpponent1Id] = useState('');
  const [opponent2Id, setOpponent2Id] = useState('');

  // Score form (shared)
  const [winningTeam, setWinningTeam] = useState<1 | 2>(1);
  const [scoreTeam1, setScoreTeam1] = useState('');
  const [scoreTeam2, setScoreTeam2] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;
    const load = async () => {
      try {
        const [meRes, playersRes, regsRes] = await Promise.all([
          fetchApi('/api/players/me'),
          fetchApi('/api/players?excludeSelf=true'),
          fetchApi('/api/tournaments/me'),
        ]);
        if (meRes.ok) setMe(await meRes.json());
        if (playersRes.ok) setPlayers(await playersRes.json());
        if (regsRes.ok) {
          const all: MyRegistration[] = await regsRes.json();
          setRegs(all.filter(r => r.tournament.status === 'in_progress'));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userLoaded, authLoaded, fetchApi]);

  // Load matches for selected tournament (works for both bracket and RR)
  const loadBracket = useCallback(async (tournamentId: string) => {
    setBracketLoading(true);
    try {
      const res = await fetchApi(`/api/tournaments/${tournamentId}/bracket`);
      if (res.ok) {
        const data = await res.json();
        // Bracket rounds (or RR finals at round 99)
        const fromRounds: BracketMatch[] = (data.rounds ?? []).flatMap(
          (r: { matches: BracketMatch[] }) => r.matches,
        );
        // RR pool matches — inject _poolLabel for display
        const fromPools: BracketMatch[] = (data.pools ?? []).flatMap(
          (p: { label: string; matches: BracketMatch[] }) =>
            p.matches.map((m: BracketMatch) => ({ ...m, _poolLabel: p.label })),
        );
        setBracketMatches([...fromRounds, ...fromPools]);
        // Persist tournament_type onto the selectedTournament so Step 2 can use it
        if (data.tournament?.tournament_type) {
          setSelectedTournament(prev => prev ? { ...prev, tournament_type: data.tournament.tournament_type } : prev);
        }
      }
    } finally {
      setBracketLoading(false);
    }
  }, [fetchApi]);

  // My matches in the selected tournament (only pending ones I'm in)
  const myTournamentMatches = useMemo(() => {
    if (!me || !selectedTournament) return [];
    return bracketMatches.filter(m =>
      m.status === 'pending' &&
      [m.team1_player1.id, m.team1_player2.id, m.team2_player1.id, m.team2_player2.id].includes(me.id),
    );
  }, [bracketMatches, me, selectedTournament]);

  const usedIds = useMemo(
    () => new Set([me?.id, partnerId, opponent1Id, opponent2Id].filter(Boolean)),
    [me, partnerId, opponent1Id, opponent2Id],
  );
  const availableFor = (current: string) => players.filter(p => p.id === current || !usedIds.has(p.id));

  const resetScore = () => {
    setWinningTeam(1);
    setScoreTeam1('');
    setScoreTeam2('');
    setNotes('');
    setError(null);
    setSuccess(null);
  };

  const handleSelectTournament = async (t: Tournament) => {
    const reg = regs.find(r => r.tournament.id === t.id) ?? null;
    setSelectedTournament(t);
    setSelectedReg(reg);
    setSelectedMatch(null);
    setBracketMatches([]);
    resetScore();
    await loadBracket(t.id);
    setStep('match');
  };

  const handleSelectMatch = (m: BracketMatch) => {
    setSelectedMatch(m);
    resetScore();
    setStep('score');
  };

  const handleSelectRegular = () => {
    setSelectedTournament(null);
    setSelectedReg(null);
    setSelectedMatch(null);
    setPartnerId('');
    setOpponent1Id('');
    setOpponent2Id('');
    resetScore();
    setStep('regular');
  };

  const handleSubmit = async () => {
    setError(null);
    if (!me) { setError('Could not load your player profile.'); return; }

    let body: Record<string, unknown>;

    if (step === 'score' && selectedMatch) {
      // Tournament match — players pre-filled from bracket
      body = {
        team1Player1Id: selectedMatch.team1_player1.id,
        team1Player2Id: selectedMatch.team1_player2.id,
        team2Player1Id: selectedMatch.team2_player1.id,
        team2Player2Id: selectedMatch.team2_player2.id,
        winningTeam,
        tournamentId: selectedTournament!.id,
      };
    } else {
      // Regular season
      if (!partnerId || !opponent1Id || !opponent2Id) {
        setError('Please select all 4 players.');
        return;
      }
      body = {
        team1Player1Id: me.id,
        team1Player2Id: partnerId,
        team2Player1Id: opponent1Id,
        team2Player2Id: opponent2Id,
        winningTeam,
      };
    }

    if (scoreTeam1 !== '') body.scoreTeam1 = Number(scoreTeam1);
    if (scoreTeam2 !== '') body.scoreTeam2 = Number(scoreTeam2);
    if (notes) body.notes = notes;

    setSubmitting(true);
    try {
      const res = await fetchApi('/api/matches', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'Failed to submit match'); return; }
      setSuccess('Match submitted! It will count once an admin approves it.');
      // Reset to step 1
      setTimeout(() => {
        setStep('tournament');
        setSelectedTournament(null);
        setSelectedReg(null);
        setSelectedMatch(null);
        setPartnerId('');
        setOpponent1Id('');
        setOpponent2Id('');
        resetScore();
      }, 2500);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Team labels for score form ──
  const scoreTeam1Label = selectedMatch
    ? teamLabel(selectedMatch.team1_player1, selectedMatch.team1_player2)
    : me ? `${me.first_name} & ${players.find(p => p.id === partnerId)?.first_name ?? 'Partner'}` : 'Your Team';

  const scoreTeam2Label = selectedMatch
    ? teamLabel(selectedMatch.team2_player1, selectedMatch.team2_player2)
    : `${players.find(p => p.id === opponent1Id)?.first_name ?? 'Opp 1'} & ${players.find(p => p.id === opponent2Id)?.first_name ?? 'Opp 2'}`;

  const myTeamInMatch = selectedMatch && me
    ? ([selectedMatch.team1_player1.id, selectedMatch.team1_player2.id].includes(me.id) ? 1 : 2)
    : 1;

  return (
    <DashboardShell
      title="Submit Score"
      subtitle="Report a match result for admin approval."
      loading={!userLoaded || !authLoaded || loading}
      displayName={me ? `${me.first_name} ${me.last_name}` : undefined}
      roleLabel="Active Player"
      width="narrow"
      headerRight={
        me ? (
          (me.placement_matches_played ?? 0) < PLACEMENT_MATCHES ? (
            <Chip className="bg-amber-50 text-amber-700 border-amber-200 font-semibold">
              <Trophy className="w-3.5 h-3.5" />
              {me.placement_matches_played ?? 0}/{PLACEMENT_MATCHES} placements
            </Chip>
          ) : (
            <Chip className="bg-amber-50 text-amber-700 border-amber-200 font-semibold">
              <Trophy className="w-3.5 h-3.5" />
              {me.current_elo} ELO
            </Chip>
          )
        ) : undefined
      }
    >
      {success ? (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-5 py-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p>{success}</p>
        </div>
      ) : (
        <>
          <StepBar step={step} />

          {/* ── STEP 1: Choose tournament ── */}
          {step === 'tournament' && (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Select Tournament</h2>
              <p className="text-sm text-gray-400 mb-5">Pick a tournament you&apos;re registered in, or submit a regular season match.</p>

              <div className="space-y-2">
                {/* Regular season option */}
                <button
                  onClick={handleSelectRegular}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-[#FFB81C]/60 hover:bg-[#FFB81C]/5 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gray-100 group-hover:bg-[#FFB81C]/10 flex items-center justify-center transition-colors flex-shrink-0">
                    <Users className="w-5 h-5 text-gray-400 group-hover:text-[#FFB81C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-700 text-sm">Regular Season Match</p>
                    <p className="text-xs text-gray-400">Pick any 4 players — affects ELO</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FFB81C] flex-shrink-0" />
                </button>

                {/* Tournament options */}
                {regs.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">
                    You&apos;re not in any live tournaments right now.
                  </p>
                )}
                {regs.map(r => (
                  <button
                    key={r.tournament.id}
                    onClick={() => handleSelectTournament(r.tournament)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-[#FFB81C]/60 hover:bg-[#FFB81C]/5 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#FFB81C]/10 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-5 h-5 text-[#FFB81C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{r.tournament.name}</p>
                      <p className="text-xs text-gray-400">
                        {r.tournament.affects_elo ? 'Ranked' : 'Casual'}
                        {r.partner ? ` · Partner: ${r.partner.name}` : ' · No team yet'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FFB81C] flex-shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── STEP 2 (regular): Player selection ── */}
          {step === 'regular' && (
            <>
              <button onClick={() => setStep('tournament')}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Select Players</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Your Team</p>
                    <div className="space-y-2">
                      <div className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500">
                        {me ? fn(me) : '—'} <span className="text-xs text-gray-400">(you)</span>
                      </div>
                      <select value={partnerId} onChange={e => setPartnerId(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB81C]">
                        <option value="">Select your partner</option>
                        {availableFor(partnerId).map(p => (
                          <option key={p.id} value={p.id}>{fn(p)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Opponents</p>
                    <div className="space-y-2">
                      <select value={opponent1Id} onChange={e => setOpponent1Id(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB81C]">
                        <option value="">Select opponent 1</option>
                        {availableFor(opponent1Id).map(p => (
                          <option key={p.id} value={p.id}>{fn(p)}</option>
                        ))}
                      </select>
                      <select value={opponent2Id} onChange={e => setOpponent2Id(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB81C]">
                        <option value="">Select opponent 2</option>
                        {availableFor(opponent2Id).map(p => (
                          <option key={p.id} value={p.id}>{fn(p)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { resetScore(); setStep('score'); }}
                  disabled={!partnerId || !opponent1Id || !opponent2Id}
                  className="mt-5 w-full py-2.5 rounded-xl bg-[#FFB81C] text-sm font-bold text-gray-900 hover:bg-[#e6a418] transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue to Score <ChevronRight className="w-4 h-4" />
                </button>
              </section>
            </>
          )}

          {/* ── STEP 2 (tournament): Match selection ── */}
          {step === 'match' && selectedTournament && (
            <>
              <button onClick={() => setStep('tournament')}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-[#FFB81C]" />
                  <h2 className="text-lg font-bold text-gray-900">{selectedTournament.name}</h2>
                </div>
                <p className="text-sm text-gray-400 mb-5">Select the match you want to report a result for.</p>

                {bracketLoading && (
                  <div className="py-10 flex justify-center">
                    <Loader2 className="w-6 h-6 text-[#FFB81C] animate-spin" />
                  </div>
                )}

                {!bracketLoading && myTournamentMatches.length === 0 && (
                  <div className="text-center py-8">
                    <Swords className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No pending matches for you in this tournament.</p>
                    <p className="text-xs text-gray-300 mt-1">Your matches may already be submitted or not yet scheduled.</p>
                  </div>
                )}

                {!bracketLoading && myTournamentMatches.length > 0 && (
                  <div className="space-y-2">
                    {myTournamentMatches.map(m => {
                      const isRRMatch = m._poolLabel != null;
                      const maxBracketRound = bracketMatches
                        .filter(x => x.bracket_round !== null && x.bracket_round !== 99)
                        .map(x => x.bracket_round as number);
                      const maxRound = maxBracketRound.length > 0 ? Math.max(...maxBracketRound) : 1;
                      const label = isRRMatch
                        ? `Pool ${m._poolLabel}`
                        : m.bracket_round === 99
                          ? 'Finals'
                          : roundLabel(m.bracket_round as number, maxRound);
                      const t1 = teamLabel(m.team1_player1, m.team1_player2);
                      const t2 = teamLabel(m.team2_player1, m.team2_player2);
                      const myTeam = me && [m.team1_player1.id, m.team1_player2.id].includes(me.id) ? 1 : 2;

                      return (
                        <button
                          key={m.id}
                          onClick={() => handleSelectMatch(m)}
                          className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#FFB81C]/20 bg-[#FFB81C]/5 hover:border-[#FFB81C]/60 hover:bg-[#FFB81C]/10 transition-all text-left group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-[#FFB81C] uppercase tracking-widest mb-1">{label}</p>
                            <div className="space-y-0.5">
                              <p className={`text-sm font-semibold ${myTeam === 1 ? 'text-gray-900' : 'text-gray-500'}`}>
                                {myTeam === 1 && <span className="text-[#FFB81C] mr-1">★</span>}{t1}
                              </p>
                              <p className="text-xs text-gray-400">vs</p>
                              <p className={`text-sm font-semibold ${myTeam === 2 ? 'text-gray-900' : 'text-gray-500'}`}>
                                {myTeam === 2 && <span className="text-[#FFB81C] mr-1">★</span>}{t2}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[#FFB81C]/40 group-hover:text-[#FFB81C] flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* ── STEP 3: Score form ── */}
          {step === 'score' && (
            <>
              <button
                onClick={() => setStep(selectedTournament ? 'match' : 'regular')}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              {/* Match summary card */}
              <div className="bg-[#FFB81C]/5 border border-[#FFB81C]/20 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    {selectedTournament && (
                      <p className="text-[10px] font-bold text-[#FFB81C] uppercase tracking-widest mb-1">
                        {selectedTournament.name}
                      </p>
                    )}
                    <p className="text-sm font-bold text-gray-800">{scoreTeam1Label}</p>
                    <p className="text-xs text-gray-400 my-0.5">vs</p>
                    <p className="text-sm font-bold text-gray-800">{scoreTeam2Label}</p>
                  </div>
                  <button onClick={() => setStep('tournament')} className="text-gray-300 hover:text-gray-500 transition-colors p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
                <h2 className="text-lg font-bold text-gray-900">Match Result</h2>

                {/* Winner */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Winning Team</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([1, 2] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setWinningTeam(t)}
                        className="py-3 px-3 rounded-xl border-2 text-sm font-semibold text-center transition-all"
                        style={{
                          borderColor: winningTeam === t ? '#FFB81C' : '#e5e7eb',
                          color: winningTeam === t ? '#FFB81C' : '#9ca3af',
                          backgroundColor: winningTeam === t ? 'rgba(255,184,28,0.07)' : 'transparent',
                        }}
                      >
                        {t === myTeamInMatch ? '★ Your Team' : 'Opponents'}
                        {winningTeam === t && <span className="ml-1 text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      {scoreTeam1Label.split(' & ')[0]}&apos;s team score
                      <span className="text-gray-400 ml-1 normal-case font-normal">(optional)</span>
                    </label>
                    <input type="number" min={0} value={scoreTeam1}
                      onChange={e => setScoreTeam1(e.target.value)} placeholder="21"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      {scoreTeam2Label.split(' & ')[0]}&apos;s team score
                      <span className="text-gray-400 ml-1 normal-case font-normal">(optional)</span>
                    </label>
                    <input type="number" min={0} value={scoreTeam2}
                      onChange={e => setScoreTeam2(e.target.value)} placeholder="18"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Notes <span className="text-gray-400 normal-case font-normal">(optional)</span>
                  </label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                    placeholder="Anything the admin should know…"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-[#FFB81C] text-sm font-bold text-gray-900 hover:bg-[#e6a418] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    : <><Swords className="w-4 h-4" /> Submit for Admin Approval</>}
                </button>
              </section>
            </>
          )}
        </>
      )}
    </DashboardShell>
  );
}
