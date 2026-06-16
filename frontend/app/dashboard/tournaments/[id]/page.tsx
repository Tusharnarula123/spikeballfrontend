'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { Trophy, Loader2, Check, X, Swords, ChevronRight } from 'lucide-react';
import { useApi } from '@/hooks/use-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerRef {
  id: string;
  first_name: string;
  last_name: string;
}

interface BracketMatch {
  id: string;
  bracket_round: number;
  bracket_slot: number;
  status: 'pending' | 'approved' | 'disputed' | 'cancelled';
  winning_team: 1 | 2 | null;
  score_team1: number | null;
  score_team2: number | null;
  team1_player1: PlayerRef;
  team1_player2: PlayerRef;
  team2_player1: PlayerRef;
  team2_player2: PlayerRef;
}

interface BracketRound {
  round: number;
  matches: BracketMatch[];
}

interface Tournament {
  id: string;
  name: string;
  status: string;
  affects_elo: boolean;
}

interface BracketData {
  tournament: Tournament;
  rounds: BracketRound[];
}

interface Me {
  id: string;
  first_name: string;
  last_name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const name = (p: PlayerRef) => `${p.first_name} ${p.last_name}`;
const teamName = (p1: PlayerRef, p2: PlayerRef) => `${p1.first_name} & ${p2.first_name}`;

function getRoundLabel(round: number, totalRounds: number): string {
  const finals = totalRounds;
  const semis  = totalRounds - 1;
  const quarters = totalRounds - 2;

  if (round === finals)     return 'Final';
  if (round === finals + 1) return '3rd Place';
  if (round === semis)      return 'Semi-finals';
  if (round === quarters)   return 'Quarter-finals';

  const matchCount = Math.pow(2, totalRounds - round + 1);
  return `Round of ${matchCount}`;
}

// ─── Score Submit Modal ───────────────────────────────────────────────────────

interface SubmitModalProps {
  match: BracketMatch;
  myId: string;
  tournamentId: string;
  onClose: () => void;
  onSuccess: () => void;
  fetchApi: (path: string, init?: RequestInit) => Promise<Response>;
}

function SubmitModal({ match, myId, tournamentId, onClose, onSuccess, fetchApi }: SubmitModalProps) {
  const [winningTeam, setWinningTeam] = useState<1 | 2>(1);
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [notes, setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const team1 = teamName(match.team1_player1, match.team1_player2);
  const team2 = teamName(match.team2_player1, match.team2_player2);
  const myTeam = [match.team1_player1.id, match.team1_player2.id].includes(myId) ? 1 : 2;

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        team1Player1Id: match.team1_player1.id,
        team1Player2Id: match.team1_player2.id,
        team2Player1Id: match.team2_player1.id,
        team2Player2Id: match.team2_player2.id,
        winningTeam,
        tournamentId,
      };
      if (score1 !== '') body.scoreTeam1 = Number(score1);
      if (score2 !== '') body.scoreTeam2 = Number(score2);
      if (notes)         body.notes = notes;

      const res = await fetchApi('/api/matches', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? 'Failed to submit'); return; }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <Swords className="w-5 h-5 text-[#FFB81C]" />
          <h2 className="text-lg font-bold text-gray-900">Submit Match Score</h2>
        </div>

