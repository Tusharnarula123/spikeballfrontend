'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { Trophy, Calendar, Users, ChevronRight, GitBranch } from 'lucide-react';
import { useApi } from '@/hooks/use-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  is_casual: boolean;
  affects_elo: boolean;
  start_date: string;
  end_date: string | null;
  status: 'upcoming' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled';
  registration_count: number;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Tournament['status'], string> = {
  upcoming:          'Upcoming',
  registration_open: 'Registration Open',
  in_progress:       'In Progress',
  completed:         'Completed',
  cancelled:         'Cancelled',
};

const STATUS_STYLE: Record<Tournament['status'], string> = {
  upcoming:          'bg-gray-100 text-gray-500',
  registration_open: 'bg-green-50 text-green-700',
  in_progress:       'bg-purple-50 text-purple-700',
  completed:         'bg-blue-50 text-blue-700',
  cancelled:         'bg-red-50 text-red-500',
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TournamentsPage() {
  const { isLoaded: userLoaded } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;
    fetchApi('/api/tournaments')
      .then(r => r.ok ? r.json() : [])
      .then(setTournaments)
      .finally(() => setLoading(false));
  }, [userLoaded, authLoaded, fetchApi]);

  const active    = tournaments.filter(t => t.status === 'in_progress' || t.status === 'registration_open');
  const upcoming  = tournaments.filter(t => t.status === 'upcoming');
  const past      = tournaments.filter(t => t.status === 'completed' || t.status === 'cancelled');

  const TournamentCard = ({ t }: { t: Tournament }) => (
    <Link
      href={`/dashboard/tournaments/${t.id}`}
      className="group flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[#FFB81C]/40 transition-all duration-200"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[#FFB81C]/10 flex items-center justify-center flex-shrink-0">
          <Trophy className="w-5 h-5 text-[#FFB81C]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{t.name}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}>
              {STATUS_LABEL[t.status]}
            </span>
            {t.is_casual && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">
                Casual
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {fmt(t.start_date)}{t.end_date ? ` – ${fmt(t.end_date)}` : ''}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {t.registration_count} registered
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {(t.status === 'in_progress' || t.status === 'completed') && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-[#FFB81C] font-semibold">
            <GitBranch className="w-3.5 h-3.5" />
            View Bracket
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FFB81C] transition-colors" />
      </div>
    </Link>
  );

  const Section = ({ label, items }: { label: string; items: Tournament[] }) =>
    items.length === 0 ? null : (
      <section>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{label}</p>
        <div className="space-y-3">
          {items.map(t => <TournamentCard key={t.id} t={t} />)}
        </div>
      </section>
    );

  return (
    <DashboardShell
      title="Tournaments"
      subtitle="View brackets and submit your match scores."
      loading={!userLoaded || !authLoaded || loading}
      width="default"
      headerRight={
        <span className="text-xs text-gray-400">{tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}</span>
      }
    >
      {!loading && tournaments.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tournaments yet.</p>
          <p className="text-xs mt-1">Check back once an admin creates one.</p>
        </div>
      )}

      <Section label="Active" items={active} />
      <Section label="Upcoming" items={upcoming} />
      <Section label="Past" items={past} />
    </DashboardShell>
  );
}
