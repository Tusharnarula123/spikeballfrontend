'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { HeroSection } from '@/components/ui/feature-carousel'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'
import { apiFetch } from '@/lib/api'

// lucide-react dropped brand icons (trademark reasons) — inline SVGs instead
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.42a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.42 8.6.42 8.6.42s6.88 0 8.6-.42a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
  )
}
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.955 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z" />
    </svg>
  )
}

// Types 
interface LeaderboardEntry {
  rank: number
  player_id: string
  display_name: string
  current_elo: number
  wins: number
  losses: number
  total_matches: number
  win_rate: number
  gender?: string
}

interface Announcement {
  id: string;
  type: 'tournament' | 'update' | 'event' | 'general';
  title: string;
  body: string;
  date: string;
}

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) }
      }),
      { threshold: 0.12 }
    )

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el))

    // Sections like Announcements/Gallery render their cards after an async
    // fetch resolves, i.e. after this effect's initial querySelectorAll already
    // ran — those late-added elements would otherwise never get observed and
    // stay permanently invisible (opacity: 0). Watch the DOM for any
    // .animate-on-scroll nodes added later and observe them too.
    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return
          if (node.matches('.animate-on-scroll')) observer.observe(node)
          node.querySelectorAll?.('.animate-on-scroll').forEach(el => observer.observe(el))
        })
      }
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    return () => { observer.disconnect(); mutationObserver.disconnect() }
  }, [])
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo + Name */}
        <a href="#hero" className="flex items-center gap-3 group">
          <Image src="/logo.svg" alt="OU Roundnet" width={36} height={36}
            className="transition-transform duration-300 group-hover:scale-110" />
          <span className="font-semibold text-gray-900 tracking-wide text-sm">
            OU <span style={{ color: '#FFB81C' }}>Roundnet</span>
          </span>
        </a>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
          {[['Rankings', '#rankings'], ['About', '#about'], ['Announcements', '#announcements'], ['Gallery', '#gallery']].map(([label, href]) => (
            <a key={label} href={href}
              className="hover:text-gray-900 transition-colors duration-200 hover:text-[#FFB81C]">
              {label}
            </a>
          ))}
        </div>

        {/* Auth buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors px-4 py-2 rounded-lg hover:bg-gray-50">
            Log in
          </Link>
          <Link href="/signup"
            className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
            Sign up
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden text-gray-500 hover:text-gray-900" onClick={() => setMenuOpen(!menuOpen)}>
          <div className={`w-5 h-0.5 bg-current mb-1.5 transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <div className={`w-5 h-0.5 bg-current mb-1.5 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <div className={`w-5 h-0.5 bg-current transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4 shadow-sm">
          {[['Rankings', '#rankings'], ['About', '#about'], ['Announcements', '#announcements'], ['Gallery', '#gallery']].map(([label, href]) => (
            <a key={label} href={href} className="text-gray-500 hover:text-gray-900 text-sm"
              onClick={() => setMenuOpen(false)}>{label}</a>
          ))}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Link href="/login" className="flex-1 text-center text-sm py-2 border border-gray-200 rounded-lg text-gray-600">
              Log in
            </Link>
            <Link href="/signup" className="flex-1 text-center text-sm py-2 rounded-lg font-medium"
              style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
              Sign up
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="hero" className="min-h-screen flex flex-col items-center justify-center relative px-6 overflow-hidden bg-white">
      {/* Subtle gold radial hint */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 55% 45% at 50% 40%, rgba(255,184,28,0.06) 0%, transparent 70%)'
      }} />

      {/* Logo */}
      <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <Image
          src="/logo.svg"
          alt="Oakland University Roundnet Club"
          width={220}
          height={220}
          className="drop-shadow-md"
          priority
        />
      </div>

      {/* Text */}
      <div className="mt-8 text-center animate-fade-in" style={{ animationDelay: '0.4s', opacity: 0 }}>
        <p className="text-xs font-medium tracking-[0.3em] uppercase mb-3" style={{ color: '#FFB81C' }}>
          Oakland University · Est. 2020
        </p>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight mb-4">
          Roundnet Club
        </h1>
        <p className="text-gray-500 text-lg max-w-md mx-auto leading-relaxed">
          Compete. Improve. Rank up.
        </p>
      </div>

      {/* CTAs */}
      <div id="connect" className="mt-10 flex flex-wrap items-stretch justify-center gap-3 sm:gap-4 animate-fade-in" style={{ animationDelay: '0.7s', opacity: 0 }}>
        <a href="https://www.instagram.com/ouroundnet?igsh=MTdiN3BlNXc1c3FkNw%3D%3D"
          target="_blank" rel="noopener noreferrer"
          className="h-12 px-3 sm:px-6 rounded-xl font-medium text-sm border-2 border-transparent box-border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
          style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
          <InstagramIcon className="h-4 w-4 flex-shrink-0" />
          Instagram
        </a>
        <a href="https://www.youtube.com/@spikeball-p7w5s"
          target="_blank" rel="noopener noreferrer"
          className="h-12 px-3 sm:px-6 rounded-xl font-medium text-sm border-2 border-gray-200 text-gray-600 box-border transition-all duration-200 hover:border-gray-900 hover:text-gray-900 flex items-center justify-center gap-2 whitespace-nowrap">
          <YoutubeIcon className="h-4 w-4 flex-shrink-0" />
          YouTube
        </a>
        <a href="https://discord.com/invite/Fdvfg26dBs"
          target="_blank" rel="noopener noreferrer"
          className="h-12 px-3 sm:px-6 rounded-xl font-medium text-sm border-2 border-transparent box-border transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
          style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
          <DiscordIcon className="h-4 w-4 flex-shrink-0" />
          Discord
        </a>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-10 flex flex-col items-center gap-2 animate-fade-in" style={{ animationDelay: '1.2s', opacity: 0 }}>
        <span className="text-xs text-gray-400 tracking-widest uppercase">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-gray-300 to-transparent animate-pulse" />
      </div>
    </section>
  )
}

