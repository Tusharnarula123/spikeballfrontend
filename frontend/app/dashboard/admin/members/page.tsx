'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { DashboardShell, SectionHeading, Card, EmptyState, Chip } from '@/components/ui/dashboard-shell';
import {
  Users, UserCheck, Search, Loader2, Check, X, Award, Clock,
  GraduationCap, Zap, ShieldOff, RotateCcw, Medal,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useApi } from '@/hooks/use-api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  age: number | null;
  gender: string | null;
  university: string | null;
  current_elo: number;
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
  avatar_url?: string | null;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
}

interface TournamentOption {
  id: string;
  name: string;
}

const STATUS_STYLES: Record<Member['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  suspended: 'bg-red-50 text-red-600 border-red-200',
};

const fullName = (m: Member) => `${m.first_name} ${m.last_name}`;

export default function AdminMembersPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [members, setMembers] = useState<Member[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Member['status']>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Badge modal
  const [badgeTarget, setBadgeTarget] = useState<Member | null>(null);
  const [selectedBadgeId, setSelectedBadgeId] = useState('');
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [awardMsg, setAwardMsg] = useState<string | null>(null);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  const refresh = async () => {
    const res = await fetchApi('/api/players?status=all');
    if (res.ok) setMembers(await res.json());
  };

  useEffect(() => {
    if (!isLoaded || !authLoaded) return;
    if (!isAdmin) {
      router.replace('/dashboard');
      return;
    }
    (async () => {
      try {
        const [, bRes, tRes] = await Promise.all([
          refresh(),
          apiFetch('/api/badges'),
          apiFetch('/api/tournaments'),
        ]);
        if (bRes.ok) setBadges(await bRes.json());
        if (tRes.ok) setTournaments(await tRes.json());
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, authLoaded, isAdmin, router]);

  const setStatus = async (id: string, action: 'approve' | 'suspend') => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetchApi(`/api/players/${id}/${action}`, { method: 'PATCH' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed to ${action} player`);
        return;
      }
      const updated: Member = await res.json();
      setMembers(prev => prev.map(m => (m.id === id ? { ...m, status: updated.status } : m)));
    } finally {
      setBusyId(null);
    }
  };

  const handleAward = async () => {
    if (!badgeTarget || !selectedBadgeId) return;
    setAwarding(true);
    setAwardMsg(null);
    try {
      const res = await fetchApi('/api/badges/award', {
        method: 'POST',
        body: JSON.stringify({
          playerId: badgeTarget.id,
          badgeId: selectedBadgeId,
          tournamentId: selectedTournamentId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAwardMsg(data.error?.includes('duplicate')
          ? 'This player already has that badge.'
          : data.error ?? 'Failed to award badge');
        return;
      }
      setAwardMsg('Badge awarded! 🎉');
      setTimeout(() => {
        setBadgeTarget(null);
        setSelectedBadgeId('');
        setSelectedTournamentId('');
        setAwardMsg(null);
      }, 1200);
    } finally {
      setAwarding(false);
    }
  };

  const pending = useMemo(() => members.filter(m => m.status === 'pending'), [members]);

  const roster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter(m => m.status !== 'pending')
      .filter(m => statusFilter === 'all' || m.status === statusFilter)
      .filter(m => !q || fullName(m).toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [members, search, statusFilter]);

  if (isLoaded && !isAdmin) return null;

  return (
    <DashboardShell
      title="Members"
      subtitle="Approve new sign-ups, manage the roster, and award badges."
      loading={!isLoaded || loading}
      width="wide"
      headerRight={
        pending.length > 0 ? (
          <Chip className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            {pending.length} awaiting approval
          </Chip>
        ) : (
          <Chip className="bg-green-50 text-green-700 border-green-200">
            <Check className="w-3.5 h-3.5" />
            All caught up
          </Chip>
        )
      }
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Pending approvals ── */}
      <section>
        <SectionHeading icon={<UserCheck />} title="Pending Approvals" />
        {pending.length === 0 ? (
          <EmptyState icon={<UserCheck />} message="No sign-ups waiting for approval." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pending.map(m => (
              <Card key={m.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatar_url}
                        alt={fullName(m)}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#0a0a0a] text-[#FFB81C] flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {m.first_name[0]}{m.last_name[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{fullName(m)}</p>
                      <p className="text-xs text-gray-400 truncate">{m.email}</p>
                    </div>
                  </div>
                  <Chip className={STATUS_STYLES.pending}>Pending</Chip>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-4">
                  {m.age != null && <span>Age {m.age}</span>}
                  {m.gender && <span className="capitalize">{m.gender.replace(/_/g, ' ')}</span>}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Signed up {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatus(m.id, 'approve')}
                    disabled={busyId === m.id}
                    className="flex-1 text-xs font-bold px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                  <button
                    onClick={() => setStatus(m.id, 'suspend')}
                    disabled={busyId === m.id}
                    className="flex-1 text-xs font-semibold px-3 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Roster ── */}
      <section>
        <SectionHeading
          icon={<Users />}
          title="Club Roster"
          right={
            <div className="flex items-center gap-2">
              {(['all', 'active', 'suspended'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className="text-xs px-3 py-1 rounded-full border transition-all duration-200 capitalize"
                  style={{
                    borderColor: statusFilter === f ? '#FFB81C' : '#e5e5e5',
                    color: statusFilter === f ? '#FFB81C' : '#888',
                    backgroundColor: statusFilter === f ? 'rgba(255,184,28,0.08)' : 'transparent',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        />

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <div className="relative max-w-xs">
              <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#0a0a0a' }}>
                  {['Player', 'School', 'ELO', 'Status', 'Member Since', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                      No members match your filters.
                    </td>
                  </tr>
                ) : roster.map(m => (
                  <tr key={m.id} className="border-t border-gray-50 hover:bg-[#fffbf0] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatar_url}
                            alt={fullName(m)}
                            className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#0a0a0a] text-[#FFB81C] flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                            {m.first_name[0]}{m.last_name[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-xs">{fullName(m)}</p>
                          <p className="text-[11px] text-gray-400 truncate max-w-[180px]">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        {m.university ? <><GraduationCap className="w-3.5 h-3.5 text-gray-300" />{m.university}</> : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-xs" style={{ color: '#FFB81C' }}>
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{m.current_elo}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Chip className={STATUS_STYLES[m.status]}>
                        <span className="capitalize">{m.status}</span>
                      </Chip>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setBadgeTarget(m); setSelectedBadgeId(''); setSelectedTournamentId(''); setAwardMsg(null); }}
                          title="Award badge"
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-[#FFB81C] hover:text-[#FFB81C] transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                        </button>
                        {m.status === 'active' ? (
                          <button
                            onClick={() => setStatus(m.id, 'suspend')}
                            disabled={busyId === m.id}
                            title="Suspend player"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-60"
                          >
                            {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(m.id, 'approve')}
                            disabled={busyId === m.id}
                            title="Reactivate player"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-green-300 hover:text-green-600 transition-colors disabled:opacity-60"
                          >
                            {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ── Award Badge modal ── */}
      {badgeTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Medal className="w-5 h-5 text-[#FFB81C]" />
                <h2 className="text-lg font-bold text-[#0a0a0a]">Award Badge</h2>
              </div>
              <button
                onClick={() => setBadgeTarget(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-500">
                Awarding a badge to{' '}
                <span className="font-semibold text-gray-900">{fullName(badgeTarget)}</span>.
                Badges with automatic triggers are normally earned through play — manual awards are for special recognition.
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {badges.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBadgeId(b.id)}
                    className="w-full text-left px-4 py-3 rounded-xl border transition-all duration-150"
                    style={{
                      borderColor: selectedBadgeId === b.id ? '#FFB81C' : '#eee',
                      backgroundColor: selectedBadgeId === b.id ? 'rgba(255,184,28,0.08)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{b.name}</p>
                      <Chip className="bg-gray-50 text-gray-400 border-gray-200 capitalize">
                        {b.trigger_type.replace(/_/g, ' ')}
                      </Chip>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{b.description}</p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Tournament <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={selectedTournamentId}
                  onChange={e => setSelectedTournamentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all"
                >
                  <option value="">No specific tournament</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Tying this badge to a tournament lets the player see where they earned it, and lets them earn the same badge again in a future tournament.
                </p>
              </div>

              {awardMsg && (
                <p className={`text-xs ${awardMsg.includes('🎉') ? 'text-green-600' : 'text-red-500'}`}>{awardMsg}</p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setBadgeTarget(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAward}
                disabled={awarding || !selectedBadgeId}
                className="flex-1 px-4 py-2.5 bg-[#FFB81C] rounded-lg text-sm font-bold text-[#0a0a0a] hover:bg-[#e6a418] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {awarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {awarding ? 'Awarding…' : 'Award Badge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
