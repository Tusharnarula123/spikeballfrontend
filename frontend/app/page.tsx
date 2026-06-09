'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { HeroSection } from '@/components/ui/feature-carousel'
import { ContainerScroll } from '@/components/ui/container-scroll-animation'

// ─── Mock Data ────────────────────────────────────────────────────────────────
const LEADERBOARD = [
  { rank: 1, name: 'Alex Carter',   elo: 1482, wins: 18, losses: 3,  gender: 'M' },
  { rank: 2, name: 'Jordan Lee',    elo: 1431, wins: 15, losses: 5,  gender: 'M' },
  { rank: 3, name: 'Taylor Brooks', elo: 1398, wins: 14, losses: 6,  gender: 'F' },
  { rank: 4, name: 'Morgan Shaw',   elo: 1352, wins: 12, losses: 7,  gender: 'F' },
  { rank: 5, name: 'Casey Kim',     elo: 1310, wins: 11, losses: 8,  gender: 'M' },
  { rank: 6, name: 'Riley Evans',   elo: 1278, wins: 10, losses: 9,  gender: 'M' },
  { rank: 7, name: 'Drew Patel',    elo: 1241, wins: 9,  losses: 10, gender: 'F' },
  { rank: 8, name: 'Jamie Nguyen',  elo: 1205, wins: 7,  losses: 11, gender: 'M' },
]

const ANNOUNCEMENTS = [
  {
    id: 1,
    tag: 'Event',
    title: 'Spring Season Kickoff',
    date: 'Jan 15, 2025',
    body: 'Spring season starts this week! All new members need to complete their 5 placement matches to receive a ranking. Sessions are Tuesdays & Thursdays at the Rec Center.',
  },
  {
    id: 2,
    tag: 'Tournament',
    title: 'OU Invitational — Sign Ups Open',
    date: 'Jan 10, 2025',
    body: 'Our annual invitational is back. Register your 2v2 team by February 1st. Open to OU students and alumni. Cash prizes for top 3 teams.',
  },
  {
    id: 3,
    tag: 'Update',
    title: 'ELO System Now Live',
    date: 'Jan 5, 2025',
    body: 'Our new ELO ranking system is live. Rankings update in real time after every match. Check your profile to see your current ELO and season stats.',
  },
]

