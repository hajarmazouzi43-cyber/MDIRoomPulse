'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Zap, Bell, BarChart3, ArrowRight } from 'lucide-react'

/**
 * Reveal — fades + lifts children in once they enter the viewport.
 * Respects prefers-reduced-motion via the .reveal-up CSS rule in globals.css.
 */
function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`reveal-up ${visible ? 'in-view' : ''} ${className}`}>
      {children}
    </div>
  )
}

type RoomStatus = 'available' | 'occupied'

interface RoomNode {
  id: string
  code: string
  x: number
  y: number
  w: number
  h: number
  delay: number
}

const ROOMS: RoomNode[] = [
  { id: 'a1', code: 'A1', x: 24, y: 24, w: 140, h: 100, delay: 1 },
  { id: 'a2', code: 'A2', x: 184, y: 24, w: 140, h: 100, delay: 2 },
  { id: 'a3', code: 'A3', x: 344, y: 24, w: 132, h: 100, delay: 3 },
  { id: 'b1', code: 'B1', x: 24, y: 148, w: 172, h: 120, delay: 4 },
  { id: 'b2', code: 'B2', x: 216, y: 148, w: 130, h: 120, delay: 5 },
  { id: 'b3', code: 'B3', x: 366, y: 148, w: 110, h: 120, delay: 6 },
]

const ROOM_COLORS: Record<string, string> = {
  a1: '#7C5CFC',
  a2: '#14B8A6',
  a3: '#F5A623',
  b1: '#FF6F61',
  b2: '#7C5CFC',
  b3: '#14B8A6',
}

/**
 * BlueprintHero — the signature element. A live floor plan that draws itself
 * in on load, then genuinely cycles room availability, standing in for what
 * the product actually does rather than decorating around it.
 */
