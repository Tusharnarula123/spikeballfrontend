'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { DashboardShell, SectionHeading, Card, EmptyState, Chip } from '@/components/ui/dashboard-shell';
import { Medal, Plus, Loader2, Trash2, Zap, Flame, Target, Trophy, Star, ImagePlus, X } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { apiFetch } from '@/lib/api';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon_name: string | null;
  icon_url: string | null;
  tournament_id: string | null;
  tournament: { id: string; name: string } | null;
  trigger_type: 'elo_threshold' | 'win_streak' | 'match_count' | 'placement_done' | 'manual';
  trigger_value: number | null;
}

interface TournamentOption {
  id: string;
  name: string;
}

const TRIGGER_LABEL: Record<Badge['trigger_type'], string> = {
  elo_threshold: 'ELO threshold',
  win_streak: 'Win streak',
  match_count: 'Match count',
  placement_done: 'Placement complete',
  manual: 'Manual (admin-awarded)',
};

const TRIGGER_NEEDS_VALUE = new Set(['elo_threshold', 'win_streak', 'match_count']);

const TRIGGER_ICON: Record<Badge['trigger_type'], React.ReactNode> = {
  elo_threshold: <Zap className="w-3.5 h-3.5" />,
  win_streak: <Flame className="w-3.5 h-3.5" />,
  match_count: <Target className="w-3.5 h-3.5" />,
  placement_done: <Trophy className="w-3.5 h-3.5" />,
  manual: <Star className="w-3.5 h-3.5" />,
};

export default function AdminBadgesPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [badges, setBadges] = useState<Badge[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconName, setIconName] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState('');
  const [triggerType, setTriggerType] = useState<Badge['trigger_type']>('manual');
  const [triggerValue, setTriggerValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  const refresh = useCallback(async () => {
    const [bRes, tRes] = await Promise.all([
      apiFetch('/api/badges'),
      apiFetch('/api/tournaments'),
    ]);
    if (bRes.ok) setBadges(await bRes.json());
    if (tRes.ok) setTournaments(await tRes.json());
  }, []);

  useEffect(() => {
    if (!isLoaded || !authLoaded) return;
    if (!isAdmin) { router.replace('/dashboard'); return; }
    refresh().finally(() => setLoading(false));
  }, [isLoaded, authLoaded, isAdmin, router, refresh]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setIconName('');
    setIconFile(null);
    setIconPreview(null);
    setTournamentId('');
    setTriggerType('manual');
    setTriggerValue('');
  };

  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const clearIconFile = () => {
    setIconFile(null);
    setIconPreview(null);
  };

  const handleCreate = async () => {
    setCreateError(null);
    if (!name.trim()) { setCreateError('Badge name is required.'); return; }
    if (!description.trim()) { setCreateError('Description is required.'); return; }
    if (!iconName.trim() && !iconFile) { setCreateError('Provide an icon name or upload a custom icon image.'); return; }
    if (TRIGGER_NEEDS_VALUE.has(triggerType) && !triggerValue.trim()) {
      setCreateError(`A trigger value is required for "${TRIGGER_LABEL[triggerType]}" badges.`);
      return;
    }

    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      if (iconName.trim()) formData.append('iconName', iconName.trim());
      if (tournamentId) formData.append('tournamentId', tournamentId);
      formData.append('triggerType', triggerType);
      if (triggerValue.trim()) formData.append('triggerValue', triggerValue.trim());
      if (iconFile) formData.append('icon', iconFile);

      const res = await fetchApi('/api/badges', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setCreateError(data.error ?? 'Failed to create badge'); return; }
      resetForm();
      await refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetchApi(`/api/badges/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Failed to delete badge');
        return;
      }
      setConfirmDeleteId(null);
      await refresh();
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoaded && !isAdmin) return null;

  const inputCls =
    'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all';

  return (
    <DashboardShell
      title="Badges"
      subtitle="Create badge types here, then award them to players (optionally for a specific tournament) from the Members page."
      loading={!isLoaded || loading}
      width="wide"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* ── Create ── */}
      <Card className="p-5">
        <SectionHeading icon={<Plus />} title="Create Badge" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Name</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Tournament Champion"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Icon Name <span className="text-gray-400 font-normal">(Lucide icon, e.g. crown — optional if uploading an image)</span>
            </label>
            <input
              type="text" value={iconName} onChange={e => setIconName(e.target.value)}
              placeholder="e.g. crown"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Description</label>
            <input
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Won first place in a tournament"
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Custom Icon Image <span className="text-gray-400 font-normal">(optional — overrides the Lucide icon above)</span>
            </label>
            {iconPreview ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={iconPreview} alt="Icon preview" className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
                <button
                  type="button"
                  onClick={clearIconFile}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 w-full px-3.5 py-2.5 border border-dashed border-gray-300 rounded-lg text-sm text-gray-400 cursor-pointer hover:border-[#FFB81C] hover:text-gray-600 transition-colors">
                <ImagePlus className="w-4 h-4" />
                Click to upload a sticker / icon image
                <input type="file" accept="image/*" onChange={handleIconFileChange} className="hidden" />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Tournament <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={tournamentId}
              onChange={e => setTournamentId(e.target.value)}
              className={inputCls}
            >
              <option value="">No specific tournament</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Trigger Type</label>
            <select
              value={triggerType}
              onChange={e => setTriggerType(e.target.value as Badge['trigger_type'])}
              className={inputCls}
            >
              {Object.entries(TRIGGER_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Most admin-created badges should stay <strong>Manual</strong> — automatic triggers are evaluated by the match-approval system.
            </p>
          </div>
          {TRIGGER_NEEDS_VALUE.has(triggerType) && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Trigger Value</label>
              <input
                type="number" value={triggerValue} onChange={e => setTriggerValue(e.target.value)}
                placeholder="e.g. 1500"
                className={inputCls}
              />
            </div>
          )}
        </div>
        {createError && <p className="text-xs text-red-500 mt-3">{createError}</p>}
        <button
          onClick={handleCreate} disabled={creating}
          className="mt-4 px-5 py-2.5 bg-[#FFB81C] rounded-lg text-sm font-bold text-[#0a0a0a] hover:bg-[#e6a418] transition-colors flex items-center gap-1.5 disabled:opacity-60"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create Badge
        </button>
      </Card>

      {/* ── List ── */}
      <section>
        <SectionHeading icon={<Medal />} title="All Badges" />
        {badges.length === 0 ? (
          <EmptyState icon={<Medal />} message="No badges yet — create your first one above." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {badges.map(b => (
              <Card key={b.id} className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#FFB81C]/10 flex items-center justify-center flex-shrink-0 text-[#FFB81C] overflow-hidden">
                    {b.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.icon_url} alt={b.name} className="w-full h-full object-cover" />
                    ) : (
                      TRIGGER_ICON[b.trigger_type]
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{b.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{b.description}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <Chip className="bg-gray-50 text-gray-500 border-gray-200">
                        {TRIGGER_LABEL[b.trigger_type]}
                        {b.trigger_value != null ? ` · ${b.trigger_value}` : ''}
                      </Chip>
                      {b.tournament?.name && (
                        <Chip className="bg-[#FFB81C]/10 text-[#FFB81C] border-[#FFB81C]/20">
                          {b.tournament.name}
                        </Chip>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {confirmDeleteId === b.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={deletingId === b.id}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center gap-1"
                      >
                        {deletingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deletingId === b.id}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(b.id)}
                      title="Delete badge"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
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