// ─── Scroll reveal hook ───────────────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.animate-on-scroll')
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) }
      }),
      { threshold: 0.12 }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
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
      <div className="mt-10 flex gap-4 animate-fade-in" style={{ animationDelay: '0.7s', opacity: 0 }}>
        <a href="#rankings"
          className="px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
          View Rankings
        </a>
        <a href="#about"
          className="px-6 py-3 rounded-xl font-medium text-sm border border-gray-200 text-gray-600 transition-all duration-200 hover:border-gray-900 hover:text-gray-900">
          About Us
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

  const filtered = LEADERBOARD.filter(p => {
    if (filter === 'Men') return p.gender === 'M'
    if (filter === 'Women') return p.gender === 'F'
    return true
  })

  return (
    <section className="bg-white overflow-hidden">
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
                <p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#FFB81C' }}>Season 2025</p>
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

            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#0a0a0a' }}>
                  {['Rank', 'Player', 'ELO', 'Record', 'Ratio'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 5).map((p) => (
                  <tr key={p.rank} className="border-t border-gray-50 hover:bg-[#fffbf0] transition-colors">
                    <td className="px-4 py-2.5 font-bold text-xs">
                      {p.rank <= 3 ? ['🥇','🥈','🥉'][p.rank - 1] : <span className="text-gray-400">#{p.rank}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: '#0a0a0a', color: '#FFB81C' }}>
                          {p.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-xs" style={{ color: '#FFB81C' }}>{p.elo}</td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="text-green-600 font-medium">{p.wins}W</span>
                      <span className="text-gray-300 mx-1">–</span>
                      <span className="text-red-400 font-medium">{p.losses}L</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-medium">
                      {(p.wins / (p.wins + p.losses) * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ContainerScroll>
    </section>
  )
}

// ─── About ────────────────────────────────────────────────────────────────────
function About() {
  const stats = [
    { value: '2020', label: 'Founded' },
    { value: '40+',  label: 'Members' },
    { value: '3',    label: 'Seasons' },
    { value: '200+', label: 'Matches Played' },
  ]

  return (
    <section id="about" className="py-24 px-6 bg-white">
      <div className="max-w-4xl mx-auto">

        <div className="animate-on-scroll mb-12 text-center">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#FFB81C' }}>Who We Are</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">About Us</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* Text */}
          <div className="animate-on-scroll space-y-5 text-gray-500 leading-relaxed">
            <p>
              The <span className="text-gray-900 font-medium">Oakland University Roundnet Club</span> was
              founded in 2020 by a group of students passionate about the sport of roundnet (Spikeball).
            </p>
            <p>
              We are a student-run club officially recognized by{' '}
              <span className="text-gray-900 font-medium">Oakland University Campus Recreation</span>,
              operating under OU Student Organizations.
            </p>
            <p>
              We compete in local and regional tournaments and are affiliated with{' '}
              <span className="text-gray-900 font-medium">USA Roundnet</span>, the national governing body for the sport.
            </p>
            <p>
              Beginner or experienced — everyone is welcome. We run structured competitive sessions
              with live ELO rankings alongside open casual play.
            </p>

            <div className="flex gap-3 pt-2">
              <a href="mailto:ouroundnet@oakland.edu"
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 transition-all hover:border-gray-900 hover:text-gray-900">
                Contact Us
              </a>
              <Link href="/signup"
                className="text-sm px-4 py-2 rounded-lg font-medium transition-all hover:scale-105"
                style={{ backgroundColor: '#FFB81C', color: '#0a0a0a' }}>
                Join the Club
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="animate-on-scroll grid grid-cols-2 gap-4">
            {stats.map(({ value, label }) => (
              <div key={label}
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
  const tagColors = {
    Event:      { bg: 'rgba(255,184,28,0.1)',   text: '#c98a00' },
    Tournament: { bg: 'rgba(99,102,241,0.08)',  text: '#6366f1' },
    Update:     { bg: 'rgba(34,197,94,0.08)',   text: '#16a34a' },
  }

  return (
    <section id="announcements" className="py-24 px-6" style={{ backgroundColor: '#f9f9f9' }}>
      <div className="max-w-4xl mx-auto">

        <div className="animate-on-scroll mb-12 text-center">
          <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#FFB81C' }}>Stay Updated</p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Announcements</h2>
        </div>

        <div className="space-y-4">
          {ANNOUNCEMENTS.map((a, i) => (
            <div key={a.id}
              className="animate-on-scroll bg-white rounded-2xl p-6 border border-gray-100 transition-all duration-200 hover:border-gray-200 hover:shadow-sm cursor-pointer group"
              style={{ transitionDelay: `${i * 0.1}s` }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: tagColors[a.tag]?.bg, color: tagColors[a.tag]?.text }}>
                      {a.tag}
                    </span>
                    <span className="text-xs text-gray-400">{a.date}</span>
                  </div>
                  <h3 className="text-gray-900 font-semibold mb-2 group-hover:text-[#FFB81C] transition-colors">{a.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{a.body}</p>
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
const GALLERY_IMAGES = [
  {
    src: 'https://images.unsplash.com/photo-1526401281623-3c84a9a22be4?w=800&auto=format&fit=crop&q=80',
    alt: 'Players competing in roundnet',
  },
  {
    src: 'https://images.unsplash.com/photo-1607962837359-5e7e89f86776?w=800&auto=format&fit=crop&q=80',
    alt: 'Outdoor spikeball session on campus',
  },
  {
    src: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&auto=format&fit=crop&q=80',
    alt: 'Team huddle at tournament',
  },
  {
    src: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80',
    alt: 'Club members at OU Invitational',
  },
  {
    src: 'https://images.unsplash.com/photo-1530915534664-4ac6423a5b26?w=800&auto=format&fit=crop&q=80',
    alt: 'Competitive match in action',
  },
]

function Gallery() {
  return (
    <section id="gallery" className="bg-white">
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-4 animate-on-scroll text-center">
        <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: '#FFB81C' }}>Club Life</p>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Gallery</h2>
      </div>
      <HeroSection
        title="Life at OU Roundnet"
        subtitle="From weekly sessions to tournaments — here's a glimpse of our club in action."
        images={GALLERY_IMAGES}
        className="animate-on-scroll pt-0"
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
          <a href="mailto:ouroundnet@oakland.edu" className="hover:text-[#FFB81C] transition-colors">Contact</a>
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