        {/* Teams */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {([1, 2] as const).map(t => (
            <div
              key={t}
              onClick={() => setWinningTeam(t)}
              className="cursor-pointer rounded-xl border-2 p-3 transition-all"
              style={{
                borderColor: winningTeam === t ? '#FFB81C' : '#e5e7eb',
                backgroundColor: winningTeam === t ? 'rgba(255,184,28,0.06)' : 'transparent',
              }}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                {t === myTeam ? 'Your Team' : 'Opponents'}
                {winningTeam === t && (
                  <span className="ml-1.5 text-[#FFB81C]">✓ Winner</span>
                )}
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {t === 1 ? team1 : team2}
              </p>
            </div>
          ))}
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              {team1} score
            </label>
            <input
              type="number" min={0} value={score1}
              onChange={e => setScore1(e.target.value)}
              placeholder="21"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              {team2} score
            </label>
            <input
              type="number" min={0} value={score2}
              onChange={e => setScore2(e.target.value)}
              placeholder="18"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
            />
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            Notes <span className="text-gray-400 font-normal normal-case">(optional)</span>
          </label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Anything an admin should know…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        <button
          onClick={handleSubmit} disabled={loading}
          className="w-full py-2.5 rounded-xl bg-[#FFB81C] text-sm font-bold text-gray-900 hover:bg-[#e6a418] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Submit for Approval
        </button>
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: BracketMatch;
  myId: string | null;
  onSubmit: (m: BracketMatch) => void;
}

function MatchCard({ match, myId, onSubmit }: MatchCardProps) {
  const myIds = myId ? [match.team1_player1.id, match.team1_player2.id,
                        match.team2_player1.id, match.team2_player2.id] : [];
  const isMyMatch = myId ? myIds.includes(myId) : false;
  const canSubmit = isMyMatch && match.status === 'pending';
  const approved  = match.status === 'approved';

  const t1Won = approved && match.winning_team === 1;
  const t2Won = approved && match.winning_team === 2;

  return (
    <div
      className={`rounded-xl border shadow-sm bg-white overflow-hidden w-[200px] transition-all ${
        isMyMatch ? 'border-[#FFB81C]/60 ring-1 ring-[#FFB81C]/30' : 'border-gray-100'
      }`}
    >
      {/* Team 1 */}
      <div className={`px-3 py-2 flex items-center justify-between gap-2 ${t1Won ? 'bg-green-50' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {t1Won && <ChevronRight className="w-3 h-3 text-green-500 flex-shrink-0" />}
          <span className={`text-xs font-medium truncate ${t1Won ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>
            {teamName(match.team1_player1, match.team1_player2)}
          </span>
        </div>
        {approved && match.score_team1 != null && (
          <span className={`text-xs font-bold flex-shrink-0 ${t1Won ? 'text-green-700' : 'text-gray-400'}`}>
            {match.score_team1}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 mx-3" />

      {/* Team 2 */}
      <div className={`px-3 py-2 flex items-center justify-between gap-2 ${t2Won ? 'bg-green-50' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {t2Won && <ChevronRight className="w-3 h-3 text-green-500 flex-shrink-0" />}
          <span className={`text-xs font-medium truncate ${t2Won ? 'text-green-700 font-semibold' : 'text-gray-700'}`}>
            {teamName(match.team2_player1, match.team2_player2)}
          </span>
        </div>
        {approved && match.score_team2 != null && (
          <span className={`text-xs font-bold flex-shrink-0 ${t2Won ? 'text-green-700' : 'text-gray-400'}`}>
            {match.score_team2}
          </span>
        )}
      </div>

      {/* Submit button for user's pending match */}
      {canSubmit && (
        <div className="px-3 pb-2.5 pt-1.5">
          <button
            onClick={() => onSubmit(match)}
            className="w-full text-xs py-1.5 rounded-lg bg-[#FFB81C] text-gray-900 font-bold hover:bg-[#e6a418] transition-colors flex items-center justify-center gap-1"
          >
            <Swords className="w-3 h-3" />
            Submit Score
          </button>
        </div>
      )}

      {match.status === 'pending' && !canSubmit && (
        <div className="px-3 pb-2 pt-1">
          <span className="text-[10px] text-gray-400">Pending</span>
        </div>
      )}
    </div>
  );
}

// ─── Bracket Column ───────────────────────────────────────────────────────────

function BracketColumn({
  label, matches, myId, onSubmit,
}: {
  label: string;
  matches: BracketMatch[];
  myId: string | null;
  onSubmit: (m: BracketMatch) => void;
}) {
  return (
    <div className="flex flex-col items-start min-w-[220px]">
      <p className="text-sm font-semibold text-gray-500 mb-4 text-center w-full">{label}</p>
      <div className="flex flex-col gap-6 w-full items-center">
        {matches.map(m => (
          <MatchCard key={m.id} match={m} myId={myId} onSubmit={onSubmit} />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentBracketPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded: userLoaded } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [me, setMe]           = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalMatch, setModalMatch] = useState<BracketMatch | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userLoaded || !authLoaded) return;
    try {
      const [bracketRes, meRes] = await Promise.all([
        fetchApi(`/api/tournaments/${id}/bracket`),
        fetchApi('/api/players/me'),
      ]);
      if (bracketRes.ok) setBracket(await bracketRes.json());
      if (meRes.ok)      setMe(await meRes.json());
    } finally {
      setLoading(false);
    }
  }, [userLoaded, authLoaded, fetchApi, id]);

  useEffect(() => { load(); }, [load]);

  const handleSuccess = () => {
    setModalMatch(null);
    setSuccessMsg('Match submitted! Awaiting admin approval.');
    load(); // refresh bracket
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const tournament = bracket?.tournament;
  const rounds = bracket?.rounds ?? [];

  // Separate 3rd-place round (if round number > max standard round)
  const maxRound = rounds.length > 0 ? Math.max(...rounds.map(r => r.round)) : 0;
  // A 3rd-place match sits at the same level as the Final but separate
  const standardRounds = rounds.filter(r => r.matches.length > 1 || r.round < maxRound);
  const finalRound     = rounds.find(r => r.round === maxRound && r.matches.length === 1 &&
    r.matches[0].bracket_slot === 0);
  const thirdRound     = rounds.find(r => r.round === maxRound && r.matches.some(m => m.bracket_slot === 1));

  const totalStdRounds = maxRound;

  return (
    <DashboardShell
      title={tournament?.name ?? 'Tournament Bracket'}
      subtitle={tournament ? `${tournament.affects_elo ? 'Ranked' : 'Casual'} tournament bracket` : ''}
      loading={!userLoaded || !authLoaded || loading}
      displayName={me ? `${me.first_name} ${me.last_name}` : undefined}
      width="full"
      headerRight={
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-[#FFB81C]/10 text-[#b38200] border border-[#FFB81C]/30">
          <Trophy className="w-3.5 h-3.5" />
          {tournament?.status?.replace('_', ' ')}
        </span>
      }
    >
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <Check className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {rounds.length === 0 && !loading && (
        <div className="text-center py-20 text-gray-400">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No bracket matches yet.</p>
          <p className="text-xs mt-1">An admin will generate the bracket once teams are formed.</p>
        </div>
      )}

      {rounds.length > 0 && (
        <div className="overflow-x-auto pb-6">
          <div className="flex gap-10 items-start min-w-max px-2">
            {/* Standard rounds (R16, QF, SF…) */}
            {standardRounds.map(r => (
              <BracketColumn
                key={r.round}
                label={getRoundLabel(r.round, totalStdRounds)}
                matches={r.matches}
                myId={me?.id ?? null}
                onSubmit={setModalMatch}
              />
            ))}

            {/* Final + 3rd place stacked */}
            {(finalRound || thirdRound) && (
              <div className="flex flex-col gap-10">
                {finalRound && (
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-4 text-center">
                      🏆 Final
                    </p>
                    <div className="flex flex-col gap-6 items-center">
                      {finalRound.matches.filter(m => m.bracket_slot === 0).map(m => (
                        <MatchCard key={m.id} match={m} myId={me?.id ?? null} onSubmit={setModalMatch} />
                      ))}
                    </div>
                  </div>
                )}
                {thirdRound && (
                  <div>
                    <p className="text-sm font-semibold text-gray-500 mb-4 text-center">
                      🥉 3rd Place
                    </p>
                    <div className="flex flex-col gap-6 items-center">
                      {thirdRound.matches.filter(m => m.bracket_slot === 1).map(m => (
                        <MatchCard key={m.id} match={m} myId={me?.id ?? null} onSubmit={setModalMatch} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      {me && rounds.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          <span className="inline-block w-2.5 h-2.5 rounded-sm border border-[#FFB81C] bg-[#FFB81C]/10 mr-1.5 align-middle" />
          Highlighted matches include you. Click <strong>Submit Score</strong> on a pending match to report the result.
        </p>
      )}

      {/* Modal */}
      {modalMatch && me && (
        <SubmitModal
          match={modalMatch}
          myId={me.id}
          tournamentId={id}
          onClose={() => setModalMatch(null)}
          onSuccess={handleSuccess}
          fetchApi={fetchApi}
        />
      )}
    </DashboardShell>
  );
}
