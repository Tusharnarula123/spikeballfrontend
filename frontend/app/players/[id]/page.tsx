'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface PlayerProfile {
  id: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  age: number | null;
  university: string | null;
  bio: string | null;
  avatar_url: string | null;
  current_elo: number;
  peak_elo: number;
  rank: number | null;
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
  placement_matches_played: number;
  seasons_played: number;
  is_ranked: boolean;
}

export default function PublicPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/players/${id}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setPlayer(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Player not found.</p>
        <Link href="/" className="text-sm text-[#FFB81C] hover:underline">← Back to home</Link>
      </div>
    );
  }

  const initials = `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal nav */}
      <nav className="border-b border-gray-100 px-6 h-14 flex items-center justify-between max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <span>←</span> Back
        </button>
        <div className="flex items-center gap-3">
          <Image src="/logo.svg" alt="OU Roundnet" width={28} height={28} />
          <span className="text-sm font-semibold text-gray-900">OU <span style={{ color: '#FFB81C' }}>Roundnet</span></span>
        </div>
        <Link href="/login" className="text-sm px-4 py-1.5 rounded-lg font-medium transition-all hover:scale-105"
          style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
          Sign in
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-5 mb-8">
          {player.avatar_url ? (
            <Image src={player.avatar_url} alt={player.first_name} width={80} height={80}
              className="rounded-full object-cover w-20 h-20 ring-2 ring-[#FFB81C]/30" />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ring-2 ring-[#FFB81C]/30"
              style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{player.first_name} {player.last_name}</h1>
            {player.university && <p className="text-gray-500 text-sm mt-0.5">{player.university}</p>}
            {player.is_ranked && player.rank && (
              <span className="inline-block mt-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(255,184,28,0.12)', color: '#c98a00' }}>
                Rank #{player.rank}
              </span>
            )}
          </div>
        </div>

        {/* Stats grid */}
        {player.is_ranked ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'ELO', value: player.current_elo },
              { label: 'Peak ELO', value: player.peak_elo },
              { label: 'Record', value: `${player.wins}W – ${player.losses}L` },
              { label: 'Win Rate', value: `${Math.round(player.win_rate)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-gray-100 p-4 text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</div>
                <div className="text-xl font-bold text-gray-900">{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 p-5 mb-8 text-center">
            <p className="text-gray-500 text-sm">
              Placement in progress — {player.placement_matches_played}/5 matches completed
            </p>
          </div>
        )}

        {/* Bio */}
        {player.bio && (
          <div className="rounded-xl border border-gray-100 p-5 mb-8">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">About</p>
            <p className="text-gray-600 text-sm leading-relaxed">{player.bio}</p>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-xl border border-[#FFB81C]/20 bg-[#fffbf0] p-6 text-center">
          <p className="text-gray-700 font-medium mb-1">Want to see full match history and ELO chart?</p>
          <p className="text-gray-400 text-sm mb-4">Sign in to access the full dashboard</p>
          <Link href="/login" className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
            Sign in / Join
          </Link>
        </div>
      </div>
    </div>
  );
}
