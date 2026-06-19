'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { DashboardShell, SectionHeading, Card, EmptyState, Chip } from '@/components/ui/dashboard-shell';
import {
  CalendarRange, Plus, Loader2, Zap, CheckCircle2, Play,
  AlertTriangle, ChevronDown, ChevronUp, Leaf, Sun, Snowflake, Trash2,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiFetch } from '@/lib/api';

interface Semester {
  id: string;
  name: string;
  semester_type: 'summer' | 'fall' | 'spring';
  start_date: string;
  end_date: string;
  is_active: boolean;
  starting_elo: number;
}

interface Season {
  id: string;
  name: string;
  year_start: number;
  year_end: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  starting_elo: number;
  semesters: Semester[];
}

const fmtDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const SEMESTER_ICON: Record<string, React.ReactNode> = {
  summer: <Sun className="w-3.5 h-3.5 text-amber-500" />,
  fall:   <Leaf className="w-3.5 h-3.5 text-orange-500" />,
  spring: <Snowflake className="w-3.5 h-3.5 text-blue-400" />,
};

const SEMESTER_COLOR: Record<string, string> = {
  summer: 'bg-amber-50 border-amber-200 text-amber-700',
  fall:   'bg-orange-50 border-orange-200 text-orange-700',
  spring: 'bg-blue-50 border-blue-200 text-blue-600',
};

const currentYear = new Date().getFullYear();

