'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { DashboardShell } from '@/components/ui/dashboard-shell';
import { Swords, Calendar, Users, ChevronRight } from 'lucide-react';
import { useApi } from '@/hooks/use-api';

interface Session {
  id: string;
  name: string;
  description: string | null;
  tournament_type: string;
  start_date: string;
  end_date: string | null;
  status: 'upcoming' | 'registration_open' | 'registration_closed' | 'in_progress' | 'completed' | 'cancelled';
  registration_count: number;
}

const STATUS_LABEL: Record<Session['status'], string> = {
  upcoming:            'Upcoming',
  registration_open:   'Registration Open',
  registration_closed: 'Registration Closed',
  in_progress:         'In Progress',
  completed:           'Completed',
  cancelled:           'Cancelled',
};

const STATUS_STYLE: Record<Session['status'], string> = {
  upcoming:            'bg-gray-100 text-gray-500',
  registration_open:   'bg-green-50 text-green-700',
  registration_closed: 'bg-orange-50 text-orange-700',
  in_progress:         'bg-purple-50 text-purple-700',
  completed:           'bg-blue-50 text-blue-700',
  cancelled:           'bg-red-50 text-red-500',
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function CompetitivePage() {
  const { isLoaded: userLoaded } = useUser();
  const { fetchApi, isLoaded: authLoaded } = useApi();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userLoaded || !authLoaded) return;
    fetchApi('/api/tournaments')
      .then(r => r.ok ? r.json() : [])
      .then((all: Session[]) => setSessions((all ?? []).filter(t => t.tournament_type === 'rotating')))
      .finally(() => setLoading(false));
  }, [userLoaded, authLoaded, fetchApi]);

  const active   = sessions.filter(s => s.status === 'in_progress' || s.status === 'registration_open');
  const upcoming = sessions.filter(s => s.status === 'upcoming');
  const past     = sessions.filter(s => s.status === 'completed' || s.status === 'cancelled');

  const Card = ({ s }: { s: Session }) => (
    <Link
      href={`/dashboard/competitive/${s.id}`}
      className="group flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[#FFB81C]/40 transition-all duration-200"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[#FFB81C]/10 flex items-center justify-center flex-shrink-0">
          <Swords className="w-5 h-5 text-[#FFB81C]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[s.status]}`}>
              {STATUS_LABEL[s.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {fmt(s.start_date)}{s.end_date ? ` – ${fmt(s.end_date)}` : ''}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {s.registration_count} registered
            </span>
          </div>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#FFB81C] transition-colors flex-shrink-0 ml-3" />
    </Link>
  );

  const Section = ({ label, items }: { label: string; items: Session[] }) =>
    items.length === 0 ? null : (
      <section>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">{label}</p>
        <div className="space-y-3">{items.map(s => <Card key={s.id} s={s} />)}</div>
      </section>
    );

  return (
    <DashboardShell
      title="Competitive"
      subtitle="Sign up and get matched into ELO-balanced nets each round."
      loading={!userLoaded || !authLoaded || loading}
      width="default"
      headerRight={
        <span className="text-xs text-gray-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
      }
    >
      {!loading && sessions.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Swords className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No competitive sessions yet.</p>
          <p className="text-xs mt-1">Check back once an admin creates one.</p>
        </div>
      )}

      <Section label="Active" items={active} />
      <Section label="Upcoming" items={upcoming} />
      <Section label="Past" items={past} />
    </DashboardShell>
  );
}
