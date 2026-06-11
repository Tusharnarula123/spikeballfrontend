"use client";

import React from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/ui/modern-side-bar';

/**
 * Shared layout for every /dashboard page: sidebar + sticky header + scroll body.
 * Handles Clerk loading state, sign-out, and the player identity shown in the
 * sidebar so individual pages only worry about their own content.
 */
interface DashboardShellProps {
  title: string;
  subtitle?: string;
  /** Small chip / actions rendered on the right side of the header. */
  headerRight?: React.ReactNode;
  /** Label under the player's name in the sidebar (e.g. "Admin", "Rank #3"). */
  roleLabel?: string;
  /** Overrides the Clerk-derived display name (e.g. from the players table). */
  displayName?: string;
  /** Page is still fetching its own data — show the branded loader. */
  loading?: boolean;
  /** Max width of the content column. */
  width?: 'narrow' | 'default' | 'wide';
  children: React.ReactNode;
}

const WIDTHS = {
  narrow: 'max-w-3xl',
  default: 'max-w-4xl',
  wide: 'max-w-5xl',
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
          {headerRight && <div className="flex items-center gap-2 flex-shrink-0">{headerRight}</div>}
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
