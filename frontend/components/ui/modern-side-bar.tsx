"use client";
import React, { useState, useEffect } from 'react';
import {
  Home,
  User,
  History,
  BarChart3,
  Swords,
  UserPlus,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Trophy,
  ClipboardCheck,
  Users,
  CalendarRange,
  ImageIcon,
  FileText,
  Award,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const navigationItems: NavigationItem[] = [
  { id: 'dashboard',   name: 'Dashboard',     icon: Home,      href: '/dashboard' },
  { id: 'profile',     name: 'My Profile',    icon: User,      href: '/dashboard/profile' },
  { id: 'history',     name: 'Match History', icon: History,   href: '/dashboard/history' },
  { id: 'analytics',   name: 'Analytics',     icon: BarChart3, href: '/dashboard/analytics' },
  { id: 'submit',      name: 'Submit Score',  icon: Swords,    href: '/dashboard/submit' },
  { id: 'tournaments', name: 'Tournaments',   icon: Trophy,    href: '/dashboard/tournaments' },
  { id: 'register',    name: 'Register',      icon: UserPlus,  href: '/dashboard/register' },
];

const adminNavigationItems: NavigationItem[] = [
  { id: 'admin-members',     name: 'Members',        icon: Users,         href: '/dashboard/admin/members' },
  { id: 'admin-approvals',   name: 'Approve Scores', icon: ClipboardCheck,href: '/dashboard/admin/approvals' },
  { id: 'admin-tournaments', name: 'Tournaments',    icon: Trophy,        href: '/dashboard/admin/tournaments' },
  { id: 'admin-seasons',     name: 'Seasons',        icon: CalendarRange, href: '/dashboard/admin/seasons' },
  { id: 'admin-gallery',     name: 'Gallery',        icon: ImageIcon,     href: '/dashboard/admin/gallery' },
  { id: 'admin-badges',      name: 'Badges',         icon: Award,         href: '/dashboard/admin/badges' },
  { id: 'admin-about',       name: 'About Page',     icon: FileText,      href: '/dashboard/admin/about' },
];

interface SidebarProps {
  className?: string;
  playerName?: string;
  playerInitials?: string;
  playerRole?: string;
  onSignOut?: () => void;
}

export function Sidebar({
  className = '',
  playerName = 'Player',
  playerInitials = 'P',
  playerRole = 'Player',
  onSignOut,
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => {
    const handleResize = () => setIsOpen(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeMobile = () => { if (window.innerWidth < 768) setIsOpen(false); };

  const renderNavGroup = (group: NavigationItem[]) => (
    <ul className="space-y-1">
      {group.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href));
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              onClick={closeMobile}
              title={isCollapsed ? item.name : undefined}
              className={`
                flex items-center rounded-lg transition-all duration-200 group relative
                ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'}
                ${isActive
                  ? 'bg-[#FFB81C] text-[#0a0a0a] shadow-[0_0_18px_rgba(255,184,28,0.25)]'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'}
              `}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-[#0a0a0a]' : ''}`} />
              {!isCollapsed && (
                <span className={`text-sm ${isActive ? 'font-semibold' : 'font-normal'}`}>
                  {item.name}
                </span>
              )}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#1a1a1a] text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 border border-white/10">
                  {item.name}
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Mobile hamburger — only shown to open; closing happens from inside the panel */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-5 left-5 z-50 p-2.5 rounded-lg bg-[#0a0a0a] shadow-lg md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5 text-[#FFB81C]" />
        </button>
      )}

      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar panel */}
      <div
        className={`
          fixed top-0 left-0 h-full bg-[#0a0a0a] border-r border-[#FFB81C]/20 z-40
          transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'w-[72px]' : 'w-[260px]'}
          md:translate-x-0 md:static md:z-auto
          ${className}
        `}
      >
        {/* Logo / brand */}
        <div className="flex items-center p-4 border-b border-[#FFB81C]/20 flex-shrink-0 gap-2">
          {isCollapsed ? (
            <Link href="/" className="w-9 h-9 flex items-center justify-center mx-auto hover:opacity-80 transition-opacity">
              <Image src="/logo.svg" alt="OU Roundnet" width={36} height={36} />
            </Link>
          ) : (
            <Link href="/" className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <div className="w-9 h-9 flex-shrink-0">
                <Image src="/logo.svg" alt="OU Roundnet" width={36} height={36} />
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm leading-none">OU Roundnet</p>
                <p className="text-[#FFB81C]/50 text-xs mt-0.5">Club Portal</p>
              </div>
            </Link>
          )}
          {/* Mobile close — left arrow next to the brand name */}
          {!isCollapsed && (
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden p-1.5 rounded-md hover:bg-white/10 transition-colors ml-auto flex-shrink-0"
              aria-label="Close sidebar"
            >
              <ChevronLeft className="h-5 w-5 text-[#FFB81C]" />
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 rounded-md hover:bg-white/10 transition-colors ml-auto flex-shrink-0"
          >
            {isCollapsed
              ? <ChevronRight className="h-4 w-4 text-white/40" />
              : <ChevronLeft  className="h-4 w-4 text-white/40" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {renderNavGroup(navigationItems)}
          {isAdmin && (
            <>
              {isCollapsed
                ? <div className="my-3 mx-2 border-t border-[#FFB81C]/20" />
                : <p className="px-3 mt-5 mb-2 text-[10px] font-bold tracking-[0.18em] uppercase text-[#FFB81C]/60">Admin</p>}
              {renderNavGroup(adminNavigationItems)}
            </>
          )}
        </nav>

        {/* Player profile + sign out */}
        <div className="border-t border-[#FFB81C]/20 flex-shrink-0">
          <div className="p-3 border-b border-[#FFB81C]/10">
            {isCollapsed ? (
              <div className="flex justify-center">
                <div className="w-9 h-9 bg-[#FFB81C] rounded-full flex items-center justify-center">
                  <span className="text-[#0a0a0a] font-bold text-xs">{playerInitials}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                <div className="w-8 h-8 bg-[#FFB81C] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[#0a0a0a] font-bold text-xs">{playerInitials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{playerName}</p>
                  <p className="text-white/40 text-xs truncate">{playerRole}</p>
                </div>
                <div className="w-2 h-2 bg-green-400 rounded-full ml-auto flex-shrink-0" />
              </div>
            )}
          </div>
          <div className="p-3">
            <button
              onClick={onSignOut}
              title={isCollapsed ? 'Sign Out' : undefined}
              className={`
                w-full flex items-center rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300
                transition-all duration-200 group relative
                ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}
              `}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm">Sign Out</span>}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#1a1a1a] text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 border border-white/10">
                  Sign Out
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
