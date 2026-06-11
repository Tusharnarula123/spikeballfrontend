'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { DashboardShell, SectionHeading, Card, EmptyState, Chip } from '@/components/ui/dashboard-shell';
import {
  CalendarRange, Plus, Loader2, Zap, CheckCircle2, Play, AlertTriangle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  starting_elo: number;
  created_at: string;
}

const emptyForm = { name: '', startDate: '', endDate: '', startingElo: '1200' };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function AdminSeasonsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  const refresh = async () => {
    const res = await fetch('/api/seasons');
    if (res.ok) setSeasons(await res.json());
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

  const handleCreate = async () => {
    setCreateError(null);
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setCreateError('Name, start date, and end date are all required.');
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setCreateError('End date must be after the start date.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          startingElo: Number(form.startingElo) || 1200,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.error ?? 'Failed to create season');
        return;
      }
      setForm(emptyForm);
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/seasons/${id}/activate`, { method: 'PATCH' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to activate season');
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const activeSeason = seasons.find(s => s.is_active);

  if (isLoaded && !isAdmin) return null;

  return (
    <DashboardShell
      title="Seasons"
      subtitle="Create semester seasons and control which one is live."
      loading={!isLoaded || loading}
      headerRight={
        activeSeason ? (
          <Chip className="bg-green-50 text-green-700 border-green-200">
            <Play className="w-3.5 h-3.5" />
            {activeSeason.name} is live
          </Chip>
        ) : (
          <Chip className="bg-red-50 text-red-600 border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            No active season
          </Chip>
        )
      }
    >
      {!activeSeason && !loading && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            No season is currently active — match submission and the leaderboard are paused until you activate one below.
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Create Season ── */}
      <Card className="p-5">
        <SectionHeading icon={<Plus />} title="Create Season" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Season Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Fall 2026"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all"
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
              End Date
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
              Starting ELO
            </label>
            <input
              type="number"
              min={100}
              step={50}
              value={form.startingElo}
              onChange={e => setForm(f => ({ ...f, startingElo: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all"
            />
            <p className="text-xs text-gray-400 mt-1">Every player begins the season at this rating.</p>
          </div>
        </div>

        {createError && <p className="text-xs text-red-500 mt-3">{createError}</p>}

        <button
          onClick={handleCreate}
          disabled={creating}
          className="mt-4 px-5 py-2.5 bg-[#FFB81C] rounded-lg text-sm font-bold text-[#0a0a0a] hover:bg-[#e6a418] transition-colors flex items-center gap-1.5 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create Season
        </button>
      </Card>

      {/* ── All Seasons ── */}
      <section>
        <SectionHeading icon={<CalendarRange />} title="All Seasons" />
        {seasons.length === 0 ? (
          <EmptyState icon={<CalendarRange />} message="No seasons yet — create your first one above." />
        ) : (
          <div className="space-y-3">
            {seasons.map(s => (
              <Card key={s.id} className={`p-5 ${s.is_active ? 'ring-2 ring-[#FFB81C]/60' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{s.name}</h3>
                      {s.is_active ? (
                        <Chip className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </Chip>
                      ) : (
                        <Chip className="bg-gray-50 text-gray-500 border-gray-200">Inactive</Chip>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <CalendarRange className="w-3.5 h-3.5" />
                      {fmtDate(s.start_date)} – {fmtDate(s.end_date)}
                      <span className="mx-1">·</span>
                      <Zap className="w-3.5 h-3.5" />
                      Starts at {s.starting_elo} ELO
                    </p>
                  </div>

                  {!s.is_active && (
                    <button
                      onClick={() => handleActivate(s.id)}
                      disabled={busyId === s.id}
                      className="text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-60"
                      style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}
                    >
                      {busyId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Make Active
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
