'use client';

import { useEffect, useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/modern-side-bar';
import {
  ClipboardCheck, Check, X, AlertTriangle, Pencil, Loader2, Trophy, Calendar,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlayerRef {
  id: string;
  first_name: string;
  last_name: string;
}

interface PendingMatch {
  id: string;
  submitted_at: string;
  winning_team: 1 | 2 | null;
  score_team1: number | null;
  score_team2: number | null;
  notes: string | null;
  status: string;
  team1_player1: PlayerRef;
  team1_player2: PlayerRef;
  team2_player1: PlayerRef;
  team2_player2: PlayerRef;
  tournament: { id: string; name: string; is_casual: boolean; affects_elo: boolean } | null;
}

interface EditState {
  scoreTeam1: string;
  scoreTeam2: string;
  winningTeam: 1 | 2;
  notes: string;
}

const playerName = (p: PlayerRef) => `${p.first_name} ${p.last_name}`;

export default function AdminApprovalsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [matches, setMatches] = useState<PendingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  const refresh = async () => {
    const res = await fetch('/api/matches/pending');
    if (res.ok) setMatches(await res.json());
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }
    (async () => {
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoaded, isAdmin, router]);

  const startEdit = (m: PendingMatch) => {
    setEditingId(m.id);
    setEdit({
      scoreTeam1: m.score_team1?.toString() ?? '',
      scoreTeam2: m.score_team2?.toString() ?? '',
      winningTeam: m.winning_team ?? 1,
      notes: m.notes ?? '',
    });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };

  const saveEdit = async (id: string) => {
    if (!edit) return;
    setBusyId(id);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        winningTeam: edit.winningTeam,
        notes: edit.notes,
      };
      if (edit.scoreTeam1 !== '') body.scoreTeam1 = Number(edit.scoreTeam1);
      if (edit.scoreTeam2 !== '') body.scoreTeam2 = Number(edit.scoreTeam2);

      const res = await fetch(`/api/matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to update match');
        return;
      }
      setMatches(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
      cancelEdit();
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${id}/approve`, { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to approve match');
        return;
      }
      if (data.deltas && data.newElos) {
        setResultMsg(prev => ({ ...prev, [id]: `Approved — ELO updated (Δ ${data.deltas.map((d: number) => (d >= 0 ? `+${d}` : d)).join(', ')})` }));
      } else {
        setResultMsg(prev => ({ ...prev, [id]: 'Approved — no ELO impact' }));
      }
      setMatches(prev => prev.filter(m => m.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const handleDispute = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${id}/dispute`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: edit?.notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to dispute match');
        return;
      }
      setMatches(prev => prev.filter(m => m.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: edit?.notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to cancel match');
        return;
      }
      setMatches(prev => prev.filter(m => m.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoaded || (isLoaded && !isAdmin)) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName  = user?.firstName ?? '';
  const lastName   = user?.lastName  ?? '';
  const initials   = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const displayName = `${firstName} ${lastName}`.trim() || 'Admin';

  return (
    <div className="flex h-screen bg-[#f5f4f0] overflow-hidden">
      <Sidebar
        playerName={displayName}
        playerInitials={initials}
        playerRole="Admin"
        onSignOut={() => signOut(() => router.push('/'))}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="ml-14 md:ml-0">
            <h1 className="text-xl font-bold text-[#0a0a0a]">Approve Scores</h1>
            <p className="text-sm text-gray-400 mt-0.5">Review pending match submissions and approve, edit, or dispute results.</p>
          </div>
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <ClipboardCheck className="w-3.5 h-3.5" />
            {matches.length} pending
          </span>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {loading ? (
              <div className="px-4 py-16 text-center">
                <div className="w-6 h-6 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : matches.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <ClipboardCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No pending scores to review.</p>
              </div>
            ) : (
              matches.map(m => {
                const isEditing = editingId === m.id;
                const isBusy = busyId === m.id;
                return (
                  <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {m.tournament ? (
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            {m.tournament.name}
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
                            Regular Season
                          </span>
                        )}
                        {m.tournament && !m.tournament.affects_elo && (
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-gray-50 text-gray-400 border-gray-200">
                            No ELO Impact
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(m.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Teams + score */}
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center mb-3">
                      <div
                        className="rounded-xl border px-4 py-3 text-center"
                        style={{
                          borderColor: (isEditing ? edit?.winningTeam : m.winning_team) === 1 ? '#FFB81C' : '#f0f0f0',
                          backgroundColor: (isEditing ? edit?.winningTeam : m.winning_team) === 1 ? 'rgba(255,184,28,0.08)' : 'transparent',
                        }}
                      >
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Team 1</p>
                        <p className="font-medium text-gray-900 text-sm">{playerName(m.team1_player1)}</p>
                        <p className="font-medium text-gray-900 text-sm">{playerName(m.team1_player2)}</p>
                      </div>

                      <div className="text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              value={edit?.scoreTeam1 ?? ''}
                              onChange={e => setEdit(s => s && { ...s, scoreTeam1: e.target.value })}
                              className="w-14 text-center px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
                            />
                            <span className="text-gray-300">–</span>
                            <input
                              type="number"
                              min={0}
                              value={edit?.scoreTeam2 ?? ''}
                              onChange={e => setEdit(s => s && { ...s, scoreTeam2: e.target.value })}
                              className="w-14 text-center px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
                            />
                          </div>
                        ) : (
                          <p className="text-2xl font-bold text-gray-900 px-3">
                            {m.score_team1 ?? '–'} <span className="text-gray-300">:</span> {m.score_team2 ?? '–'}
                          </p>
                        )}
                      </div>

                      <div
                        className="rounded-xl border px-4 py-3 text-center"
                        style={{
                          borderColor: (isEditing ? edit?.winningTeam : m.winning_team) === 2 ? '#FFB81C' : '#f0f0f0',
                          backgroundColor: (isEditing ? edit?.winningTeam : m.winning_team) === 2 ? 'rgba(255,184,28,0.08)' : 'transparent',
                        }}
                      >
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Team 2</p>
                        <p className="font-medium text-gray-900 text-sm">{playerName(m.team2_player1)}</p>
                        <p className="font-medium text-gray-900 text-sm">{playerName(m.team2_player2)}</p>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Winner</label>
                        <div className="flex gap-2">
                          {([1, 2] as const).map(team => (
                            <button
                              key={team}
                              type="button"
                              onClick={() => setEdit(s => s && { ...s, winningTeam: team })}
                              className="flex-1 text-xs px-3 py-2 rounded-lg border transition-all duration-200"
                              style={{
                                borderColor: edit?.winningTeam === team ? '#FFB81C' : '#e5e5e5',
                                color: edit?.winningTeam === team ? '#FFB81C' : '#888',
                                backgroundColor: edit?.winningTeam === team ? 'rgba(255,184,28,0.08)' : 'transparent',
                              }}
                            >
                              Team {team}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isEditing ? (
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Notes</label>
                        <textarea
                          value={edit?.notes ?? ''}
                          onChange={e => setEdit(s => s && { ...s, notes: e.target.value })}
                          rows={2}
                          placeholder="Optional notes (also used as the reason if disputing/cancelling)"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] resize-none"
                        />
                      </div>
                    ) : m.notes ? (
                      <p className="text-sm text-gray-500 mb-3 italic">&ldquo;{m.notes}&rdquo;</p>
                    ) : null}

                    {resultMsg[m.id] && (
                      <p className="text-xs text-green-600 mb-2">{resultMsg[m.id]}</p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(m.id)}
                            disabled={isBusy}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 disabled:opacity-60"
                            style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}
                          >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Save Changes
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isBusy}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApprove(m.id)}
                            disabled={isBusy}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60"
                          >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button
                            onClick={() => startEdit(m)}
                            disabled={isBusy}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-[#FFB81C] hover:text-[#FFB81C] transition-colors flex items-center gap-1.5 disabled:opacity-60"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDispute(m.id)}
                            disabled={isBusy}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Dispute
                          </button>
                          <button
                            onClick={() => handleCancel(m.id)}
                            disabled={isBusy}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5 disabled:opacity-60 ml-auto"
                          >
                            <X className="w-3.5 h-3.5" />
                            Cancel Match
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