function BlueprintHero() {
  const [statuses, setStatuses] = useState<Record<string, RoomStatus>>({
    a1: 'available',
    a2: 'occupied',
    a3: 'available',
    b1: 'available',
    b2: 'occupied',
    b3: 'available',
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setStatuses((prev) => {
        const ids = Object.keys(prev)
        const pick = ids[Math.floor(Math.random() * ids.length)]
        return {
          ...prev,
          [pick]: prev[pick] === 'available' ? 'occupied' : 'available',
        }
      })
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full max-w-[500px] mx-auto">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <svg viewBox="0 0 500 468" className="relative w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="sweepGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C5CFC" stopOpacity="0" />
            <stop offset="50%" stopColor="#7C5CFC" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7C5CFC" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Corridor spine connecting the rooms, like a real floor plan */}
        <line x1="250" y1="14" x2="250" y2="278" stroke="#D8D5E0" strokeWidth="1.5" strokeDasharray="3 5" />
        <line x1="14" y1="88" x2="486" y2="88" stroke="#D8D5E0" strokeWidth="1.5" strokeDasharray="3 5" />

        {/* Radar-style scan sweep */}
        <rect x="10" y="0" width="480" height="60" fill="url(#sweepGradient)" className="scan-sweep" />

        {ROOMS.map((room) => {
          const status = statuses[room.id]
          const roomColor = ROOM_COLORS[room.id]
          const cx = room.x + room.w / 2
          const cy = room.y + room.h / 2
          const doorW = 46
          const doorH = 62
          const dx = cx - doorW / 2
          const dy = cy - doorH / 2 + 6
          const isOpen = status === 'available'

          return (
            <g key={room.id} className={`buddy-bob delay-${room.delay}`}>
              {/* frame */}
              <rect
                x={dx - 6}
                y={dy - 6}
                width={doorW + 12}
                height={doorH + 6}
                rx={8}
                fill="#FFFFFF"
                stroke={roomColor}
                strokeWidth="2"
                className={`room-outline delay-${room.delay}`}
              />

              {/* door leaf, swings open on a hinge when available */}
              <g
                style={{
                  transform: isOpen ? 'rotateY(0deg) skewX(-18deg) translateX(2px)' : 'none',
                  transformOrigin: `${dx}px ${dy + doorH}px`,
                  transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <rect
                  x={dx}
                  y={dy}
                  width={doorW}
                  height={doorH}
                  rx={5}
                  fill={roomColor}
                  fillOpacity={isOpen ? 0.16 : 0.28}
                  className="transition-all duration-500"
                />

                {/* eyes */}
                <circle cx={cx - 9} cy={dy + 22} r={3.2} fill="#1A1A2E" className={`buddy-blink delay-${room.delay}`} />
                <circle cx={cx + 9} cy={dy + 22} r={3.2} fill="#1A1A2E" className={`buddy-blink delay-${room.delay}`} />

                {/* mouth: smile when available, flat when occupied */}
                {isOpen ? (
                  <path d={`M ${cx - 9} ${dy + 34} Q ${cx} ${dy + 44} ${cx + 9} ${dy + 34}`} fill="none" stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <line x1={cx - 8} y1={dy + 38} x2={cx + 8} y2={dy + 38} stroke="#1A1A2E" strokeWidth="2" strokeLinecap="round" />
                )}

                {/* doorknob */}
                <circle cx={dx + doorW - 8} cy={dy + doorH / 2 + 6} r={2.4} fill="#1A1A2E" />
              </g>

              {/* "occupied" door-hanger tag */}
              {!isOpen && (
                <g className="hanger-swing" style={{ transformOrigin: `${dx + doorW - 8}px ${dy + doorH / 2 - 4}px` }}>
                  <rect
                    x={dx + doorW - 18}
                    y={dy + doorH / 2 - 2}
                    width={26}
                    height={14}
                    rx={3}
                    fill="#F43F5E"
                  />
                  <text
                    x={dx + doorW - 5}
                    y={dy + doorH / 2 + 8}
                    fontSize="7"
                    fontWeight={700}
                    fill="#fff"
                    textAnchor="middle"
                    className="font-tech"
                  >
                    occ.
                  </text>
                </g>
              )}

              <text
                x={cx}
                y={dy + doorH + 18}
                textAnchor="middle"
                className="font-tech"
                fontSize="12"
                fill="#1A1A2E"
                fontWeight={600}
              >
                {room.code}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="relative mt-2 flex items-center justify-center gap-6 font-tech text-xs text-[#6B6B7A]">
        <span className="flex items-center gap-1.5">🙂 disponible</span>
        <span className="flex items-center gap-1.5">😐 occupée</span>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    plaque: 'SALLE A · TEMPS RÉEL',
    icon: Zap,
    title: 'Statut instantané',
    desc: "Le statut de chaque salle se met à jour à la seconde où elle se libère ou s'occupe.",
    color: '#7C5CFC',
  },
  {
    plaque: 'SALLE B · ALERTES',
    icon: Bell,
    title: 'Notifications ciblées',
    desc: 'Un e-mail ou un SMS part automatiquement aux personnes abonnées à une salle.',
    color: '#14B8A6',
  },
  {
    plaque: 'SALLE C · STATISTIQUES',
    icon: BarChart3,
    title: "Taux d'occupation",
    desc: "Des tableaux de bord clairs pour repérer les salles sous-utilisées et celles saturées.",
    color: '#F5A623',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] text-[#1A1A2E]">
      <header className="border-b border-[#E7E5EC] bg-[#F5F7FA]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="font-display text-xl font-bold tracking-tight text-[#7C5CFC]">
            MDI RoomPulse
          </h1>
          <div className="space-x-3">
            <Link href="/login">
              <Button variant="outline" className="border-[#DAD7E3]">Se connecter</Button>
            </Link>
            <Link href="/login?signup=true">
              <Button className="bg-[#7C5CFC] hover:bg-[#6242D6]">Créer un compte</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden blueprint-grid-bg">
          <div className="max-w-7xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="hero-fade-in d1 inline-block font-tech text-xs tracking-[0.2em] uppercase text-[#7C5CFC] bg-white border border-[#DAD7E3] rounded-full px-3 py-1 mb-6">
                Suivi en temps réel
              </span>
              <h2 className="hero-fade-in d2 font-display text-4xl md:text-6xl font-bold leading-[1.05] mb-6">
                Vos salles de réunion,<br />
                <span className="text-[#7C5CFC]">visibles en un coup d&rsquo;œil</span>
              </h2>
              <p className="hero-fade-in d3 text-lg text-[#6B6B7A] max-w-lg mb-10">
                Visualisez la disponibilité de chaque salle, recevez une alerte dès qu&rsquo;un espace se libère,
                et suivez l&rsquo;usage réel de vos locaux.
              </p>
              <div className="hero-fade-in d4 flex flex-col sm:flex-row gap-4">
                <Link href="/login">
                  <Button size="lg" className="text-base px-8 bg-[#7C5CFC] hover:bg-[#6242D6] group">
                    Commencer
                    <ArrowRight className="ml-1.5 w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button size="lg" variant="outline" className="text-base px-8 border-[#DAD7E3]">
                    Voir les salles
                  </Button>
                </Link>
              </div>
            </div>

            <BlueprintHero />
          </div>
        </section>

        {/* FEATURE PLAQUES */}
        <section className="max-w-7xl mx-auto px-6 py-20">
          <Reveal>
            <h3 className="font-display text-2xl font-bold mb-10 text-center">
              Ce que RoomPulse change au quotidien
            </h3>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} className={`delay-[${i * 100}ms]`}>
                <div
                  className="plaque-hover bg-white border border-[#E7E5EC] rounded-xl p-7 h-full"
                  style={{ ['--plaque-color' as string]: f.color }}
                >
                  <div
                    className="font-tech text-[11px] tracking-[0.15em] uppercase mb-5"
                    style={{ color: f.color }}
                  >
                    {f.plaque}
                  </div>
                  <f.icon className="w-7 h-7 mb-4" strokeWidth={1.75} style={{ color: f.color }} />
                  <h4 className="font-display font-semibold text-lg mb-2">{f.title}</h4>
                  <p className="text-sm text-[#6B6B7A] leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA STRIP */}
        <section className="border-y border-[#E7E5EC] bg-white">
          <div className="max-w-7xl mx-auto px-6 py-16 text-center">
            <Reveal>
              <h3 className="font-display text-2xl md:text-3xl font-bold mb-4">
                Prêt à voir vos salles autrement ?
              </h3>
              <p className="text-[#6B6B7A] mb-8 max-w-xl mx-auto">
                Créez un compte en une minute et connectez votre première salle.
              </p>
              <Link href="/login?signup=true">
                <Button size="lg" className="text-base px-8 bg-[#7C5CFC] hover:bg-[#6242D6]">
                  Créer un compte gratuitement
                </Button>
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E7E5EC]">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-sm text-[#6B6B7A]">
          © 2026 MDI RoomPulse — ENSA Berrechid
        </div>
      </footer>
    </div>
  )
}