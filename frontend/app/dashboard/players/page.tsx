'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { apiFetch } from '@/lib/api';
import { Search, Users, TrendingUp, Filter } from 'lucide-react';
import Image from 'next/image';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  university: string | null;
  current_elo: number;
  placement_matches_played: number;
  avatar_url: string | null;
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
};

function PlayerCard({ player, onClick }: { player: Player; onClick: () => void }) {
  const initials = `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}`.toUpperCase();
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#841617]/20 transition-all duration-200 p-5 flex items-center gap-4 group"
    >
      {/* Avatar */}
      <div className="flex-shrink-0 relative">
        {player.avatar_url ? (
          <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-gray-100 group-hover:ring-[#841617]/30 transition-all">
            <Image src={player.avatar_url} alt={`${player.first_name} ${player.last_name}`} width={56} height={56} className="object-cover w-full h-full" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#841617] to-[#a01a1b] flex items-center justify-center ring-2 ring-gray-100 group-hover:ring-[#841617]/30 transition-all">
            <span className="text-white font-bold text-lg">{initials}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 truncate group-hover:text-[#841617] transition-colors">
          {player.first_name} {player.last_name}
        </p>
        {player.university && (
          <p className="text-gray-400 text-xs truncate mt-0.5">{player.university}</p>
        )}
        {player.gender && (
          <p className="text-gray-400 text-xs mt-0.5">{GENDER_LABELS[player.gender] ?? player.gender}</p>
        )}
      </div>

      {/* ELO — only show after 5 placement matches are complete */}
      {player.placement_matches_played >= 5 && player.current_elo != null && (
        <div className="flex-shrink-0 text-right">
          <div className="flex items-center gap-1 justify-end">
            <TrendingUp className="h-3.5 w-3.5 text-[#841617]" />
            <span className="font-bold text-gray-900 text-sm">{player.current_elo}</span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">ELO</p>
        </div>
      )}
    </button>
  );
}

export default function PlayersDirectoryPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPlayers = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'active' });
      if (q) params.set('search', q);
      const res = await apiFetch(`/api/players?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPlayers(data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers(debouncedSearch);
  }, [debouncedSearch, fetchPlayers]);

  const filtered = genderFilter === 'all'
    ? players
    : players.filter(p => p.gender === genderFilter);

  // Sort by ELO descending
  const sorted = [...filtered].sort((a, b) => (b.current_elo ?? 0) - (a.current_elo ?? 0));

  return (
    <DashboardShell title="Players">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#841617]/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-[#841617]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Players</h1>
          </div>
          <p className="text-gray-500 text-sm ml-12">Search and view player stats and profiles</p>
        </div>

        {/* Search + filter bar */}
        <div className="flex gap-3 mb-6 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#841617]/30 focus:border-[#841617]/50 bg-white"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <select
              value={genderFilter}
              onChange={e => setGenderFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#841617]/30 focus:border-[#841617]/50 bg-white appearance-none cursor-pointer"
            >
              <option value="all">All genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
            </select>
          </div>
        </div>

        {/* Count */}
        {!loading && (
          <p className="text-xs text-gray-400 mb-4">
            {sorted.length} player{sorted.length !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Player grid */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 animate-pulse">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="w-10 h-6 bg-gray-100 rounded flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No players found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                onClick={() => router.push(`/dashboard/players/${player.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
