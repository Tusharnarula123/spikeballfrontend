"use client";
import React, { useState, useEffect } from 'react';
import {
  Home,
  Trophy,
  History,
  BarChart3,
  Swords,
  UserPlus,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface NavigationItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const navigationItems: NavigationItem[] = [
  { id: 'dashboard',  name: 'Dashboard',      icon: Home,     href: '/dashboard' },
  { id: 'ranking',    name: 'My Ranking',      icon: Trophy,   href: '/dashboard/ranking' },
  { id: 'history',    name: 'Match History',   icon: History,  href: '/dashboard/history' },
  { id: 'analytics',  name: 'Analytics',       icon: BarChart3, href: '/dashboard/analytics' },
  { id: 'submit',     name: 'Submit Score',    icon: Swords,   href: '/dashboard/submit' },
  { id: 'register',   name: 'Register Match',  icon: UserPlus, href: '/dashboard/register' },
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

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const closeMobile = () => {
    if (window.innerWidth < 768) setIsOpen(false);
  };

  return (
    <>
      {/* Mobile hamburger — fixed top-left */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-5 left-5 z-50 p-2.5 rounded-lg bg-[#0a0a0a] shadow-lg md:hidden"
        aria-label="Toggle sidebar"
      >
        {isOpen
          ? <X    className="h-5 w-5 text-[#FFB81C]" />
          : <Menu className="h-5 w-5 text-[#FFB81C]" />}
      </button>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
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
        <div className="flex items-center justify-between p-4 border-b border-[#FFB81C]/20 flex-shrink-0">
          {isCollapsed ? (
            <div className="w-9 h-9 flex items-center justify-center mx-auto">
              <Image src="/logo.svg" alt="OU Roundnet" width={36} height={36} />
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 flex-shrink-0">
                <Image src="/logo.svg" alt="OU Roundnet" width={36} height={36} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-none">OU Roundnet</p>
                <p className="text-[#FFB81C]/50 text-xs mt-0.5">Club Portal</p>
              </div>
            </div>
          )}
          {/* Desktop collapse toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 rounded-md hover:bg-white/10 transition-colors ml-auto"
          >
            {isCollapsed
              ? <ChevronRight className="h-4 w-4 text-white/40" />
              : <ChevronLeft  className="h-4 w-4 text-white/40" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navigationItems.map((item) => {
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
                        ? 'bg-[#FFB81C] text-[#0a0a0a]'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'}
                    `}
                  >
                    <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-[#0a0a0a]' : ''}`} />
                    {!isCollapsed && (
                      <span className={`text-sm ${isActive ? 'font-semibold' : 'font-normal'}`}>
                        {item.name}
                      </span>
                    )}
                    {/* Tooltip when collapsed */}
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
              <LogOut className="h-4.5 w-4.5 flex-shrink-0" />
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
