'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Sidebar } from '@/components/ui/modern-side-bar';
import { useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Trophy, Swords, Star, TrendingUp, User, ShieldCheck } from 'lucide-react';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  age: number;
  gender: string;
  current_elo: number;
  status: string;
  created_at: string;
  university?: string;
  bio?: string;
  player_badges?: {
    badge_id: string;
    awarded_at: string;
    badges: { name: string; icon_name: string; description: string };
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

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [player, setPlayer]           = useState<Player | null>(null);
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [alltime, setAlltime]         = useState<AlltimeStats | null>(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!isLoaded) return;

    const load = async () => {
      try {
        // Always fetch player first — everything else needs the player id
        const playerRes = await fetch('/api/players/me');
        const playerData: Player | null = playerRes.ok ? await playerRes.json() : null;
        if (playerData) setPlayer(playerData);

        // Fetch season stats + all-time in parallel (even if playerData is null — they'll return empty gracefully)
        const [lbRes, atRes] = await Promise.all([
          fetch('/api/leaderboard'),
          fetch('/api/players/me/alltime'),
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
        // silently fail — page still renders with whatever loaded
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isLoaded]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName   = user?.firstName ?? '';
  const lastName    = user?.lastName  ?? '';
  const initials    = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const fullName    = player ? `${player.first_name} ${player.last_name}` : `${firstName} ${lastName}`;
  const gender      = player?.gender ? (player.gender.charAt(0).toUpperCase() + player.gender.slice(1)) : '—';
  const age         = player?.age ?? '—';
  const university  = player?.university ?? 'Oakland University';
  const memberSince = player?.created_at
    ? new Date(player.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';
  const currentElo  = player?.current_elo ?? 1200;

  // Season stats
  const sWins       = seasonStats?.wins   ?? 0;
  const sLosses     = seasonStats?.losses ?? 0;
  const sMatches    = seasonStats?.total_matches ?? (sWins + sLosses);
  const sWinPct     = sMatches > 0 ? ((sWins / sMatches) * 100).toFixed(1) : '0.0';
  const sRank       = seasonStats?.rank ?? '—';

  // All-time stats
  const aWins       = alltime?.totalWins   ?? 0;
  const aLosses     = alltime?.totalLosses ?? 0;
  const aMatches    = alltime?.totalMatches ?? 0;
  const aWinPct     = aMatches > 0 ? ((aWins / aMatches) * 100).toFixed(1) : '0.0';
  const peakElo     = alltime?.peakElo ?? currentElo;
  const seasonsPlayed = alltime?.seasonsPlayed ?? 0;

  const badges = player?.player_badges ?? [];

  const badgeIcons: Record<string, React.ReactNode> = {
    trophy:     <Trophy className="w-4 h-4" />,
    swords:     <Swords className="w-4 h-4" />,
    star:       <Star className="w-4 h-4" />,
    trending:   <TrendingUp className="w-4 h-4" />,
    shield:     <ShieldCheck className="w-4 h-4" />,
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
          <div className="w-20 h-20 rounded-full bg-[#FFB81C] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#FFB81C]/20">
            <span className="text-[#0a0a0a] font-black text-2xl">{initials || <User className="w-8 h-8" />}</span>
          </div>
          <div>
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
        </div>

        {/* ── Personal info ── */}
        <SectionTitle>Personal Info</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Age"     value={age} />
          <StatCard label="Gender"  value={gender} />
          <StatCard label="School"  value={university} />
          <StatCard label="Member Since" value={memberSince} />
        </div>

        {/* ── Bio ── */}
        {player?.bio && (
          <>
            <SectionTitle>About</SectionTitle>
            <div className="bg-[#111] border border-white/10 rounded-xl p-4">
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{player.bio}</p>
            </div>
          </>
        )}

        {/* ── Current Season ── */}
        <SectionTitle>Current Season</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="ELO"        value={currentElo}   gold />
          <StatCard label="Rank"       value={sRank !== '—' ? `#${sRank}` : '—'} />
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
          <StatCard label="Peak ELO"      value={peakElo}     gold />
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
                <div className="w-9 h-9 rounded-full bg-[#FFB81C]/10 text-[#FFB81C] flex items-center justify-center flex-shrink-0">
                  {badgeIcons[b.badges.icon_name] ?? <Star className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{b.badges.name}</p>
                  <p className="text-white/40 text-xs">{b.badges.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-8" />
      </main>
    </div>
  );
}