// ─── Scroll Preview ───────────────────────────────────────────────────────────
function ScrollPreview() {
  const [filter, setFilter] = useState('All')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [seasonName, setSeasonName] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(() => setLeaderboard([]))
  }, [])

  // Active season name — same source as the dashboard leaderboard
  useEffect(() => {
    apiFetch('/api/seasons/active')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.season?.name) setSeasonName(data.season.name) })
      .catch(() => {})
  }, [])

  const filtered = leaderboard.filter(p => {
    if (filter === 'Men')   return p.gender === 'male'
    if (filter === 'Women') return p.gender === 'female'
    return true
  })

  return (
    <section id="rankings" className="bg-white overflow-hidden">
      <ContainerScroll
        titleComponent={
          <div className="space-y-3 mb-10">
            <p className="text-xs font-medium tracking-[0.3em] uppercase" style={{ color: '#FFB81C' }}>
              Oakland University · Est. 2020
            </p>
            <h2 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
              Play. Compete.{' '}
              <span className="inline-block px-3 py-1 rounded-xl" style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
                Rank up.
              </span>
            </h2>
            <p className="text-gray-500 text-base max-w-lg mx-auto leading-relaxed">
              Live ELO rankings, match history, and player stats — all in one place.
            </p>
          </div>
        }
      >
        {/* Leaderboard preview inside the card */}
        <div className="w-full h-full flex flex-col">
          {/* Traffic light bar — no URL */}
          <div className="flex items-center px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
          </div>

          {/* Leaderboard content */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#FFB81C' }}>{seasonName ?? 'Leaderboard'}</p>
                <h3 className="text-xl font-bold text-gray-900">Leaderboard</h3>
              </div>
              {/* Functional filter buttons */}
              <div className="flex gap-2">
                {['All', 'Men', 'Women'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="text-xs px-3 py-1 rounded-full border transition-all duration-200"
                    style={{
                      borderColor: filter === f ? '#FFB81C' : '#e5e5e5',
                      color: filter === f ? '#FFB81C' : '#888',
                      backgroundColor: filter === f ? 'rgba(255,184,28,0.08)' : 'transparent',
                    }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr style={{ backgroundColor: '#0a0a0a' }}>
                    {['Rank', 'Player', 'ELO', 'Record', 'Ratio'].map(h => (
                      <th key={h} className="px-2.5 sm:px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: '#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">
                        No ranked players yet — be the first to complete your placement matches!
                      </td>
                    </tr>
                  ) : filtered.slice(0, 5).map((p) => (
                    <tr key={p.player_id} className="border-t border-gray-50 hover:bg-[#fffbf0] transition-colors">
                      <td className="px-2.5 sm:px-4 py-2.5 font-bold text-xs whitespace-nowrap">
                        {p.rank <= 3 ? ['🥇','🥈','🥉'][p.rank - 1] : <span className="text-gray-400">#{p.rank}</span>}
                      </td>
                      <td className="px-2.5 sm:px-4 py-2.5 max-w-[140px] sm:max-w-none">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: '#0a0a0a', color: '#FFB81C' }}>
                            {(p.display_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900 text-xs truncate">{p.display_name}</span>
                        </div>
                      </td>
                      <td className="px-2.5 sm:px-4 py-2.5 font-bold text-xs whitespace-nowrap" style={{ color: '#FFB81C' }}>{p.current_elo}</td>
                      <td className="px-2.5 sm:px-4 py-2.5 text-xs whitespace-nowrap">
                        <span className="text-green-600 font-medium">{p.wins}W</span>
                        <span className="text-gray-300 mx-1">–</span>
                        <span className="text-red-400 font-medium">{p.losses}L</span>
                      </td>
                      <td className="px-2.5 sm:px-4 py-2.5 text-xs text-gray-500 font-medium whitespace-nowrap">
                        {p.total_matches > 0 ? Math.round(p.win_rate) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ContainerScroll>
    </section>
  )
}

// ─── About ────────────────────────────────────────────────────────────────────
interface AboutStat {
  value: string
  label: string
}

interface AboutContent {
  eyebrow: string
  heading: string
  paragraphs: string[]
  stats: AboutStat[]
}

// Mirrors the previous hardcoded copy — used until the API responds (or if it's unreachable).
const DEFAULT_ABOUT: AboutContent = {
  eyebrow: 'Who We Are',
  heading: 'About Us',
  paragraphs: [
    'The Oakland University Roundnet Club was founded in 2020 by a group of students passionate about the sport of roundnet (Spikeball).',
    'We are a student-run club officially recognized by Oakland University Campus Recreation, operating under OU Student Organizations.',
    'We compete in local and regional tournaments and are affiliated with USA Roundnet, the national governing body for the sport.',
    'Beginner or experienced — everyone is welcome. We run structured competitive sessions with live ELO rankings alongside open casual play.',
  ],
  stats: [
    { value: '2020', label: 'Founded' },
    { value: '40+',  label: 'Members' },
    { value: '3',    label: 'Seasons' },
    { value: '200+', label: 'Matches Played' },
  ],
}

function About() {
  const [content, setContent] = useState<AboutContent>(DEFAULT_ABOUT)

  useEffect(() => {
    apiFetch('/api/about')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setContent({
          eyebrow: data.eyebrow || DEFAULT_ABOUT.eyebrow,
          heading: data.heading || DEFAULT_ABOUT.heading,
          paragraphs: Array.isArray(data.paragraphs) && data.paragraphs.length ? data.paragraphs : DEFAULT_ABOUT.paragraphs,
          stats: Array.isArray(data.stats) && data.stats.length ? data.stats : DEFAULT_ABOUT.stats,
        })
      })
      .catch(() => {})
  }, [])

  return (
    <section id="about" className="py-24 px-6 bg-white">
      <div className="max-w-4xl mx-auto">

        <div className="animate-on-scroll mb-12 text-center">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#FFB81C' }}>{content.eyebrow}</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">{content.heading}</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* Text */}
          <div className="animate-on-scroll space-y-5 text-gray-500 leading-relaxed">
            {content.paragraphs.map((p, i) => (
              <p key={i} className="text-justify">{p}</p>
            ))}
          </div>

          {/* Stats */}
          <div className="animate-on-scroll grid grid-cols-2 gap-4">
            {content.stats.map(({ value, label }, i) => (
              <div key={`${label}-${i}`}
                className="rounded-2xl p-6 border border-gray-100 text-center transition-all duration-200 hover:border-[#FFB81C]/40 hover:shadow-sm bg-white">
                <div className="text-3xl font-bold mb-1" style={{ color: '#FFB81C' }}>{value}</div>
                <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Announcements ────────────────────────────────────────────────────────────
function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    apiFetch('/api/announcements')
      .then(r => r.ok ? r.json() : [])
      .then(data => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const tagColors: Record<string, { bg: string; text: string }> = {
    tournament: { bg: 'rgba(99,102,241,0.08)',  text: '#6366f1' },
    update:     { bg: 'rgba(34,197,94,0.08)',   text: '#16a34a' },
    event:      { bg: 'rgba(255,184,28,0.1)',   text: '#c98a00' },
    general:    { bg: 'rgba(156,163,175,0.12)', text: '#6b7280' },
  }

  return (
    <section id="announcements" className="py-24 px-6" style={{ backgroundColor: '#f9f9f9' }}>
      <div className="max-w-4xl mx-auto">

        <div className="animate-on-scroll mb-12 text-center">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#FFB81C' }}>Stay Updated</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Announcements</h2>
        </div>

        <div className="space-y-4">
          {announcements.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No announcements right now — check back soon.</p>
          ) : announcements.map((a, i) => (
            <div key={a.id}
              className="animate-on-scroll bg-white rounded-2xl p-6 border border-gray-100 transition-all duration-200 hover:border-gray-200 hover:shadow-sm cursor-pointer group"
              style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: tagColors[a.type]?.bg, color: tagColors[a.type]?.text }}>
                      {a.type.charAt(0).toUpperCase() + a.type.slice(1)}
                    </span>
                    {a.type === 'tournament' && (
                      <span className="text-xs text-gray-400">
                        {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  <h3 className="text-gray-900 font-semibold mb-2 group-hover:text-[#FFB81C] transition-colors">{a.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed text-justify">{a.body}</p>
                </div>
                <span className="text-gray-300 group-hover:text-[#FFB81C] transition-colors text-lg mt-1">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Gallery ──────────────────────────────────────────────────────────────────
function Gallery() {
  const [images, setImages] = useState<{ src: string; alt: string }[]>([]);

  useEffect(() => {
    apiFetch('/api/gallery')
      .then(r => r.ok ? r.json() : [])
      .then((data: { url: string; alt_text: string }[]) => {
        setImages(Array.isArray(data) ? data.map(img => ({ src: img.url, alt: img.alt_text })) : []);
      })
      .catch(() => {});
  }, []);

  if (images.length === 0) return null;

  return (
    <section id="gallery" className="bg-white">
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-4 text-center">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#FFB81C' }}>Club Life</p>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Gallery</h2>
      </div>
      <HeroSection
        title="Life at OU Roundnet"
        subtitle="From weekly sessions to tournaments — here's a glimpse of our club in action."
        images={images}
        className="pt-0"
      />
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-gray-100 py-10 px-6 bg-white">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src="/logo.svg" alt="OU Roundnet" width={28} height={28} />
          <span className="text-sm text-gray-400">Oakland University Roundnet Club · Est. 2020</span>
        </div>
        <div className="flex gap-6 text-sm text-gray-400">
          <a href="#rankings" className="hover:text-[#FFB81C] transition-colors">Rankings</a>
          <a href="#about"    className="hover:text-[#FFB81C] transition-colors">About</a>
          <a href="#connect" className="hover:text-[#FFB81C] transition-colors">Connect</a>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  useScrollReveal()
  return (
    <main>
      <Navbar />
      <Hero />
      <ScrollPreview />
      <About />
      <Announcements />
      <Gallery />
      <Footer />
    </main>
  )
}
