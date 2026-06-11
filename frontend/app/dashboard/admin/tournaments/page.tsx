'use client';

import { useEffect, useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/modern-side-bar';
import {
  Trophy, Plus, Users, Shuffle, Calendar, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  is_casual: boolean;
  affects_elo: boolean;
  team_formation: 'random' | 'self_select';
  season_id: string | null;
  start_date: string;
  end_date: string | null;
  status: 'upcoming' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled';
  registration_count: number;
}

interface Season {
  id: string;
  name: string;
  is_active: boolean;
}

interface RegistrationRow {
  id: string;
  registered_at: string;
  preferred_partner_id: string | null;
  team_id: string | null;
  player: { id: string; first_name: string; last_name: string; email: string; age: number; gender: string; university: string | null; current_elo: number };
  preferred_partner: { id: string; first_name: string; last_name: string } | null;
  team: { id: string; player1_id: string; player2_id: string } | null;
}

const STATUS_LABELS: Record<Tournament['status'], string> = {
  upcoming: 'Upcoming',
  registration_open: 'Registration Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<Tournament['status'], string> = {
  upcoming: 'bg-gray-50 text-gray-600 border-gray-200',
  registration_open: 'bg-green-50 text-green-700 border-green-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const emptyForm = {
  name: '',
  description: '',
  isCasual: false,
  affectsElo: true,
  teamFormation: 'random' as 'random' | 'self_select',
  seasonId: '',
  startDate: '',
  endDate: '',
};

export default function AdminTournamentsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [formTeamsMsg, setFormTeamsMsg] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }

    const load = async () => {
      try {
        const [tRes, sRes] = await Promise.all([
          fetch('/api/tournaments'),
          fetch('/api/seasons'),
        ]);
        if (tRes.ok) setTournaments(await tRes.json());
        if (sRes.ok) setSeasons(await sRes.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isLoaded, isAdmin, router]);

  const refreshTournaments = async () => {
    const res = await fetch('/api/tournaments');
    if (res.ok) setTournaments(await res.json());
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!form.name.trim() || !form.startDate) {
      setCreateError('Name and start date are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          isCasual: form.isCasual,
          affectsElo: form.affectsElo,
          teamFormation: form.teamFormation,
          seasonId: form.seasonId || null,
          startDate: form.startDate,
          endDate: form.endDate || null,
          status: 'registration_open',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.error ?? 'Failed to create tournament');
        return;
      }
      setForm(emptyForm);
      await refreshTournaments();
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id: string, status: Tournament['status']) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/tournaments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTournaments(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
      }
    } finally {
      setBusyId(null);
    }
  };

  const toggleRegistrations = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setRegsLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/registrations`);
      setRegistrations(res.ok ? await res.json() : []);
    } finally {
      setRegsLoading(false);
    }
  };

  const handleFormTeams = async (id: string) => {
    setBusyId(id);
    setFormTeamsMsg(prev => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch(`/api/tournaments/${id}/form-teams`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormTeamsMsg(prev => ({ ...prev, [id]: data.error ?? 'Failed to form teams' }));
        return;
      }
      const teams = data.teamsCreated?.length ?? 0;
      const msg = data.unpaired
        ? `Formed ${teams} team${teams === 1 ? '' : 's'}. 1 player left unpaired.`
        : `Formed ${teams} team${teams === 1 ? '' : 's'}.`;
      setFormTeamsMsg(prev => ({ ...prev, [id]: msg }));
      if (expandedId === id) {
        const regRes = await fetch(`/api/tournaments/${id}/registrations`);
        setRegistrations(regRes.ok ? await regRes.json() : []);
      }
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
            <h1 className="text-xl font-bold text-[#0a0a0a]">Tournament Management</h1>
            <p className="text-sm text-gray-400 mt-0.5">Create tournaments and manage registrations.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

            {/* ── Create Tournament ── */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="w-5 h-5 text-[#FFB81C]" />
                <h2 className="text-lg font-bold text-gray-900">Create Tournament</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Tournament Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Spring Invitational 2026"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Description <span className="text-gray-400 normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Format, prizes, rules, etc."
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    End Date <span className="text-gray-400 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Season <span className="text-gray-400 normal-case font-normal">(optional)</span>
                  </label>
                  <select
                    value={form.seasonId}
                    onChange={e => setForm(f => ({ ...f, seasonId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all"
                  >
                    <option value="">None</option>
                    {seasons.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (active)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Team Formation
                  </label>
                  <div className="flex gap-2">
                    {([
                      { key: 'random', label: 'Random', icon: Shuffle },
                      { key: 'self_select', label: 'Players Choose', icon: Users },
                    ] as const).map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, teamFormation: key }))}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2.5 rounded-lg border transition-all duration-200"
                        style={{
                          borderColor: form.teamFormation === key ? '#FFB81C' : '#e5e5e5',
                          color: form.teamFormation === key ? '#FFB81C' : '#888',
                          backgroundColor: form.teamFormation === key ? 'rgba(255,184,28,0.08)' : 'transparent',
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 pt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isCasual}
                      onChange={e => {
                        const isCasual = e.target.checked;
                        setForm(f => ({ ...f, isCasual, affectsElo: isCasual ? false : f.affectsElo }));
                      }}
                      className="w-4 h-4 rounded border-gray-300 accent-[#FFB81C]"
                    />
                    Casual tournament (just for fun)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.affectsElo}
                      onChange={e => setForm(f => ({ ...f, affectsElo: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 accent-[#FFB81C]"
                    />
                    Results affect player ELO
                  </label>
                </div>
              </div>

              {createError && (
                <p className="text-xs text-red-500 mt-3">{createError}</p>
              )}

              <button
                onClick={handleCreate}
                disabled={creating}
                className="mt-4 px-5 py-2.5 bg-[#FFB81C] rounded-lg text-sm font-bold text-[#0a0a0a] hover:bg-[#e6a418] transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create Tournament
              </button>
            </section>

            {/* ── Existing Tournaments ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-[#FFB81C]" />
                <h2 className="text-lg font-bold text-[#0a0a0a]">Tournaments</h2>
              </div>

              {loading ? (
                <div className="px-4 py-16 text-center">
                  <div className="w-6 h-6 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : tournaments.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-sm text-gray-400">
                  No tournaments created yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {tournaments.map(t => (
                    <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <h3 className="font-bold text-gray-900">{t.name}</h3>
                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[t.status]}`}>
                                {STATUS_LABELS[t.status]}
                              </span>
                              {t.is_casual && (
                                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
                                  Casual
                                </span>
                              )}
                              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                                {t.affects_elo ? 'Affects ELO' : 'No ELO Impact'}
                              </span>
                              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-200">
                                {t.team_formation === 'random' ? 'Random Teams' : 'Players Choose Teams'}
                              </span>
                            </div>
                            {t.description && (
                              <p className="text-sm text-gray-500 mb-1.5 max-w-xl">{t.description}</p>
                            )}
                            <p className="text-xs text-gray-400 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(t.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {t.end_date && ` – ${new Date(t.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                              <span className="mx-1">·</span>
                              <Users className="w-3.5 h-3.5" />
                              {t.registration_count} registered
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={t.status}
                              onChange={e => handleStatusChange(t.id, e.target.value as Tournament['status'])}
                              disabled={busyId === t.id}
                              className="text-xs border border-gray-200 rounded-full px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:border-[#FFB81C] cursor-pointer disabled:opacity-60"
                            >
                              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => toggleRegistrations(t.id)}
                              className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-[#FFB81C] hover:text-[#FFB81C] transition-colors flex items-center gap-1"
                            >
                              Registrations
                              {expandedId === t.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {expandedId === t.id && (
                          <div className="mt-4 pt-4 border-t border-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                Registered Players
                              </p>
                              <button
                                onClick={() => handleFormTeams(t.id)}
                                disabled={busyId === t.id}
                                className="text-xs px-3 py-1.5 rounded-full font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-60"
                                style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}
                              >
                                {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />}
                                Form Teams
                              </button>
                            </div>

                            {formTeamsMsg[t.id] && (
                              <p className="text-xs text-gray-500 mb-3">{formTeamsMsg[t.id]}</p>
                            )}

                            {regsLoading ? (
                              <div className="py-6 text-center">
                                <div className="w-5 h-5 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin mx-auto" />
                              </div>
                            ) : registrations.length === 0 ? (
                              <p className="text-sm text-gray-400 text-center py-4">No registrations yet.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr style={{ backgroundColor: '#0a0a0a' }}>
                                      {['Player', 'School', 'Age', 'Gender', 'ELO', 'Preferred Partner', 'Team'].map(h => (
                                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {registrations.map(r => (
                                      <tr key={r.id} className="border-t border-gray-50 hover:bg-[#fffbf0] transition-colors">
                                        <td className="px-3 py-2 font-medium text-gray-900">{r.player.first_name} {r.player.last_name}</td>
                                        <td className="px-3 py-2 text-gray-500">{r.player.university || '—'}</td>
                                        <td className="px-3 py-2 text-gray-500">{r.player.age}</td>
                                        <td className="px-3 py-2 text-gray-500 capitalize">{r.player.gender?.replace('_', ' ') || '—'}</td>
                                        <td className="px-3 py-2 font-bold" style={{ color: '#FFB81C' }}>{r.player.current_elo}</td>
                                        <td className="px-3 py-2 text-gray-500">
                                          {r.preferred_partner ? `${r.preferred_partner.first_name} ${r.preferred_partner.last_name}` : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-gray-500">
                                          {r.team_id ? <span className="text-green-600 font-medium">Assigned</span> : <span className="text-gray-300">Unassigned</span>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
