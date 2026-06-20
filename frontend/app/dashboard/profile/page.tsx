'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Sidebar } from '@/components/ui/modern-side-bar';
import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
  Trophy, Swords, Star, TrendingUp, User, ShieldCheck, Pencil, X, Check, Loader2,
  CheckCircle, Medal, Award, Flame, Zap, Crown,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useApi } from '@/hooks/use-api';

const PLACEMENT_MATCHES = 5;

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  age: number;
  gender: string;
  current_elo: number;
  placement_matches_played: number;
  status: string;
  created_at: string;
  university?: string;
  bio?: string;
  avatar_url?: string;
  player_badges?: {
    badge_id: string;
    awarded_at: string;
    tournament_id?: string | null;
    badges: { name: string; icon_name: string | null; icon_url: string | null; description: string };
    tournament?: { id: string; name: string } | null;
  }[];
}

interface SeasonStats {
  rank: number;
  current_elo: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_matches: number;
}

interface AlltimeStats {
  totalWins: number;
  totalLosses: number;
  totalMatches: number;
  peakElo: number;
  seasonsPlayed: number;
  winRate: number;
}

function StatCard({
  label,
  value,
  sub,
  gold = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  gold?: boolean;
}) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-white/40 text-xs uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-bold ${gold ? 'text-[#FFB81C]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-white/30 text-xs">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3 mt-6 first:mt-0">
      {children}
    </h2>
  );
}

