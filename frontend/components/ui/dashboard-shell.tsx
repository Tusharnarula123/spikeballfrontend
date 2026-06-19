"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/modern-side-bar';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';

// ─── Notification Bell ────────────────────────────────────────────────────────

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  data?: { tournamentId?: string; inviterId?: string; tournamentName?: string } | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationBell() {
  const { fetchApi, isLoaded: authLoaded } = useApi();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    if (!authLoaded) return;
    try {
      const res = await fetchApi('/api/notifications/count');
      if (res.ok) { const { count } = await res.json(); setUnread(count ?? 0); }
    } catch { /* silent */ }
  }, [fetchApi, authLoaded]);

  const loadNotifications = useCallback(async () => {
    if (!authLoaded) return;
    try {
      const res = await fetchApi('/api/notifications?limit=20');
      if (res.ok) setNotifications(await res.json());
    } catch { /* silent */ }
  }, [fetchApi, authLoaded]);

  useEffect(() => { loadCount(); }, [loadCount]);
  useEffect(() => {
    const id = setInterval(loadCount, 60_000);
    return () => clearInterval(id);
  }, [loadCount]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await loadNotifications();
  };

  const markAllRead = async () => {
    await fetchApi('/api/notifications/read-all', { method: 'PATCH' });
    // Clear read notifications out of the list — "mark all read" doubles as
    // "clear the list". Unresponded invites are kept server-side, so reload
    // from the server rather than blindly emptying local state.
    await fetchApi('/api/notifications/read', { method: 'DELETE' });
    setUnread(0);
    await loadNotifications();
  };

  const markOneRead = async (id: string, link?: string) => {
    await fetchApi(`/api/notifications/${id}/read`, { method: 'PATCH' });
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    setUnread(c => Math.max(0, c - 1));
    if (link) window.location.href = link;
  };

  const respondToInvite = async (n: Notification, accept: boolean) => {
    const tournamentId = n.data?.tournamentId;
    const inviterId = n.data?.inviterId;
    if (!tournamentId || !inviterId) return;

    setRespondingId(n.id);
    try {
      const res = await fetchApi(`/api/tournaments/${tournamentId}/${accept ? 'accept-invite' : 'decline-invite'}`, {
        method: 'POST',
        body: JSON.stringify({ inviterId }),
      });
      if (res.ok) {
        // Once acted on, the invite notification has served its purpose —
        // remove it from the list entirely rather than leaving it sitting
        // there with a "✓ accepted" label.
        await fetchApi(`/api/notifications/${n.id}`, { method: 'DELETE' });
        setNotifications(list => list.filter(x => x.id !== n.id));
        if (!n.is_read) setUnread(c => Math.max(0, c - 1));
      }
    } finally {
      setRespondingId(null);
    }
  };

  const deleteNotification = async (n: Notification) => {
    setDeletingId(n.id);
    try {
      const res = await fetchApi(`/api/notifications/${n.id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications(list => list.filter(x => x.id !== n.id));
        if (!n.is_read) setUnread(c => Math.max(0, c - 1));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-gray-500" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FFB81C] text-[#0a0a0a] text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-[#b38200] hover:text-[#e6a418] transition-colors font-semibold"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                <p className="text-gray-400 text-xs">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const isInvite = n.type === 'partner_invite' && !!n.data?.tournamentId && !!n.data?.inviterId;
                const isBusy = respondingId === n.id;
                const isDeleting = deletingId === n.id;

                return (
                  <div
                    key={n.id}
                    className={`group relative w-full text-left px-4 py-3 transition-colors ${!n.is_read ? 'bg-[#fffbf0]' : ''}`}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n); }}
                      disabled={isDeleting}
                      aria-label="Dismiss notification"
                      className="absolute top-2.5 right-3 p-1 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => markOneRead(n.id, isInvite ? undefined : n.link)}
                      className="w-full text-left hover:opacity-80 transition-opacity pr-5"
                    >
                      <div className="flex items-start gap-2.5">
                        {!n.is_read && (
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#FFB81C] flex-shrink-0" />
                        )}
                        <div className={`min-w-0 ${n.is_read ? 'pl-4' : ''}`}>
                          <p className={`text-xs font-semibold leading-snug ${n.is_read ? 'text-gray-400' : 'text-gray-900'}`}>
                            {n.title}
                          </p>
                          <p className="text-gray-400 text-[11px] mt-0.5 leading-snug line-clamp-2">
                            {n.body}
                          </p>
                          <p className="text-gray-300 text-[10px] mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </button>

                    {isInvite && (
                      <div className="mt-2 ml-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); respondToInvite(n, true); }}
                            disabled={isBusy}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FFB81C] text-[#0a0a0a] hover:bg-[#e6a418] transition-colors disabled:opacity-60 flex items-center gap-1"
                          >
                            {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Accept
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); respondToInvite(n, false); }}
                            disabled={isBusy}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-60 flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            Decline
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

/**
 * Shared layout for every /dashboard page: sidebar + sticky header + scroll body.
 */
interface DashboardShellProps {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  roleLabel?: string;
  displayName?: string;
  loading?: boolean;
  width?: 'narrow' | 'default' | 'wide' | 'full';
  children: React.ReactNode;
}

const WIDTHS = {
  narrow: 'max-w-3xl',
  default: 'max-w-4xl',
  wide: 'max-w-5xl',
  full: 'max-w-none',
};

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] gap-3">
      <div className="w-9 h-9 border-2 border-[#FFB81C] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs tracking-widest uppercase text-[#FFB81C]/60">OU Roundnet</p>
    </div>
  );
}

export function DashboardShell({
  title,
  subtitle,
  headerRight,
  roleLabel,
  displayName,
  loading = false,
  width = 'default',
  children,
}: DashboardShellProps) {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  if (!isLoaded || loading) return <PageLoader />;

  const firstName = user?.firstName ?? '';
  const lastName = user?.lastName ?? '';
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || 'P';
  const name = displayName || `${firstName} ${lastName}`.trim() || 'Player';
  const isAdmin = user?.publicMetadata?.role === 'admin';

  return (
    <div className="flex h-screen bg-[#f5f4f0] overflow-hidden">
      <Sidebar
        playerName={name}
        playerInitials={initials}
        playerRole={roleLabel ?? (isAdmin ? 'Admin' : 'Player')}
        onSignOut={() => signOut(() => router.push('/'))}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="relative bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0 shadow-sm">
          {/* Gold brand accent */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#FFB81C] via-[#ffd166] to-transparent" />
          <div className="ml-14 md:ml-0 min-w-0">
            <h1 className="text-xl font-bold text-[#0a0a0a] truncate">{title}</h1>
            {subtitle && <p className="text-sm text-gray-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Notification bell — always visible in header */}
            <NotificationBell />
            {headerRight && headerRight}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className={`${WIDTHS[width]} mx-auto px-6 py-8 space-y-6`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Section heading with the gold icon treatment used across the app. */
export function SectionHeading({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-[#FFB81C] [&>svg]:w-5 [&>svg]:h-5">{icon}</span>
        <h2 className="text-lg font-bold text-[#0a0a0a]">{title}</h2>
      </div>
      {right}
    </div>
  );
}

/** Standard white card. */
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/** Branded empty-state card. */
export function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return (
    <Card className="p-10 text-center">
      {icon && <span className="inline-flex text-gray-300 mb-2 [&>svg]:w-8 [&>svg]:h-8">{icon}</span>}
      <p className="text-sm text-gray-400">{message}</p>
    </Card>
  );
}

/** Small status / info chip. */
export function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${className}`}>
      {children}
    </span>
  );
}