export default function AdminSeasonsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [seasons, setSeasons]         = useState<Season[]>([]);
  const [loading, setLoading]         = useState(true);
  const [yearStart, setYearStart]     = useState(String(currentYear));
  const [startingElo, setStartingElo] = useState(process.env.NEXT_PUBLIC_DEFAULT_ELO ?? '1000');
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyId, setBusyId]           = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  const refresh = useCallback(async () => {
    const res = await apiFetch('/api/seasons');
    if (res.ok) setSeasons(await res.json());
  }, []);

  useEffect(() => {
    if (!isLoaded || !authLoaded) return;
    if (!isAdmin) { router.replace('/dashboard'); return; }
    refresh().finally(() => setLoading(false));
  }, [isLoaded, authLoaded, isAdmin, router, refresh]);

  const toggleExpanded = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleCreate = async () => {
    setCreateError(null);
    const year = Number(yearStart);
    if (!year || year < 2020 || year > 2100) {
      setCreateError('Enter a valid year (e.g. 2025).');
      return;
    }
    setCreating(true);
    try {
      const res = await fetchApi('/api/seasons', {
        method: 'POST',
        body: JSON.stringify({ yearStart: year, startingElo: Number(startingElo) || 1200 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setCreateError(data.error ?? 'Failed to create season'); return; }
      setYearStart(String(currentYear));
      setStartingElo('1200');
      setExpanded(prev => new Set(prev).add((data.season as Season).id));
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleActivateSemester = async (semId: string) => {
    setBusyId(semId);
    setError(null);
    try {
      const res = await fetchApi(`/api/seasons/semester/${semId}/activate`, { method: 'PATCH' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Failed to activate semester');
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (seasonId: string) => {
    if (confirmDeleteId !== seasonId) {
      setConfirmDeleteId(seasonId);
      return;
    }
    setDeletingId(seasonId);
    setError(null);
    try {
      const res = await fetchApi(`/api/seasons/${seasonId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Failed to delete season');
        return;
      }
      setConfirmDeleteId(null);
      await refresh();
    } finally {
      setDeletingId(null);
    }
  };

  const activeSemester = seasons.flatMap(s => s.semesters ?? []).find(s => s.is_active);

  if (isLoaded && !isAdmin) return null;

  return (
    <DashboardShell
      title="Seasons & Semesters"
      subtitle="Each season spans May–April with 3 semesters. ELO resets every semester."
      loading={!isLoaded || loading}
      headerRight={
        activeSemester ? (
          <Chip className="bg-green-50 text-green-700 border-green-200">
            <Play className="w-3.5 h-3.5" />
            {activeSemester.name} active
          </Chip>
        ) : (
          <Chip className="bg-red-50 text-red-600 border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            No active semester
          </Chip>
        )
      }
    >
      {!activeSemester && !loading && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          No semester is active — match submission and the leaderboard are paused until you activate one below.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Create */}
      <Card className="p-5">
        <SectionHeading icon={<Plus />} title="Create Season" />
        <p className="text-xs text-gray-400 mb-4">
          Enter the starting year — Summer, Fall, and Spring semesters are auto-created.
          Year <strong>{yearStart || '…'}</strong> → season <strong>{yearStart}-{Number(yearStart) + 1}</strong> (May {yearStart} – Apr {Number(yearStart) + 1}).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Start Year</label>
            <input
              type="number" min={2020} max={2100}
              value={yearStart}
              onChange={e => setYearStart(e.target.value)}
              placeholder="2025"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Starting ELO</label>
            <input
              type="number" min={100} step={50}
              value={startingElo}
              onChange={e => setStartingElo(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C]"
            />
          </div>
        </div>
        {createError && <p className="text-xs text-red-500 mt-3">{createError}</p>}
        <button
          onClick={handleCreate} disabled={creating}
          className="mt-4 px-5 py-2.5 bg-[#FFB81C] rounded-lg text-sm font-bold text-[#0a0a0a] hover:bg-[#e6a418] transition-colors flex items-center gap-1.5 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create Season
        </button>
      </Card>

      {/* List */}
      <section>
        <SectionHeading icon={<CalendarRange />} title="All Seasons" />
        {seasons.length === 0 ? (
          <EmptyState icon={<CalendarRange />} message="No seasons yet — create your first one above." />
        ) : (
          <div className="space-y-3">
            {seasons.map(s => {
              const isOpen = expanded.has(s.id);
              const sems: Semester[] = s.semesters ?? [];
              const activeSem = sems.find(sem => sem.is_active);

              return (
                <Card key={s.id} className={`p-0 overflow-hidden ${activeSem ? 'ring-2 ring-[#FFB81C]/50' : ''}`}>
                  <div className="w-full flex items-center justify-between gap-3 p-5">
                    <button
                      onClick={() => toggleExpanded(s.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left"
                    >
                      <div className="w-9 h-9 rounded-xl bg-[#FFB81C]/10 flex items-center justify-center flex-shrink-0">
                        <CalendarRange className="w-4 h-4 text-[#FFB81C]" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-gray-900">{s.name}</h3>
                          {activeSem && (
                            <Chip className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> {activeSem.name} active
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <CalendarRange className="w-3 h-3" />
                          {fmtDate(s.start_date)} – {fmtDate(s.end_date)}
                          <span className="mx-1">·</span>
                          <Zap className="w-3 h-3" /> starts at {s.starting_elo} ELO
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {confirmDeleteId === s.id ? (
                        <>
                          <span className="text-xs text-red-500 font-medium hidden sm:inline">Delete season?</span>
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId === s.id}
                            className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center gap-1"
                          >
                            {deletingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deletingId === s.id}
                            className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleDelete(s.id)}
                          title="Delete season"
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => toggleExpanded(s.id)} className="p-1">
                        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {sems.length === 0 && (
                        <p className="text-xs text-gray-400 px-5 py-3">No semesters found.</p>
                      )}
                      {sems.map(sem => (
                        <div key={sem.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${sem.is_active ? 'bg-green-50/50' : ''}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${SEMESTER_COLOR[sem.semester_type]}`}>
                              {SEMESTER_ICON[sem.semester_type]}
                              {sem.semester_type.charAt(0).toUpperCase() + sem.semester_type.slice(1)}
                            </span>
                            <span className="text-sm font-medium text-gray-700">{sem.name}</span>
                            <span className="text-xs text-gray-400 hidden sm:inline">
                              {fmtDate(sem.start_date)} – {fmtDate(sem.end_date)}
                            </span>
                          </div>
                          <div className="flex-shrink-0">
                            {sem.is_active ? (
                              <Chip className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </Chip>
                            ) : (
                              <button
                                onClick={() => handleActivateSemester(sem.id)}
                                disabled={busyId === sem.id}
                                className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 disabled:opacity-60 bg-[#FFB81C] text-gray-900 hover:bg-[#e6a418] transition-colors"
                              >
                                {busyId === sem.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                                Activate
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
