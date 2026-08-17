'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardShell, SectionHeading, EmptyState, Chip } from '@/components/ui/dashboard-shell';
import { Swords, Plus, Users, Calendar, Loader2, Trash2, ChevronRight, Shuffle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useApi } from '@/hooks/use-api';

interface Session {
  id: string;
  name: string;
  description: string | null;
  tournament_type: string;
  season_id: string | null;
  start_date: string;
  end_date: string | null;
  status: 'upcoming' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';
  registration_count: number;
}

interface Season { id: string; name: string; is_active: boolean }

const STATUS_LABELS: Record<Session['status'], string> = {
  upcoming: 'Upcoming',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<Session['status'], string> = {
  upcoming: 'bg-gray-50 text-gray-600 border-gray-200',
  registration_open: 'bg-green-50 text-green-700 border-green-200',
  registration_closed: 'bg-orange-50 text-orange-700 border-orange-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const emptyForm = { name: '', description: '', seasonId: '', startDate: '', endDate: '' };

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-[#FFB81C] transition-colors';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide';

export default function AdminCompetitivePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [seasons, setSeasons]   = useState<Season[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => {
    if (!isLoaded || !authLoaded) return;
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }
    const load = async () => {
      try {
        const [tRes, sRes] = await Promise.all([fetchApi('/api/tournaments'), apiFetch('/api/seasons')]);
        if (tRes.ok) {
          const all: Session[] = await tRes.json();
          setSessions((all ?? []).filter(t => t.tournament_type === 'rotating'));
        }
        if (sRes.ok) setSeasons(await sRes.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isLoaded, authLoaded, isAdmin, router, fetchApi]);

  const refresh = async () => {
    const res = await fetchApi('/api/tournaments');
    if (res.ok) {
      const all: Session[] = await res.json();
      setSessions((all ?? []).filter(t => t.tournament_type === 'rotating'));
    }
  };

  const handleCreate = async () => {
    setError(null);
    if (!form.name.trim() || !form.startDate) {
      setError('Name and start date are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetchApi('/api/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          seasonId: form.seasonId || null,
          startDate: form.startDate,
          endDate: form.endDate || null,
          // Fixed for competitive play: rotating nets, individual signup,
          // always ranked. No bracket or team-formation choice to make.
          tournamentType: 'rotating',
          teamFormation: 'random',
          isCasual: false,
          affectsElo: true,
          status: 'registration_open',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to create session');
        return;
      }
      setForm(emptyForm);
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleStatus = async (id: string, status: Session['status']) => {
    setBusyId(id);
    try {
      const res = await fetchApi(`/api/tournaments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSessions(prev => prev.map(s => (s.id === id ? { ...s, ...updated } : s)));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetchApi(`/api/tournaments/${id}`, { method: 'DELETE' });
      if (res.ok) setSessions(prev => prev.filter(s => s.id !== id));
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  return (
    <DashboardShell
      title="Competitive Sessions"
      subtitle="Players sign up individually and get new teammates on ELO-balanced nets each round."
      loading={!isLoaded || !authLoaded || loading}
      width="wide"
    >
      {/* ── Create ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <SectionHeading icon={<Plus className="w-4 h-4 text-[#FFB81C]" />} title="New Session" />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-600 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Thursday Night Competitive"
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Optional — details for players signing up"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>End Date</label>
            <input
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Season</label>
            <select
              value={form.seasonId}
              onChange={e => setForm(f => ({ ...f, seasonId: e.target.value }))}
              className={inputCls}
            >
              <option value="">Active season</option>
              {seasons.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (active)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stacks on mobile — side by side there's no room for the helper
            text and button both, and the button label was wrapping. */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t border-gray-50">
          <p className="text-xs text-gray-400">
            Ranked · rotating nets · players sign up individually
          </p>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-black transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 w-full sm:w-auto flex-shrink-0"
            style={{ backgroundColor: '#FFB81C' }}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Session
          </button>
        </div>
      </div>

      {/* ── List ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <SectionHeading
          icon={<Swords className="w-4 h-4 text-[#FFB81C]" />}
          title="Sessions"
          right={<span className="text-xs text-gray-400">{sessions.length}</span>}
        />

        {sessions.length === 0 ? (
          <EmptyState icon={<Swords className="w-8 h-8" />} message="No competitive sessions yet — create one above." />
        ) : (
          <div className="divide-y divide-gray-50">
            {sessions.map(s => (
              <div key={s.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                      <Chip className={STATUS_STYLES[s.status]}>{STATUS_LABELS[s.status]}</Chip>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {fmt(s.start_date)}{s.end_date ? ` – ${fmt(s.end_date)}` : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {s.registration_count} registered
                      </span>
                    </div>
                    {s.description && <p className="text-xs text-gray-400 mt-1.5">{s.description}</p>}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={s.status}
                      onChange={e => handleStatus(s.id, e.target.value as Session['status'])}
                      disabled={busyId === s.id}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:border-[#FFB81C] cursor-pointer disabled:opacity-50"
                    >
                      {(Object.keys(STATUS_LABELS) as Session['status'][]).map(k => (
                        <option key={k} value={k}>{STATUS_LABELS[k]}</option>
                      ))}
                    </select>

                    {confirmId === s.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={busyId === s.id}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {busyId === s.id ? '…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmId(s.id)}
                        title="Delete session"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <Link
                  href={`/dashboard/competitive/${s.id}`}
                  className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold text-[#FFB81C] hover:underline"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Manage rounds &amp; generate nets
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
