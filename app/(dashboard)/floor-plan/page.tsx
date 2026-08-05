'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type RoomStatus = 'free' | 'occupied' | 'maintenance'

interface Room {
  id: string
  name: string
  capacity: number
  equipment: string[]
  location: string
  category: string
  status: RoomStatus
  is_occupied: boolean
  occupied_by: string | null
  occupied_at: string | null
  created_at: string
  updated_at: string
  max_people?: number
  current_people?: number
  room_email?: string
}

const statusColors: Record<RoomStatus, string> = {
  free: '#22c55e',
  occupied: '#ef4444',
  maintenance: '#f59e0b',
}

// Note: statusLabels ci-dessous est remplacé par la fonction getStatusLabels(t) plus bas,
// qui traduit dynamiquement selon la langue active.

export default function FloorPlanPage() {
  // ✅ Traduction réactive via le contexte client (se met à jour instantanément)
  const { t } = useLanguage()

  const [rooms, setRooms] = useState<Room[] | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const fetchRooms = async () => {
      const { data } = await supabase.from('rooms').select('*').order('name')
      setRooms(data as Room[] | null)
    }

    fetchRooms()

    // Optionnel : rester synchronisé en temps réel avec les changements de salle
    const channel = supabase
      .channel('floor-plan-rooms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, fetchRooms)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const ceo = rooms?.find((r: Room) => r.category === 'bureau')
  const reunion = rooms?.find((r: Room) => r.category === 'reunion')
  const postes = rooms?.filter((r: Room) => r.category === 'poste') || []
  const detente = rooms?.find((r: Room) => r.category === 'detente')

  const totalRooms = rooms?.length || 0
  const occupiedCount = rooms?.filter((r: Room) => r.is_occupied).length || 0
  const freeCount = totalRooms - occupiedCount

  const occupancyLabel = (room?: Room) => {
    if (!room) return null
    if (room.max_people && typeof room.current_people === 'number') {
      return `${room.current_people}/${room.max_people} ${t('floorPlan.people')}`
    }
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 dark:from-slate-950 dark:via-gray-950 dark:to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <span className="text-4xl">🏢</span>
              {t('floorPlan.title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {t('floorPlan.subtitle')} · {totalRooms} {t('floorPlan.spaces')} · {freeCount} {t('floorPlan.free')} · {occupiedCount} {t('floorPlan.occupiedStatusText')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 p-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('floorPlan.legend')}:</span>
            {(['free', 'occupied', 'maintenance'] as RoomStatus[]).map((key) => (
              <span key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ background: statusColors[key] }}
                ></span>
                {key === 'free' ? t('floorPlan.available') : key === 'occupied' ? t('floorPlan.occupied') : t('floorPlan.maintenance')}
              </span>
            ))}
          </div>
        </div>

        <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 dark:bg-slate-800/90 px-6 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-sm">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              📐 {t('floorPlan.title')} · {t('floorPlan.floor')}
            </span>
          </div>

          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('floorPlan.scale')}:</span>
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-8 bg-slate-400 dark:bg-slate-500"></div>
              <div className="h-0.5 w-0.5 bg-slate-400 dark:bg-slate-500"></div>
              <span className="text-xs text-slate-500 dark:text-slate-400">5m</span>
            </div>
          </div>

          <svg
            viewBox="0 0 1000 780"
            className="w-full h-auto"
            style={{ background: '#f0f2f5' }}
          >
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d1d5db" strokeWidth="0.3" />
              </pattern>
              <pattern id="gridLarge" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#9ca3af" strokeWidth="0.5" />
              </pattern>
              <filter id="shadow3d">
                <feDropShadow dx="3" dy="3" stdDeviation="4" floodOpacity="0.2" />
              </filter>
              <filter id="shadowLight">
                <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.1" />
              </filter>
            </defs>

            <rect width="1000" height="780" fill="#f0f2f5" />
            <rect width="1000" height="780" fill="url(#gridLarge)" />
            <rect width="1000" height="780" fill="url(#grid)" />

            {/* MURS EXTÉRIEURS */}
            <rect x="30" y="30" width="940" height="690" fill="none" stroke="#1e293b" strokeWidth="6" rx="4" />
            <rect x="33" y="33" width="934" height="684" fill="none" stroke="#475569" strokeWidth="1" rx="3" />

            {/* FENÊTRES */}
            {[100, 160, 220, 700, 760, 820, 880].map((x, i) => (
              <rect key={`win-top-${i}`} x={x} y="27" width="36" height="6" fill="#7dd3fc" stroke="#1e293b" strokeWidth="1.5" />
            ))}
            {[300, 420, 550].map((y, i) => (
              <rect key={`win-left-${i}`} x="27" y={y} width="6" height="36" fill="#7dd3fc" stroke="#1e293b" strokeWidth="1.5" />
            ))}
            {[150, 260, 610].map((y, i) => (
              <rect key={`win-right-${i}`} x="967" y={y} width="6" height="36" fill="#7dd3fc" stroke="#1e293b" strokeWidth="1.5" />
            ))}

            {/* MURS INTÉRIEURS */}
            <line x1="470" y1="50" x2="470" y2="700" stroke="#475569" strokeWidth="5" />
            <line x1="50" y1="230" x2="470" y2="230" stroke="#475569" strokeWidth="5" />
            <line x1="470" y1="500" x2="970" y2="500" stroke="#475569" strokeWidth="5" />

            {/* ENTRÉE */}
            <g>
              <rect x="440" y="694" width="90" height="12" fill="#f0f2f5" stroke="#1e293b" strokeWidth="6" />
              <path d="M 445 700 L 445 660 Q 445 700 485 700" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeDasharray="4 3" />
              <path d="M 485 700 L 480 696 M 485 700 L 480 704" fill="none" stroke="#1e293b" strokeWidth="2" />
              <text x="485" y="722" textAnchor="middle" className="text-[9px] fill-slate-600 font-bold tracking-wide">
                {t('floorPlan.entrance')}
              </text>
            </g>

            {/* ROSE DES VENTS */}
            <g transform="translate(60, 60)">
              <circle cx="0" cy="0" r="18" fill="white" stroke="#1e293b" strokeWidth="1.5" opacity="0.9" />
              <path d="M 0 -14 L 4 0 L 0 14 L -4 0 Z" fill="#1e293b" />
              <text x="0" y="-19" textAnchor="middle" className="text-[8px] fill-slate-700 font-bold">N</text>
            </g>

            {/* BUREAU CEO */}
            <g>
              <rect x="55" y="55" width="410" height="170" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" rx="4" filter="url(#shadow3d)" />
              <text x="260" y="85" textAnchor="middle" className="text-base font-bold fill-blue-700">
                {t('floorPlan.ceoOffice')}
              </text>
              <rect x="185" y="120" width="150" height="60" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="260" y="155" textAnchor="middle" className="text-xs fill-blue-600 font-medium">{t('floorPlan.office')}</text>
              <circle cx="260" cy="110" r="12" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="260" y="113" textAnchor="middle" className="text-[8px] fill-blue-600">{t('floorPlan.chair')}</text>
              <circle cx="210" cy="195" r="11" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="210" y="198" textAnchor="middle" className="text-[8px] fill-blue-600">{t('floorPlan.chair')}</text>
              <circle cx="310" cy="195" r="11" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="310" y="198" textAnchor="middle" className="text-[8px] fill-blue-600">{t('floorPlan.chair')}</text>
              <rect x="245" y="128" width="30" height="10" rx="2" fill="#60a5fa" stroke="#3b82f6" strokeWidth="1" />
              <text x="260" y="135" textAnchor="middle" className="text-[5px] fill-white font-bold">{t('floorPlan.screen')}</text>
              <rect x="75" y="195" width="100" height="18" rx="9" fill="#dbeafe" stroke="#93c5fd" strokeWidth="0.5" />
              <text x="125" y="207" textAnchor="middle" className="text-[7px] fill-blue-600">{t('floorPlan.ergonomicChair')}</text>
              {ceo && (
                <g>
                  <rect x="360" y="195" width="95" height="22" rx="11" fill={ceo.is_occupied ? '#ef4444' : '#22c55e'} className={ceo.is_occupied ? 'animate-pulse' : ''} />
                  <text x="407" y="209" textAnchor="middle" className="text-[8px] font-bold fill-white">
                    {ceo.is_occupied ? `🔴 ${t('floorPlan.occupiedStatus')}` : `🟢 ${t('floorPlan.freeStatus')}`}
                  </text>
                  {occupancyLabel(ceo) && (
                    <text x="407" y="228" textAnchor="middle" className="text-[7px] fill-blue-500 font-medium">
                      {occupancyLabel(ceo)}
                    </text>
                  )}
                </g>
              )}
              <path d="M 440 55 L 440 85 Q 430 85 430 75 L 430 55" fill="none" stroke="#1e293b" strokeWidth="3" />
              <circle cx="433" cy="70" r="2.5" fill="#1e293b" />
            </g>

            {/* SALLE DE RÉUNION */}
            <g>
              <rect x="55" y="235" width="410" height="160" fill="#faf5ff" stroke="#8b5cf6" strokeWidth="2" rx="4" filter="url(#shadow3d)" />
              <text x="260" y="265" textAnchor="middle" className="text-base font-bold fill-purple-700">
                {t('floorPlan.meetingRoom')}
              </text>
              <rect x="155" y="290" width="210" height="55" rx="6" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.5" />
              <text x="260" y="323" textAnchor="middle" className="text-xs fill-purple-600 font-medium">{t('floorPlan.conferenceTable')}</text>
              {[
                { x: 170, y: 280 }, { x: 220, y: 280 }, { x: 260, y: 280 }, { x: 300, y: 280 }, { x: 350, y: 280 },
                { x: 170, y: 355 }, { x: 220, y: 355 }, { x: 260, y: 355 }, { x: 300, y: 355 }, { x: 350, y: 355 },
              ].map((chair, i) => (
                <circle key={i} cx={chair.x} cy={chair.y} r="9" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1" />
              ))}
              <text x="260" y="340" textAnchor="middle" className="text-[7px] fill-purple-600">💺 10 {t('floorPlan.people')}</text>
              <rect x="75" y="365" width="85" height="18" rx="9" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="0.5" />
              <text x="117" y="377" textAnchor="middle" className="text-[7px] fill-purple-600">{t('floorPlan.video')}</text>
              <rect x="170" y="365" width="85" height="18" rx="9" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="0.5" />
              <text x="212" y="377" textAnchor="middle" className="text-[7px] fill-purple-600">{t('floorPlan.whiteboard')}</text>
              <rect x="265" y="365" width="85" height="18" rx="9" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="0.5" />
              <text x="307" y="377" textAnchor="middle" className="text-[7px] fill-purple-600">{t('floorPlan.visio')}</text>
              {reunion && (
                <g>
                  <rect x="360" y="365" width="80" height="22" rx="11" fill={reunion.is_occupied ? '#ef4444' : '#22c55e'} className={reunion.is_occupied ? 'animate-pulse' : ''} />
                  <text x="400" y="379" textAnchor="middle" className="text-[8px] font-bold fill-white">
                    {reunion.is_occupied ? `🔴 ${t('floorPlan.occupiedStatus')}` : `🟢 ${t('floorPlan.freeStatus')}`}
                  </text>
                  {occupancyLabel(reunion) && (
                    <text x="400" y="398" textAnchor="middle" className="text-[7px] fill-purple-500 font-medium">
                      {occupancyLabel(reunion)}
                    </text>
                  )}
                </g>
              )}
              <path d="M 55 310 L 85 310 Q 85 300 75 300 L 55 300" fill="none" stroke="#1e293b" strokeWidth="3" />
              <circle cx="78" cy="305" r="2.5" fill="#1e293b" />
            </g>

            {/* OPEN SPACE - 10 POSTES */}
            <g>
              <rect x="475" y="55" width="490" height="440" fill="#f0fdf4" stroke="#22c55e" strokeWidth="2" rx="4" filter="url(#shadow3d)" />
              <text x="720" y="85" textAnchor="middle" className="text-base font-bold fill-emerald-700">
                {t('floorPlan.openSpace')}
              </text>
              <text x="720" y="102" textAnchor="middle" className="text-[8px] fill-emerald-600">
                {t('floorPlan.postesFaceToFace')}
              </text>
              {postes.slice(0, 10).map((poste: Room, index: number) => {
                const row = Math.floor(index / 5)
                const col = index % 5
                const x = 490 + col * 90
                const y = 120 + row * 170
                const isSecondInPair = col % 2 === 1
                const isOccupied = poste.is_occupied
                return (
                  <g key={poste.id} filter="url(#shadowLight)">
                    <rect x={x} y={y} width="80" height="70" rx="4" fill={isOccupied ? '#fecaca' : '#dcfce7'} stroke={isOccupied ? '#ef4444' : '#22c55e'} strokeWidth="2" />
                    <rect x={x + 8} y={isSecondInPair ? y + 8 : y + 44} width="64" height="22" rx="3" fill={isOccupied ? '#fca5a5' : '#bbf7d0'} stroke={isOccupied ? '#ef4444' : '#22c55e'} strokeWidth="1.5" />
                    <rect x={x + 20} y={isSecondInPair ? y + 3 : y + 55} width="40" height="12" rx="2" fill={isOccupied ? '#f87171' : '#4ade80'} stroke={isOccupied ? '#ef4444' : '#22c55e'} strokeWidth="0.5" />
                    <text x={x + 40} y={isSecondInPair ? y + 12 : y + 64} textAnchor="middle" className="text-[5px] fill-white font-bold">{t('floorPlan.screen')}</text>
                    <circle cx={x + 40} cy={isSecondInPair ? y + 64 : y + 8} r="8" fill={isOccupied ? '#fca5a5' : '#86efac'} stroke={isOccupied ? '#ef4444' : '#22c55e'} strokeWidth="1.5" />
                    <text x={x + 40} y={isSecondInPair ? y + 66 : y + 10} textAnchor="middle" className="text-[7px]">{t('floorPlan.chair')}</text>
                    <text x={x + 40} y={y + 34} textAnchor="middle" className="text-[8px] fill-slate-700 font-bold">{poste.name}</text>
                    {isOccupied && <text x={x + 78} y={y + 16} textAnchor="middle" className="text-[10px]">👤</text>}
                  </g>
                )
              })}
              <text x="720" y="460" textAnchor="middle" className="text-[9px] fill-emerald-600 font-medium">
                {t('floorPlan.pairs')}
              </text>
              <path d="M 940 55 L 940 85 Q 930 85 930 75 L 930 55" fill="none" stroke="#1e293b" strokeWidth="3" />
              <circle cx="933" cy="70" r="2.5" fill="#1e293b" />
            </g>

            {/* ESPACE DÉTENTE */}
            {detente && (
              <g>
                <rect x="475" y="505" width="490" height="185" fill="#fffbeb" stroke="#f59e0b" strokeWidth="2" rx="4" filter="url(#shadow3d)" />
                <text x="720" y="535" textAnchor="middle" className="text-base font-bold fill-amber-700">
                  {t('floorPlan.lounge')}
                </text>
                <rect x="520" y="560" width="190" height="55" rx="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
                <rect x="530" y="568" width="170" height="39" rx="4" fill="#fde68a" stroke="#f59e0b" strokeWidth="1" />
                <text x="615" y="590" textAnchor="middle" className="text-xs fill-amber-700 font-medium">{t('floorPlan.sofa')}</text>
                <rect x="740" y="560" width="190" height="55" rx="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
                <rect x="750" y="568" width="170" height="39" rx="4" fill="#fde68a" stroke="#f59e0b" strokeWidth="1" />
                <text x="835" y="590" textAnchor="middle" className="text-xs fill-amber-700 font-medium">{t('floorPlan.sofa')}</text>
                <rect x="560" y="625" width="50" height="25" rx="4" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
                <text x="585" y="641" textAnchor="middle" className="text-[7px] fill-amber-700">{t('floorPlan.table')}</text>
                <rect x="780" y="625" width="50" height="25" rx="4" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
                <text x="805" y="641" textAnchor="middle" className="text-[7px] fill-amber-700">{t('floorPlan.table')}</text>
                <text x="500" y="560" className="text-2xl fill-amber-600">{t('floorPlan.plants')}</text>
                <text x="500" y="620" className="text-2xl fill-amber-600">{t('floorPlan.plants')}</text>
                <text x="940" y="560" className="text-2xl fill-amber-600">{t('floorPlan.plants')}</text>
                <text x="940" y="620" className="text-2xl fill-amber-600">{t('floorPlan.plants')}</text>
                {detente.equipment && detente.equipment.length > 0 && (
                  <rect x="520" y="655" width="400" height="22" rx="11" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1" />
                )}
                {detente.equipment && detente.equipment.length > 0 && (
                  <text x="720" y="670" textAnchor="middle" className="text-[8px] fill-amber-600 font-medium">
                    {detente.equipment.join(' · ')}
                  </text>
                )}
                <rect x="890" y="655" width="70" height="22" rx="11" fill="#22c55e" />
                <text x="925" y="670" textAnchor="middle" className="text-[7px] font-bold fill-white">
                  🟢 {t('floorPlan.freeStatus')}
                </text>
                <path d="M 940 505 L 940 535 Q 930 535 930 525 L 930 505" fill="none" stroke="#1e293b" strokeWidth="3" />
                <circle cx="933" cy="520" r="2.5" fill="#1e293b" />
              </g>
            )}

            <g>
              <text x="480" y="712" textAnchor="middle" className="text-[7px] fill-slate-400 font-medium tracking-wider">
                {t('floorPlan.corridor')}
              </text>
            </g>

            {/* ZONES CLIQUABLES */}
            {ceo && (
              <Link href={`/rooms/${ceo.id}`}>
                <rect x="55" y="55" width="410" height="170" fill="transparent" stroke="none" cursor="pointer" />
              </Link>
            )}
            {reunion && (
              <Link href={`/rooms/${reunion.id}`}>
                <rect x="55" y="235" width="410" height="160" fill="transparent" stroke="none" cursor="pointer" />
              </Link>
            )}
            {postes.slice(0, 10).map((poste: Room, index: number) => {
              const row = Math.floor(index / 5)
              const col = index % 5
              return (
                <Link key={poste.id} href={`/rooms/${poste.id}`}>
                  <rect x={490 + col * 90} y={120 + row * 170} width="80" height="70" fill="transparent" stroke="none" cursor="pointer" />
                </Link>
              )
            })}
            {detente && (
              <Link href={`/rooms/${detente.id}`}>
                <rect x="475" y="505" width="490" height="185" fill="transparent" stroke="none" cursor="pointer" />
              </Link>
            )}
          </svg>

          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
              <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <span className="animate-pulse">👆</span>
                {t('floorPlan.clickToSubscribe')}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          {t('floorPlan.updated')} · {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </div>
  )
}