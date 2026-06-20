'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { DashboardShell, SectionHeading, Card, EmptyState, Chip } from '@/components/ui/dashboard-shell';
import {
  UserPlus, Trophy, Calendar, Users, Shuffle, Loader2, Check, X, Zap, GraduationCap,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';

// ─── Types ───────────────────────────────────────────────────────────────────

const PLACEMENT_MATCHES = 5;

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  age: number;
  gender: string;
  university?: string | null;
  current_elo: number;
  placement_matches_played: number;
  status?: string;
}

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  is_casual: boolean;
  affects_elo: boolean;
  team_formation: 'random' | 'self_select';
  start_date: string;
  end_date: string | null;
  status: 'upcoming' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';
  registration_count: number;
}

interface MyRegistration {
  registrationId: string;
  registeredAt: string;
  preferredPartnerId: string | null;
  tournament: Tournament;
  teamId: string | null;
  teamName: string | null;
  partner: { id: string; name: string } | null;
  requestedPartner: { id: string; name: string } | null;
  isMutualMatch: boolean;
}

const STATUS_LABELS: Record<Tournament['status'], string> = {
  upcoming: 'Upcoming',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<Tournament['status'], string> = {
  upcoming: 'bg-gray-50 text-gray-600 border-gray-200',
  registration_open: 'bg-green-50 text-green-700 border-green-200',
  registration_closed: 'bg-orange-50 text-orange-700 border-orange-200',
  in_progress: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};

export default function RegisterPage() {
  const { isLoaded: userLoaded } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [player, setPlayer] = useState<Player | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [myRegs, setMyRegs] = useState<MyRegistration[]>([]);
  const [otherPlayers, setOtherPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerChoice, setPartnerChoice] = useState<Record<string, string>>({});
  const [teamNameChoice, setTeamNameChoice] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const [tRes, mRes] = await Promise.all([
      fetchApi('/api/tournaments?status=registration_open,registration_closed,upcoming,in_progress'),
      fetchApi('/api/tournaments/me'),
    ]);
    if (tRes.ok) setTournaments(await tRes.json());
    if (mRes.ok) setMyRegs(await mRes.json());
  };

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;

    const load = async () => {
      try {
        const [pRes, opRes] = await Promise.all([
          fetchApi('/api/players/me'),
          fetchApi('/api/players?excludeSelf=true'),
        ]);
        if (pRes.ok) setPlayer(await pRes.json());
        if (opRes.ok) setOtherPlayers(await opRes.json());
        await refresh();
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userLoaded, authLoaded, fetchApi]);

  const handleRegister = async (tournamentId: string) => {
    setBusyId(tournamentId);
    setError(null);
    try {
      const preferredPartnerId = partnerChoice[tournamentId];
      const teamName = teamNameChoice[tournamentId];
      const res = await fetchApi(`/api/tournaments/${tournamentId}/register`, {
        method: 'POST',
        body: JSON.stringify({
          preferredPartnerId: preferredPartnerId || null,
          teamName: teamName?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to register');
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleUnregister = async (tournamentId: string) => {
    setBusyId(tournamentId);
    setError(null);
    try {
      const res = await fetchApi(`/api/tournaments/${tournamentId}/register`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Failed to unregister');
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const myRegMap = new Map(myRegs.map(r => [r.tournament.id, r]));
  const displayName = player ? `${player.first_name} ${player.last_name}` : undefined;

  return (
    <DashboardShell
      title="Register for a Match"
      subtitle="View your profile info and sign up for open tournaments."
      loading={!userLoaded || !authLoaded || loading}
      displayName={displayName}
      roleLabel={player?.status === 'active' ? 'Active Player' : 'Pending Approval'}
      headerRight={
        myRegs.length > 0 ? (
          <Chip className="bg-green-50 text-green-700 border-green-200 font-semibold">
            <Check className="w-3.5 h-3.5" />
            {myRegs.length} registered
          </Chip>
        ) : undefined
      }
    >
            {/* ── Player Info ── */}
            <Card className="p-5">
              <SectionHeading icon={<UserPlus />} title="Your Info" />
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <InfoStat label="Name" value={`${player?.first_name ?? ''} ${player?.last_name ?? ''}`.trim() || '—'} />
                <InfoStat label="School" value={player?.university || '—'} icon={<GraduationCap className="w-3.5 h-3.5" />} />
                <InfoStat label="Age" value={player?.age ?? '—'} />
                <InfoStat label="Gender" value={player?.gender ? player.gender.charAt(0).toUpperCase() + player.gender.slice(1) : '—'} />
                <InfoStat
                  label="ELO"
                  value={player && (player.placement_matches_played ?? 0) >= PLACEMENT_MATCHES ? player.current_elo : '—'}
                  sub={player && (player.placement_matches_played ?? 0) < PLACEMENT_MATCHES ? `${player.placement_matches_played ?? 0}/${PLACEMENT_MATCHES} placements` : undefined}
                  gold
                  icon={<Zap className="w-3.5 h-3.5" />}
                />
              </div>
            </Card>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/* ── Open Tournaments ── */}
            <section>
              <SectionHeading icon={<Trophy />} title="Tournaments" />

              {tournaments.length === 0 ? (
                <EmptyState icon={<Trophy />} message="No tournaments are open right now — check back soon!" />
              ) : (
                <div className="space-y-4">
                  {tournaments.map(t => {
                    const reg = myRegMap.get(t.id);
                    const isRegistered = !!reg;
                    const isBusy = busyId === t.id;
                    const isApproved = player?.status === 'active';
                    const canRegister = t.status === 'registration_open' && !isRegistered && isApproved;
                    const canUnregister = isRegistered && t.status !== 'in_progress' && t.status !== 'completed';

                    return (
                      <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
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
                              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-200 flex items-center gap-1">
                                {t.team_formation === 'random' ? <Shuffle className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                {t.team_formation === 'random' ? 'Random Teams' : 'Players Choose Teams'}
                              </span>
                            </div>
                            {t.description && (
                              <p className="text-sm text-gray-500 mb-1.5 max-w-xl text-justify">{t.description}</p>
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
                        </div>

                        {/* Registration status / actions */}
                        <div className="pt-3 border-t border-gray-50">
                          {isRegistered ? (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                                  <Check className="w-4 h-4" />
                                  You&apos;re registered
                                </span>
                                {reg.partner ? (
                                  <span className="text-gray-500">
                                    · Teamed with <span className="font-medium text-gray-700">{reg.partner.name}</span>
                                    {reg.teamName && <span className="font-medium text-gray-700"> as &ldquo;{reg.teamName}&rdquo;</span>}
                                  </span>
                                ) : reg.isMutualMatch && reg.requestedPartner ? (
                                  <span className="text-gray-500">
                                    · Registered with <span className="font-medium text-gray-700">{reg.requestedPartner.name}</span>
                                    {reg.teamName && <span className="font-medium text-gray-700"> as &ldquo;{reg.teamName}&rdquo;</span>}
                                  </span>
                                ) : reg.preferredPartnerId ? (
                                  <span className="text-gray-400">
                                    · Requested partner pending team formation
                                    {reg.teamName && <> — team name &ldquo;{reg.teamName}&rdquo; saved</>}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">· Waiting for team formation</span>
                                )}
                              </div>
                              {canUnregister && (
                                <button
                                  onClick={() => handleUnregister(t.id)}
                                  disabled={isBusy}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                                >
                                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                  Unregister
                                </button>
                              )}
                            </div>
                          ) : canRegister ? (
                            <div className="flex flex-wrap items-center gap-3">
                              {t.team_formation === 'self_select' && (
                                <>
                                  <select
                                    value={partnerChoice[t.id] ?? ''}
                                    onChange={e => setPartnerChoice(prev => ({ ...prev, [t.id]: e.target.value }))}
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent"
                                  >
                                    <option value="">Pick a teammate (optional)</option>
                                    {otherPlayers.map(p => (
                                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    value={teamNameChoice[t.id] ?? ''}
                                    onChange={e => setTeamNameChoice(prev => ({ ...prev, [t.id]: e.target.value }))}
                                    placeholder="Team name (optional)"
                                    maxLength={60}
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent"
                                  />
                                </>
                              )}
                              <button
                                onClick={() => handleRegister(t.id)}
                                disabled={isBusy}
                                className="text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-60"
                                style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}
                              >
                                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                                Register
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">
                              {!isApproved && t.status === 'registration_open'
                                ? 'Your account is pending admin approval. You\'ll be able to register once approved.'
                                : t.status === 'registration_closed'
                                ? 'Registration is closed for this tournament.'
                                : t.status === 'in_progress'
                                ? 'This tournament is already underway.'
                                : 'Registration is not currently open.'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
    </DashboardShell>
  );
}

function InfoStat({ label, value, sub, gold = false, icon }: { label: string; value: string | number; sub?: string; gold?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="bg-[#f5f4f0] rounded-xl p-3 flex flex-col gap-1">
      <p className="text-gray-400 text-xs uppercase tracking-wide flex items-center gap-1">{icon}{label}</p>
      <p className={`text-base font-bold ${gold ? 'text-[#FFB81C]' : 'text-gray-900'} truncate`}>{value}</p>
      {sub && <p className="text-gray-400 text-xs">{sub}</p>}
    </div>
  );
}
