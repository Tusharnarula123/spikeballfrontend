'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/modern-side-bar';
import {
  Trophy,
  ChevronDown,
  Settings,
  Edit3,
  Camera,
  LogOut,
  X,
  Check,
  Info,
  Zap,
  TrendingUp,
  Award,
  Bell,
  Loader2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  player_id: string;
  display_name: string;
  gender: string | null;
  current_elo: number;
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'tournament' | 'update' | 'event' | 'general';
}

const TYPE_STYLES: Record<Announcement['type'], string> = {
  tournament: 'bg-purple-50  text-purple-700  border-purple-200',
  update:     'bg-blue-50    text-blue-700    border-blue-200',
  event:      'bg-green-50   text-green-700   border-green-200',
  general:    'bg-gray-50    text-gray-600    border-gray-200',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [lbFilter, setLbFilter] = useState('All');
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [university, setUniversity] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Fetch real leaderboard
  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]));
  }, []);

  // Fetch announcements (live tournaments + general club news)
  useEffect(() => {
    fetch('/api/announcements')
      .then(r => r.json())
      .then((data: { id: string; type: Announcement['type']; title: string; body: string; date: string }[]) => {
        setAnnouncements(
          Array.isArray(data)
            ? data.map(a => ({ id: a.id, title: a.title, content: a.body, date: a.date, type: a.type }))
            : [],
        );
      })
      .catch(() => setAnnouncements([]));
  }, []);

  // Fetch current player's DB id (to highlight their leaderboard row) + saved profile fields
  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch('/api/players/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.id) setMyPlayerId(data.id);
        if (typeof data?.university === 'string') setUniversity(data.university);
        if (typeof data?.bio === 'string') setBio(data.bio);
      })
      .catch(() => {});
  }, [isLoaded, user]);

  // Close avatar dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 text-[#FFB81C] animate-spin" />
      </div>
    );
  }

  // Derived player info
  const firstName   = user?.firstName || 'Spiker';
  const displayName = user?.fullName || user?.username || 'Anonymous';
  const initials    = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase() || 'S';
  const avatarUrl   = user?.imageUrl;

  const myEntry = leaderboard.find(p => p.player_id === myPlayerId);

  const filteredLb = leaderboard.filter(p => {
    if (lbFilter === 'Men')   return p.gender === 'male';
    if (lbFilter === 'Women') return p.gender === 'female';
    return true;
  });

  const handleSaveProfile = async () => {
    setSaving(true);
    setProfileError(null);
    try {
      const res = await fetch('/api/players/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ university, bio }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setProfileError(data.error ?? 'Failed to save profile');
        return;
      }
      setShowEditProfile(false);
    } catch {
      setProfileError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f4f0] overflow-hidden">

      {/* ── Sidebar ── */}
      <Sidebar
        playerName={displayName}
        playerInitials={initials}
        playerRole={myEntry ? `Rank #${myEntry.rank}` : 'Unranked'}
        onSignOut={() => signOut(() => router.push('/'))}
      />

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
          {/* Greeting — indent on mobile to clear hamburger */}
          <div className="ml-14 md:ml-0">
            <h1 className="text-xl font-bold text-[#0a0a0a]">
              What up!{' '}
              <span className="text-[#FFB81C]">Spiker</span>{' '}
              {firstName}! 👋
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {myEntry
                ? `Rank #${myEntry.rank} · ${myEntry.current_elo} ELO · ${myEntry.wins}W ${myEntry.losses}L`
                : 'Complete 10 placement matches to appear on the leaderboard'}
            </p>
          </div>

          {/* Avatar + dropdown */}
          <div className="relative flex-shrink-0" ref={avatarMenuRef}>
            <button
              onClick={() => setShowAvatarMenu(v => !v)}
              className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-[#FFB81C] flex items-center justify-center overflow-hidden border-2 border-[#FFB81C] shadow">
                {avatarUrl
                  ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  : <span className="text-[#0a0a0a] font-bold text-sm">{initials}</span>}
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400 hidden sm:block" />
            </button>

            {showAvatarMenu && (
              <div className="absolute right-0 top-12 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50">
                <div className="px-4 py-2 border-b border-gray-100 mb-1">
                  <p className="text-sm font-semibold text-[#0a0a0a] truncate">{displayName}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
                <button
                  onClick={() => { setShowEditProfile(true); setShowAvatarMenu(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit3 className="h-4 w-4 text-gray-400" />
                  Edit Profile
                </button>
                <button
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setShowAvatarMenu(false)}
                >
                  <Settings className="h-4 w-4 text-gray-400" />
                  Settings
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => signOut(() => router.push('/'))}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable page body */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

            {/* ── Leaderboard ── */}
            <section>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {/* Header row matching homepage style */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <div>
                    <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#FFB81C' }}>Season 2025</p>
                    <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
                  </div>
                  <div className="flex gap-2">
                    {['All', 'Men', 'Women'].map(f => (
                      <button
                        key={f}
                        onClick={() => setLbFilter(f)}
                        className="text-xs px-3 py-1 rounded-full border transition-all duration-200"
                        style={{
                          borderColor: lbFilter === f ? '#FFB81C' : '#e5e5e5',
                          color: lbFilter === f ? '#FFB81C' : '#888',
                          backgroundColor: lbFilter === f ? 'rgba(255,184,28,0.08)' : 'transparent',
                        }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#0a0a0a' }}>
                        {['Rank', 'Player', 'ELO', 'Record', 'Ratio'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLb.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                            No ranked players yet — complete your placement matches to appear here!
                          </td>
                        </tr>
                      ) : filteredLb.map((player) => {
                        const isMe = player.player_id === myPlayerId;
                        return (
                          <tr
                            key={player.player_id}
                            className="border-t border-gray-50 transition-colors"
                            style={{ backgroundColor: isMe ? 'rgba(255,184,28,0.08)' : undefined }}
                            onMouseEnter={e => { if (!isMe) (e.currentTarget as HTMLElement).style.backgroundColor = '#fffbf0'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = isMe ? 'rgba(255,184,28,0.08)' : ''; }}
                          >
                            <td className="px-4 py-2.5 font-bold text-xs">
                              {player.rank <= 3
                                ? ['🥇','🥈','🥉'][player.rank - 1]
                                : <span className="text-gray-400">#{player.rank}</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                  style={{ backgroundColor: '#0a0a0a', color: '#FFB81C' }}>
                                  {(player.display_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <span className={`text-xs ${isMe ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                                  {player.display_name}
                                </span>
                                {isMe && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                                    style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
                                    YOU
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-bold text-xs" style={{ color: '#FFB81C' }}>
                              {player.current_elo}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              <span className="text-green-600 font-medium">{player.wins}W</span>
                              <span className="text-gray-300 mx-1">–</span>
                              <span className="text-red-400 font-medium">{player.losses}L</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 font-medium">
                              {player.total_matches > 0 ? Math.round(player.win_rate) : 0}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* ── ELO Explainer ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Info className="h-5 w-5 text-[#FFB81C]" />
                <h2 className="text-lg font-bold text-[#0a0a0a]">How ELO Rankings Work</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    icon: Zap,
                    title: 'Starting ELO',
                    desc: 'Every player begins at 1,000 ELO. The more you play, the closer your rating gets to your true skill level.',
                    bg: 'bg-amber-50 border-amber-200',
                    iconColor: 'text-amber-500',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Placement Phase',
                    desc: 'Your first 10 matches use K = 60 (high volatility). This lets your rating settle to its real level quickly.',
                    bg: 'bg-blue-50 border-blue-200',
                    iconColor: 'text-blue-500',
                  },
                  {
                    icon: Award,
                    title: 'Rated Phase',
                    desc: 'After placement, K = 24. Beating higher-ranked players earns more ELO. Losses to lower-ranked players hurt more.',
                    bg: 'bg-purple-50 border-purple-200',
                    iconColor: 'text-purple-500',
                  },
                  {
                    icon: Trophy,
                    title: '2v2 Formula',
                    desc: 'Team ELO = average of both partners. All 4 players gain/lose ELO based on expected vs actual match outcome.',
                    bg: 'bg-green-50 border-green-200',
                    iconColor: 'text-green-500',
                  },
                ].map(({ icon: Icon, title, desc, bg, iconColor }) => (
                  <div key={title} className={`rounded-2xl border p-5 ${bg}`}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                      <h3 className="font-semibold text-[#0a0a0a] text-sm">{title}</h3>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Announcements ── */}
            <section className="pb-4">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-[#FFB81C]" />
                <h2 className="text-lg font-bold text-[#0a0a0a]">Announcements</h2>
                <span className="text-xs text-gray-400 ml-1">· Latest first</span>
              </div>

              {/* Horizontal scroll — no loop, newest on the left */}
              <div
                className="flex gap-4 overflow-x-auto pb-3"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {announcements.length === 0 && (
                  <div className="flex-shrink-0 w-72 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center text-sm text-gray-400">
                    No announcements right now.
                  </div>
                )}
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="flex-shrink-0 w-72 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col"
                  >
                    <span className={`self-start text-xs font-medium px-2.5 py-0.5 rounded-full border mb-3 ${TYPE_STYLES[ann.type]}`}>
                      {ann.type.charAt(0).toUpperCase() + ann.type.slice(1)}
                    </span>
                    <h3 className="font-semibold text-[#0a0a0a] text-sm mb-2 leading-snug">{ann.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed flex-1">{ann.content}</p>
                    <p className="text-xs text-gray-300 mt-3">
                      {new Date(ann.date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-[#0a0a0a]">Edit Profile</h2>
              <button
                onClick={() => setShowEditProfile(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">

              {/* Avatar */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-[#FFB81C] flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
                    {avatarUrl
                      ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                      : <span className="text-[#0a0a0a] font-bold text-2xl">{initials}</span>}
                  </div>
                  <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#0a0a0a] rounded-full flex items-center justify-center shadow border-2 border-white">
                    <Camera className="h-3 w-3 text-[#FFB81C]" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Profile photo is managed through your Clerk account
                </p>
              </div>

              {/* Display name (read-only) */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  readOnly
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Change your name in your{' '}
                  <a href="https://accounts.clerk.dev" target="_blank" rel="noreferrer" className="text-[#FFB81C] underline">
                    Clerk account
                  </a>
                </p>
              </div>

              {/* University / School / College */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  University / School / College
                </label>
                <input
                  type="text"
                  value={university}
                  onChange={e => setUniversity(e.target.value)}
                  placeholder="e.g. Oakland University"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Bio <span className="text-gray-400 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell the club a bit about yourself…"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FFB81C] focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100">
              {profileError && <p className="text-xs text-red-500 mb-3">{profileError}</p>}
              <div className="flex gap-3">
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-[#FFB81C] rounded-lg text-sm font-bold text-[#0a0a0a] hover:bg-[#e6a418] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {saving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><Check className="h-4 w-4" /> Save Changes</>}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