const GENDER_OPTIONS = [
  { value: 'male',              label: 'Male' },
  { value: 'female',            label: 'Female' },
  { value: 'non_binary',        label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

function genderLabel(g?: string) {
  if (!g) return '—';
  return GENDER_OPTIONS.find(o => o.value === g)?.label ?? (g.charAt(0).toUpperCase() + g.slice(1));
}

interface EditForm {
  firstName:  string;
  lastName:   string;
  age:        string;
  gender:     string;
  university: string;
  bio:        string;
}

interface EditModalProps {
  player: Player;
  onClose: () => void;
  onSaved: (updated: Player) => void;
  fetchApi: (url: string, opts?: RequestInit) => Promise<Response>;
}

function EditModal({ player, onClose, onSaved, fetchApi }: EditModalProps) {
  const [form, setForm] = useState<EditForm>({
    firstName:  player.first_name,
    lastName:   player.last_name,
    age:        player.age ? String(player.age) : '',
    gender:     player.gender ?? '',
    university: player.university ?? '',
    bio:        player.bio ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (key: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        firstName:  form.firstName.trim(),
        lastName:   form.lastName.trim(),
        university: form.university.trim(),
        bio:        form.bio.trim(),
        gender:     form.gender || undefined,
      };
      if (form.age !== '') body.age = Number(form.age);

      const res = await fetchApi('/api/players/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? data?.message ?? 'Failed to save changes');
        return;
      }

      const updated: Player = await res.json();
      onSaved(updated);
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">Edit Profile</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/40 text-xs uppercase tracking-widest block mb-1.5">First Name</label>
              <input
                value={form.firstName}
                onChange={set('firstName')}
                placeholder="First name"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#FFB81C]/60 transition-colors"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs uppercase tracking-widest block mb-1.5">Last Name</label>
              <input
                value={form.lastName}
                onChange={set('lastName')}
                placeholder="Last name"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#FFB81C]/60 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/40 text-xs uppercase tracking-widest block mb-1.5">Age</label>
              <input
                type="number"
                min={16}
                max={99}
                value={form.age}
                onChange={set('age')}
                placeholder="—"
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#FFB81C]/60 transition-colors"
              />
            </div>
            <div>
              <label className="text-white/40 text-xs uppercase tracking-widest block mb-1.5">Gender</label>
              <select
                value={form.gender}
                onChange={set('gender')}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#FFB81C]/60 transition-colors appearance-none"
              >
                <option value="">—</option>
                {GENDER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-white/40 text-xs uppercase tracking-widest block mb-1.5">University / School</label>
            <input
              value={form.university}
              onChange={set('university')}
              placeholder="Oakland University"
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#FFB81C]/60 transition-colors"
            />
          </div>

          <div>
            <label className="text-white/40 text-xs uppercase tracking-widest block mb-1.5">Bio</label>
            <textarea
              value={form.bio}
              onChange={set('bio')}
              rows={3}
              placeholder="Tell your team a bit about yourself…"
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#FFB81C]/60 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-[#FFB81C] hover:bg-[#e6a619] text-black font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();
  const { signOut } = useClerk();
  const router = useRouter();

  const [player, setPlayer]           = useState<Player | null>(null);
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [alltime, setAlltime]         = useState<AlltimeStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [editOpen, setEditOpen]       = useState(false);

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;

    const load = async () => {
      try {
        const playerRes = await fetchApi('/api/players/me');
        const playerData: Player | null = playerRes.ok ? await playerRes.json() : null;
        if (playerData) setPlayer(playerData);

        const [lbRes, atRes] = await Promise.all([
          apiFetch('/api/leaderboard'),
          fetchApi('/api/players/me/alltime'),
        ]);

        if (lbRes.ok && playerData) {
          const rows: (SeasonStats & { player_id: string })[] = await lbRes.json();
          const mine = rows.find(r => r.player_id === playerData.id);
          if (mine) setSeasonStats(mine);
        }

        if (atRes.ok) {
          const atData: AlltimeStats = await atRes.json();
          setAlltime(atData);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userLoaded, authLoaded, fetchApi]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (!userLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName   = player?.first_name ?? user?.firstName ?? '';
  const lastName    = player?.last_name  ?? user?.lastName  ?? '';
  const initials    = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const fullName    = `${firstName} ${lastName}`.trim();
  const gender      = genderLabel(player?.gender);
  const age         = player?.age ?? '—';
  const university  = player?.university ?? '—';
  const memberSince = player?.created_at
    ? new Date(player.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';
  const placementsPlayed = player?.placement_matches_played ?? 0;
  const inPlacement      = placementsPlayed < PLACEMENT_MATCHES;
  const currentElo       = player?.current_elo ?? 1000;

  const sWins       = seasonStats?.wins   ?? 0;
  const sLosses     = seasonStats?.losses ?? 0;
  const sMatches    = seasonStats?.total_matches ?? (sWins + sLosses);
  const sWinPct     = sMatches > 0 ? ((sWins / sMatches) * 100).toFixed(1) : '0.0';
  const sRank       = seasonStats?.rank ?? '—';

  const aWins       = alltime?.totalWins   ?? 0;
  const aLosses     = alltime?.totalLosses ?? 0;
  const aMatches    = alltime?.totalMatches ?? 0;
  const aWinPct     = aMatches > 0 ? ((aWins / aMatches) * 100).toFixed(1) : '0.0';
  const peakElo     = alltime?.peakElo ?? currentElo;
  const seasonsPlayed = alltime?.seasonsPlayed ?? 0;

  const badges = player?.player_badges ?? [];

  const badgeIcons: Record<string, React.ReactNode> = {
    trophy:       <Trophy className="w-4 h-4" />,
    swords:       <Swords className="w-4 h-4" />,
    star:         <Star className="w-4 h-4" />,
    trending:     <TrendingUp className="w-4 h-4" />,
    shield:       <ShieldCheck className="w-4 h-4" />,
    'check-circle': <CheckCircle className="w-4 h-4" />,
    medal:        <Medal className="w-4 h-4" />,
    award:        <Award className="w-4 h-4" />,
    flame:        <Flame className="w-4 h-4" />,
    zap:          <Zap className="w-4 h-4" />,
    crown:        <Crown className="w-4 h-4" />,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar
        playerName={fullName}
        playerInitials={initials}
        playerRole={player?.status === 'active' ? 'Active Player' : 'Pending Approval'}
        onSignOut={handleSignOut}
      />

      {/* Main content */}
      <main className="flex-1 md:ml-0 overflow-y-auto p-6 md:p-8 max-w-3xl mx-auto w-full">

        {/* ── Profile header ── */}
        <div className="flex items-center gap-5 mb-8">
          {player?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.avatar_url}
              alt={fullName}
              className="w-20 h-20 rounded-full object-cover flex-shrink-0 shadow-lg shadow-[#FFB81C]/20"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#FFB81C] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#FFB81C]/20">
              <span className="text-[#0a0a0a] font-black text-2xl">{initials || <User className="w-8 h-8" />}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-white text-2xl font-bold">{fullName}</h1>
            <p className="text-white/40 text-sm mt-0.5">{player?.email ?? user?.primaryEmailAddress?.emailAddress}</p>
            <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              player?.status === 'active'
                ? 'bg-green-500/15 text-green-400'
                : 'bg-yellow-500/15 text-yellow-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${player?.status === 'active' ? 'bg-green-400' : 'bg-yellow-400'}`} />
              {player?.status === 'active' ? 'Active Player' : 'Pending Approval'}
            </span>
          </div>
          {/* Edit button */}
          {player && (
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#FFB81C]/40 text-white/60 hover:text-white text-sm font-medium rounded-xl transition-all flex-shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>

        {/* ── Personal info ── */}
        <SectionTitle>Personal Info</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Age"          value={age} />
          <StatCard label="Gender"       value={gender} />
          <StatCard label="School"       value={university} />
          <StatCard label="Member Since" value={memberSince} />
        </div>

        {/* ── Bio ── */}
        {player?.bio && (
          <>
            <SectionTitle>About</SectionTitle>
            <div className="bg-[#111] border border-white/10 rounded-xl p-4">
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap text-justify">{player.bio}</p>
            </div>
          </>
        )}

        {/* ── Current Season ── */}
        <SectionTitle>Current Season</SectionTitle>
        {inPlacement && (
          <div className="bg-[#111] border border-[#FFB81C]/20 rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#FFB81C] flex-shrink-0" />
            <p className="text-[#FFB81C] text-xs font-semibold">
              Placement — {placementsPlayed} / {PLACEMENT_MATCHES} matches completed
            </p>
            <p className="text-white/30 text-xs ml-auto">ELO &amp; rank visible after placement</p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="ELO"  value={inPlacement ? '—' : currentElo} gold={!inPlacement}
            sub={inPlacement ? `${placementsPlayed}/${PLACEMENT_MATCHES} placement matches` : undefined} />
          <StatCard label="Rank" value={inPlacement ? '—' : (sRank !== '—' ? `#${sRank}` : '—')}
            sub={inPlacement ? 'Unranked during placement' : undefined} />
          <StatCard label="Record"     value={`${sWins} — ${sLosses}`} sub="Wins — Losses" />
          <StatCard label="Win Rate"   value={`${sWinPct}%`} />
          <StatCard label="Matches Played" value={sMatches} />
          <StatCard label="W / L Ratio"
            value={sLosses === 0 ? (sWins > 0 ? `${sWins}.0` : '—') : (sWins / sLosses).toFixed(2)}
            sub={sLosses === 0 && sWins > 0 ? 'Perfect record' : undefined}
          />
        </div>

        {/* ── All-Time ── */}
        <SectionTitle>All-Time</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Peak ELO" value={inPlacement ? '—' : peakElo} gold={!inPlacement}
            sub={inPlacement ? 'Available after placement' : undefined} />
          <StatCard label="Seasons Played" value={seasonsPlayed} />
          <StatCard label="Record"         value={`${aWins} — ${aLosses}`} sub="Wins — Losses" />
          <StatCard label="Win Rate"       value={`${aWinPct}%`} />
          <StatCard label="Total Matches"  value={aMatches} />
          <StatCard label="W / L Ratio"
            value={aLosses === 0 ? (aWins > 0 ? `${aWins}.0` : '—') : (aWins / aLosses).toFixed(2)}
            sub={aLosses === 0 && aWins > 0 ? 'Perfect record' : undefined}
          />
        </div>

        {/* ── Badges ── */}
        <SectionTitle>Badges</SectionTitle>
        {badges.length === 0 ? (
          <div className="bg-[#111] border border-white/10 rounded-xl p-6 text-center">
            <Trophy className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No badges yet — keep playing to earn them!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {badges.map((b) => (
              <div key={b.badge_id}
                className="flex items-center gap-3 bg-[#111] border border-[#FFB81C]/20 rounded-xl p-4">
                <div className="w-9 h-9 rounded-full bg-[#FFB81C]/10 text-[#FFB81C] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {b.badges.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.badges.icon_url} alt={b.badges.name} className="w-full h-full object-cover" />
                  ) : (
                    badgeIcons[b.badges.icon_name ?? ''] ?? <Star className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold">{b.badges.name}</p>
                  <p className="text-white/40 text-xs">{b.badges.description}</p>
                  {b.tournament?.name && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[#FFB81C]/10 text-[#FFB81C] text-[11px] font-medium">
                      <Trophy className="w-3 h-3" />
                      {b.tournament.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-8" />
      </main>

      {/* Edit modal */}
      {editOpen && player && (
        <EditModal
          player={player}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => setPlayer(updated)}
          fetchApi={fetchApi}
        />
      )}
    </div>
  );
}
