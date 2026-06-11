import { NextResponse } from 'next/server';
import { err } from '@/lib/api-helpers';
import { supabase } from '@/lib/supabase';

export type AnnouncementType = 'tournament' | 'update' | 'event' | 'general';

export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string;
  date: string; // ISO date string
}

// A small set of general club announcements, shown alongside tournament news.
const STATIC_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'static-elo',
    type: 'update',
    title: '🆕 ELO System Live',
    body: 'K-factor is 60 for placement matches (first 10) and 24 after. Check the ELO guide on your dashboard for the full breakdown.',
    date: '2025-02-15',
  },
  {
    id: 'static-welcome',
    type: 'general',
    title: '👋 Welcome New Members!',
    body: 'Complete your 10 placement matches to appear on the official leaderboard.',
    date: '2025-01-20',
  },
];

// GET /api/announcements — public. Merges live tournament announcements with
// general club announcements, newest first.
export async function GET() {
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['upcoming', 'registration_open', 'in_progress'])
    .order('start_date', { ascending: true });

  if (error) return err(error.message);

  const tournamentAnnouncements: Announcement[] = (tournaments ?? []).map((t) => {
    let title: string;
    if (t.status === 'registration_open') title = `🏆 ${t.name} — Registration Open`;
    else if (t.status === 'in_progress')   title = `🔥 ${t.name} — Live Now`;
    else                                    title = `📅 Upcoming: ${t.name}`;

    const dateStr = new Date(t.start_date).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    const bodyParts = [
      t.description ?? '',
      `Date: ${dateStr}.`,
      t.is_casual ? 'Casual tournament — results will not affect ELO.' : 'Ranked tournament — results affect ELO.',
      t.team_formation === 'self_select'
        ? 'Teams: pick your own teammate when you register.'
        : 'Teams: assigned randomly by an admin.',
      t.status === 'registration_open' ? 'Register now from the Register Match page!' : '',
    ].filter(Boolean);

    return {
      id: `tournament-${t.id}`,
      type: 'tournament',
      title,
      body: bodyParts.join(' '),
      date: t.start_date,
    };
  });

  const all = [...tournamentAnnouncements, ...STATIC_ANNOUNCEMENTS]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json(all);
}
