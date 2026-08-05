'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { toast } from 'sonner'
import { notifyRoomStatusChange, askWhoIsFree, notifyRoomOutOfService } from '@/lib/notifications'
import { getLocalDateString } from '@/lib/dateUtils'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  Users,
  MapPin,
  Wrench,
  Clock,
  Sparkles,
  Building2,
  Crown,
  Computer,
  Sofa,
  ChevronRight,
  Search,
  X,
  Timer,
  PartyPopper,
} from 'lucide-react'

interface Room {
  id: string
  name: string
  capacity: number
  equipment: string[]
  location: string
  category: string
  is_occupied: boolean
  is_confidential: boolean
  is_out_of_service: boolean
  out_of_service_reason: string | null
  occupied_by: string | null
  occupied_at: string | null
  occupied_until: string | null
  created_at: string
  updated_at: string
  max_people: number
  current_people: number
  room_email: string
}

// ---------- Config visuel par catégorie ----------
const categoryIcons: Record<string, any> = {
  bureau: Crown,
  reunion: Building2,
  poste: Computer,
  detente: Sofa,
}

function getCategoryLabels(t: (key: string) => string): Record<string, string> {
  return {
    bureau: t('rooms.categoryBureau'),
    reunion: t('rooms.categoryReunion'),
    poste: t('rooms.categoryPoste'),
    detente: t('rooms.categoryDetente'),
  }
}

// Couleurs par catégorie (sans vert pour poste)
const categoryColors: Record<string, string> = {
  bureau: 'from-blue-500 to-blue-600',
  reunion: 'from-violet-500 to-purple-600',
  poste: 'from-slate-500 to-slate-600',
  detente: 'from-amber-500 to-orange-600',
}

// Hex bruts utilisés pour les halos / dégradés
const categoryHex: Record<string, [string, string]> = {
  bureau: ['#3b82f6', '#0056B3'],
  reunion: ['#8b5cf6', '#a855f7'],
  poste: ['#64748b', '#475569'],
  detente: ['#f59e0b', '#f97316'],
}

// ---------- Petits utilitaires ----------

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else prev.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return value
}

function burstConfetti(x: number, y: number) {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const colors = ['#0056B3', '#00A3E0', '#10b981', '#f59e0b', '#a855f7', '#ef4444']
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '0'
  container.style.top = '0'
  container.style.width = '100%'
  container.style.height = '100%'
  container.style.pointerEvents = 'none'
  container.style.zIndex = '9999'
  document.body.appendChild(container)

  const count = 18
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span')
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const distance = 60 + Math.random() * 70
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance - 30
    const size = 6 + Math.random() * 6
    p.style.position = 'absolute'
    p.style.left = `${x}px`
    p.style.top = `${y}px`
    p.style.width = `${size}px`
    p.style.height = `${size}px`
    p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'
    p.style.background = colors[i % colors.length]
    p.style.opacity = '1'
    p.style.transform = 'translate(-50%, -50%) scale(1)'
    p.style.transition = `transform 700ms cubic-bezier(.2,.7,.3,1), opacity 700ms ease-out`
    container.appendChild(p)
    requestAnimationFrame(() => {
      p.style.transform = `translate(${dx - size / 2}px, ${dy - size / 2}px) scale(0.4) rotate(${Math.random() * 240}deg)`
      p.style.opacity = '0'
    })
  }
  setTimeout(() => container.remove(), 800)
}

function formatRemaining(until: string | null, now: Date, t: (key: string) => string): string | null {
  if (!until) return null
  const end = new Date(until).getTime()
  const diff = end - now.getTime()
  if (diff <= 0) return t('rooms.finished')
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [now, setNow] = useState(new Date())
  const supabase = createClient()
  const { t } = useLanguage()
  const categoryLabels = getCategoryLabels(t)

  useEffect(() => {
    fetchRooms()
    getUser()
  }, [])

  useEffect(() => {
    filterRooms()
  }, [rooms, selectedCategory, searchTerm])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const fetchRooms = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('name')

    if (data) {
      // Libération automatique : si une salle est marquée occupée mais que l'heure
      // de fin prévue est déjà passée, on la libère silencieusement avant d'afficher
      const now = new Date()
      const expired = data.filter(
        (r: any) => r.is_occupied && r.occupied_until && new Date(r.occupied_until) < now
      )

      if (expired.length > 0) {
        await Promise.all(
          expired.map((r: any) =>
            supabase
              .from('rooms')
              .update({
                is_occupied: false,
                occupied_by: null,
                occupied_at: null,
                occupied_until: null,
                current_people: 0
              })
              .eq('id', r.id)
          )
        )
        expired.forEach((r: any) => {
          r.is_occupied = false
          r.occupied_by = null
          r.occupied_at = null
          r.occupied_until = null
          r.current_people = 0
        })
      }

      setRooms(data)
      setFilteredRooms(data)
    }
    setLoading(false)
  }

  const filterRooms = () => {
    let filtered = [...rooms]

    if (selectedCategory) {
      filtered = filtered.filter(r => r.category === selectedCategory)
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(term) ||
        r.location?.toLowerCase().includes(term) ||
        r.equipment?.some(e => e.toLowerCase().includes(term))
      )
    }

    setFilteredRooms(filtered)
  }

  const occupyRoomWithTime = async (roomId: string, roomName: string, peopleCount: number = 1, startTime: string, endTime: string) => {
    if (!user) {
      toast.error(t('rooms.pleaseSignInToOccupy'))
      return
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('max_people, current_people')
      .eq('id', roomId)
      .single()

    if (!room) {
      toast.error(t('rooms.roomNotFound'))
      return
    }

    const maxPeople = room.max_people || 1
    const currentPeople = room.current_people || 0

    if (currentPeople >= maxPeople) {
      toast.error(`${t('rooms.roomFull')} (${currentPeople}/${maxPeople})`)
      return
    }

    const newTotal = Math.min(currentPeople + peopleCount, maxPeople)
    // getLocalDateString() évite le bug de décalage d'un jour de
    // new Date().toISOString().split('T')[0] (conversion UTC).
    const today = getLocalDateString()
    const startDateTime = new Date(`${today}T${startTime}:00`)
    const endDateTime = new Date(`${today}T${endTime}:00`)

    if (endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1)
    }

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id, title, start_time, end_time')
      .eq('room_id', roomId)
      .eq('booking_date', today)
      .lt('start_time', endTime)
      .gt('end_time', startTime)

    if (conflicts && conflicts.length > 0) {
      toast.error(`${t('rooms.slotAlreadyBookedCalendar')}: ${conflicts[0].title}`)
      return
    }

    const { error } = await supabase
      .from('rooms')
      .update({
        is_occupied: true,
        occupied_by: user.id,
        occupied_at: startDateTime.toISOString(),
        current_people: newTotal,
        occupied_until: endDateTime.toISOString(),
      })
      .eq('id', roomId)

    if (error) {
      toast.error(t('rooms.occupyError'))
    } else {
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          room_id: roomId,
          user_id: user.id,
          title: `Occupation directe (${newTotal}/${maxPeople} pers.)`,
          booking_date: today,
          start_time: startTime,
          end_time: endTime,
          status: 'confirmed'
        })

      if (bookingError) {
        console.error('Erreur de synchronisation avec le calendrier:', bookingError)
      }

      toast.success(`${t('rooms.occupySuccess')} ${roomName} (${newTotal}/${maxPeople}) ${t('rooms.from')} ${startTime} ${t('rooms.to')} ${endTime}`)

      const result = await notifyRoomStatusChange(roomId, 'occupied')
      if (result.email > 0 || result.sms > 0) {
        toast.info(`${t('rooms.subscribersNotified')} ${result.email + result.sms}`)
      }

      fetchRooms()
    }
  }

  const freeRoom = async (roomId: string, roomName: string, e?: React.MouseEvent) => {
    const { error } = await supabase
      .from('rooms')
      .update({
        is_occupied: false,
        occupied_by: null,
        occupied_at: null,
        occupied_until: null,
        current_people: 0
      })
      .eq('id', roomId)

    if (error) {
      toast.error(t('rooms.freeError'))
      return
    }

    const nowTime = new Date().toTimeString().slice(0, 5)
    const todayStr = getLocalDateString()

    const { data: activeBookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('room_id', roomId)
      .eq('booking_date', todayStr)
      .lte('start_time', nowTime)
      .gt('end_time', nowTime)

    if (activeBookings && activeBookings.length > 0) {
      await supabase
        .from('bookings')
        .update({ end_time: nowTime })
        .eq('id', activeBookings[0].id)
    }

    if (e) burstConfetti(e.clientX, e.clientY)
    toast.success(`${t('rooms.freeSuccess')} ${roomName}`)

    const result = await notifyRoomStatusChange(roomId, 'free')
    if (result.email > 0 || result.sms > 0) {
      toast.info(`${t('rooms.subscribersNotified')} ${result.email + result.sms}`)
    }

    fetchRooms()
  }

  // ✅ Mettre une salle hors service (admin uniquement)
  const handleSetOutOfService = async (roomId: string, roomName: string) => {
    // Vérifier si l'utilisateur est admin
    if (user?.role !== 'admin') {
      toast.error(t('rooms.adminOnlyOutOfService'))
      return
    }

    const reason = prompt(`${t('rooms.outOfServiceReasonPrompt')} ${roomName}`)
    if (reason === null) return
    
    if (reason.trim() === '') {
      toast.error(t('rooms.pleaseEnterReason'))
      return
    }

    try {
      // 1. Mettre à jour la salle
      const { error: updateError } = await supabase
        .from('rooms')
        .update({
          is_out_of_service: true,
          out_of_service_reason: reason,
          is_occupied: false,
          occupied_by: null,
          occupied_at: null,
          occupied_until: null,
          current_people: 0
        })
        .eq('id', roomId)

      if (updateError) throw updateError

      // 2. Enregistrer dans l'historique
      await supabase.from('room_history').insert({
        room_id: roomId,
        is_occupied: false,
        changed_by: user?.id || null,
        user_name: user?.email?.split('@')[0] || user?.email || 'Admin',
        details: {
          action: 'out_of_service',
          reason: reason
        }
      })

      // 3. ✅ NOTIFIER LES RÉSERVATAIRES
      const result = await notifyRoomOutOfService(roomId, reason)
      
      if (result.email > 0 || result.sms > 0) {
        toast.success(`${t('rooms.cancelledBookingsNotified')} ${result.email + result.sms}`)
      }

      toast.success(`${t('rooms.nowOutOfService')} ${roomName}`)
      fetchRooms()
    } catch (error) {
      toast.error(t('rooms.outOfServiceError'))
      console.error(error)
    }
  }

  // ✅ Remettre une salle en service (admin uniquement)
  const handleBackInService = async (roomId: string, roomName: string) => {
    // Vérifier si l'utilisateur est admin
    if (user?.role !== 'admin') {
      toast.error(t('rooms.adminOnlyBackInService'))
      return
    }

    try {
      const { error } = await supabase
        .from('rooms')
        .update({
          is_out_of_service: false,
          out_of_service_reason: null
        })
        .eq('id', roomId)

      if (error) throw error

      // Enregistrer dans l'historique
      await supabase.from('room_history').insert({
        room_id: roomId,
        is_occupied: false,
        changed_by: user?.id || null,
        user_name: user?.email?.split('@')[0] || user?.email || 'Admin',
        details: {
          action: 'back_in_service'
        }
      })

      // ✅ NOTIFIER LES ABONNÉS que la salle est de nouveau disponible
      const result = await notifyRoomStatusChange(roomId, 'back_in_service')
      
      if (result.email > 0 || result.sms > 0) {
        toast.success(`${t('rooms.subscribersNotified')} ${result.email + result.sms}`)
      }

      toast.success(`${t('rooms.nowBackInService')} ${roomName}`)
      fetchRooms()
    } catch (error) {
      toast.error(t('rooms.backInServiceError'))
      console.error(error)
    }
  }

  const handleAskWhoIsFree = async () => {
    if (!user) {
      toast.error(t('rooms.pleaseSignIn'))
      return
    }

    toast.info(t('rooms.requestInProgress'))

    const result = await askWhoIsFree(user.id, user.email?.split('@')[0] || 'Utilisateur')

    if (result.success) {
      toast.success(`${t('rooms.whoIsFreeResult')}: ${result.free || 0} ${t('rooms.available')}, ${result.occupied || 0} ${t('rooms.occupied')}`)
    } else {
      toast.error(t('rooms.whoIsFreeError'))
    }
  }

  const handleTiltMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(900px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-6px)`
  }, [])
  const handleTiltLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)'
  }, [])

  const allOccupied = rooms.filter(r => r.category !== 'detente' && !r.is_out_of_service).every(r => r.is_occupied)
  const hasFreeRooms = rooms.some(r => r.category !== 'detente' && !r.is_out_of_service && !r.is_occupied)
  const availableCount = rooms.filter(r => !r.is_occupied && r.category !== 'detente' && !r.is_out_of_service).length
  const occupiedCount = rooms.filter(r => r.is_occupied).length
  const outOfServiceCount = rooms.filter(r => r.is_out_of_service).length

  const availableAnim = useCountUp(availableCount)
  const occupiedAnim = useCountUp(occupiedCount)
  const totalAnim = useCountUp(rooms.length)

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a2e] shadow-lg">
              <div className="h-32 shimmer-bg"></div>
              <div className="p-5 space-y-3">
                <div className="h-5 shimmer-bg rounded w-3/4"></div>
                <div className="h-4 shimmer-bg rounded w-1/2"></div>
                <div className="h-4 shimmer-bg rounded w-2/3"></div>
                <div className="flex gap-2">
                  <div className="h-8 shimmer-bg rounded w-16"></div>
                  <div className="h-8 shimmer-bg rounded w-16"></div>
                  <div className="h-8 shimmer-bg rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <style jsx global>{`
          .shimmer-bg {
            background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 37%, #e5e7eb 63%);
            background-size: 400% 100%;
            animation: shimmer 1.4s ease infinite;
          }
          @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fond ambiant animé */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="orb orb-a"></div>
        <div className="orb orb-b"></div>
        <div className="orb orb-c"></div>
      </div>

      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 fade-in-up">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white flex flex-wrap items-center gap-3">
              <span className="gradient-text">{t('rooms.title')}</span>
              <Badge variant="outline" className="text-sm font-normal border-[#0056B3] text-[#0056B3]">
                {totalAnim} {t('rooms.totalRoomsBadge')}
              </Badge>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {availableCount} {availableCount > 1 ? t('rooms.availableCountPlural') : t('rooms.availableCount')} · {occupiedCount} {occupiedCount > 1 ? t('rooms.occupiedCountPlural') : t('rooms.occupiedCount')}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleAskWhoIsFree}
              className="relative overflow-hidden bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t('rooms.whoIsFree')}
            </Button>
          </div>
        </div>

        {/* Mini tableau de bord */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          <StatTile
            label={t('rooms.statAvailable')}
            value={availableAnim}
            icon={<Sofa className="w-4 h-4" />}
            hexA="#3b82f6"
            hexB="#0056B3"
          />
          <StatTile
            label={t('rooms.statOccupied')}
            value={occupiedAnim}
            icon={<Users className="w-4 h-4" />}
            hexA="#ef4444"
            hexB="#f97316"
          />
          <StatTile
            label={t('rooms.statOutOfService')}
            value={outOfServiceCount}
            icon={<Wrench className="w-4 h-4" />}
            hexA="#6b7280"
            hexB="#9ca3af"
          />
        </div>

        {/* Bannière */}
        {allOccupied ? (
          <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 mb-6 flex items-center gap-4 fade-in-up">
            <Sofa className="w-8 h-8 text-amber-500 shrink-0 animate-bounce-soft" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-400">{t('rooms.allOccupiedTitle')}</p>
              <p className="text-amber-700 dark:text-amber-500 text-sm">
                {t('rooms.allOccupiedDesc')}
              </p>
            </div>
          </div>
        ) : hasFreeRooms && (
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-6 flex items-center gap-4 fade-in-up">
            <div className="relative w-2.5 h-2.5">
              <div className="absolute inset-0 rounded-full bg-blue-500"></div>
              <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping"></div>
            </div>
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-400">
                {availableCount} {availableCount > 1 ? t('rooms.availableCountPlural') : t('rooms.availableCount')}
              </p>
              <p className="text-blue-700 dark:text-blue-500 text-sm">
                {t('rooms.someFreeDesc')}
              </p>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('rooms.filterLabel')}</span>
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className={`transition-all duration-300 ${selectedCategory === null ? 'bg-[#0056B3] hover:bg-[#00449E] scale-105 shadow-md shadow-[#0056B3]/30' : 'hover:scale-105'}`}
          >
            {t('rooms.filterAll')}
          </Button>
          {Object.entries(categoryLabels).map(([key, label]) => {
            const count = rooms.filter(r => r.category === key).length
            const Icon = categoryIcons[key]
            const active = selectedCategory === key
            return (
              <Button
                key={key}
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(key)}
                className={`transition-all duration-300 ${active ? `bg-gradient-to-r ${categoryColors[key]} text-white scale-105 shadow-md` : 'hover:scale-105'}`}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                {label} ({count})
              </Button>
            )
          })}
        </div>

        {/* Recherche */}
        <div className="relative mb-6 search-glow rounded-xl">
          <Input
            placeholder={t('rooms.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 py-6 rounded-xl border-gray-200 dark:border-[#334155] bg-white dark:bg-[#1a1a2e] focus-visible:ring-2 focus-visible:ring-[#0056B3] transition-all"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setSearchTerm('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Grille des salles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6">
          {filteredRooms.map((room, idx) => {
            const Icon = categoryIcons[room.category] || Building2
            const [hexA, hexB] = categoryHex[room.category] || ['#6b7280', '#9ca3af']
            const isDetente = room.category === 'detente'
            const isOccupied = room.is_occupied
            const isOutOfService = room.is_out_of_service
            const remaining = isOccupied ? formatRemaining(room.occupied_until, now, t) : null
            const fillPct = room.max_people > 0 ? Math.min(100, ((room.current_people || 0) / room.max_people) * 100) : 0
            const isAdmin = user?.role === 'admin'

            return (
              <div
                key={room.id}
                onMouseMove={!isOutOfService ? handleTiltMove : undefined}
                onMouseLeave={!isOutOfService ? handleTiltLeave : undefined}
                className="tilt-wrap fade-in-up room-card"
                style={{ animationDelay: `${Math.min(idx, 8) * 60}ms` }}
              >
                <Card
                  className={`
                    group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-shadow duration-500 h-full
                    ${isOutOfService ? 'opacity-60 grayscale' : ''}
                    ${isOccupied ? 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/10' : ''}
                    ${!isOccupied && !isOutOfService ? 'bg-gradient-to-br from-white to-gray-50 dark:from-[#1a1a2e] dark:to-[#0f172a]' : ''}
                  `}
                  style={{
                    boxShadow: !isOutOfService ? `0 12px 30px -12px ${hexA}55` : undefined,
                  }}
                >
                  {/* Bordure dégradée animée en haut */}
                  <div
                    className="h-1.5 animated-gradient-bar"
                    style={{ ['--c1' as any]: hexA, ['--c2' as any]: hexB }}
                  ></div>

                  <CardHeader className="pb-2 relative">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className="p-2 rounded-xl text-white shrink-0 icon-float"
                          style={{ background: `linear-gradient(135deg, ${hexA}, ${hexB})`, boxShadow: `0 8px 20px -6px ${hexA}88` }}
                        >
                          <Icon className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base md:text-lg font-bold text-gray-900 dark:text-white truncate room-title">
                            {room.name}
                          </CardTitle>
                          {room.location && (
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate room-location">
                              <MapPin className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                              <span className="truncate">{room.location}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={`
                        relative shrink-0 px-2 py-1 text-[10px] md:text-xs font-semibold shadow-lg text-white overflow-visible
                        ${isOutOfService ? 'bg-gray-500' : isOccupied ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600'}
                      `}>
                        {!isOutOfService && (
                          <span className={`absolute -inset-0.5 rounded-full opacity-60 ${isOccupied ? 'pulse-ring-red' : 'pulse-ring-green'}`}></span>
                        )}
                        <span className="relative whitespace-nowrap">
                          {isOutOfService ? '🚫' : isOccupied ? '🔴' : '🟢'}
                        </span>
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-2 md:space-y-3">
                    <div className="flex flex-wrap gap-1.5 md:gap-2 text-xs md:text-sm room-details">
                      <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                        <Users className="w-3 h-3 md:w-3.5 md:h-3.5" />
                        <span className="truncate">{room.capacity} {t('rooms.people')}</span>
                      </span>
                      {room.max_people > 0 && (
                        <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                          <Clock className="w-3 h-3 md:w-3.5 md:h-3.5" />
                          <span className="truncate">{room.current_people || 0}/{room.max_people}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                        {categoryLabels[room.category] || t('rooms.categoryDefault')}
                      </span>
                    </div>

                    {room.max_people > 0 && (
                      <div className="h-1 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden room-progress">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${fillPct}%`, background: `linear-gradient(90deg, ${hexA}, ${hexB})` }}
                        ></div>
                      </div>
                    )}

                    {remaining && (
                      <div className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 room-timer">
                        <Timer className="w-3 h-3" />
                        <span className="truncate">{remaining}</span>
                      </div>
                    )}

                    {room.equipment && room.equipment.length > 0 && (
                      <div className="flex flex-wrap gap-1 room-equipment">
                        {room.equipment.slice(0, 3).map((item: string, i: number) => (
                          <span
                            key={item}
                            className="text-[10px] md:text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full text-gray-600 dark:text-gray-400 truncate max-w-[80px]"
                          >
                            {item}
                          </span>
                        ))}
                        {room.equipment.length > 3 && (
                          <span className="text-[10px] md:text-xs text-gray-400">+{room.equipment.length - 3}</span>
                        )}
                      </div>
                    )}

                    {isOutOfService && room.out_of_service_reason && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-1.5 rounded-lg truncate">
                        🚫 {room.out_of_service_reason}
                      </p>
                    )}

                    {!isDetente && user && !isOutOfService && (
                      <div className="pt-1 room-actions">
                        {!isOccupied ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <div className="flex items-center gap-0.5">
                              <input
                                type="number"
                                min={1}
                                max={(room.max_people || 1) - (room.current_people || 0)}
                                defaultValue={1}
                                className="w-8 h-7 text-center border rounded bg-white dark:bg-[#1e293b] dark:border-[#334155] dark:text-white text-xs transition-shadow focus:ring-1 focus:ring-[#0056B3] outline-none"
                                id={`people-${room.id}`}
                              />
                              <input
                                type="time"
                                defaultValue="09:00"
                                className="w-14 h-7 text-center border rounded bg-white dark:bg-[#1e293b] dark:border-[#334155] dark:text-white text-xs transition-shadow focus:ring-1 focus:ring-[#0056B3] outline-none"
                                id={`start-${room.id}`}
                              />
                              <input
                                type="time"
                                defaultValue="10:00"
                                className="w-14 h-7 text-center border rounded bg-white dark:bg-[#1e293b] dark:border-[#334155] dark:text-white text-xs transition-shadow focus:ring-1 focus:ring-[#0056B3] outline-none"
                                id={`end-${room.id}`}
                              />
                            </div>
                            <Button
                              onClick={(e) => {
                                const peopleInput = document.getElementById(`people-${room.id}`) as HTMLInputElement
                                const startInput = document.getElementById(`start-${room.id}`) as HTMLInputElement
                                const endInput = document.getElementById(`end-${room.id}`) as HTMLInputElement
                                const count = parseInt(peopleInput?.value) || 1
                                const start = startInput?.value || '09:00'
                                const end = endInput?.value || '10:00'
                                occupyRoomWithTime(room.id, room.name, count, start, end)
                              }}
                              className="flex-1 text-xs md:text-sm bg-gradient-to-r from-[#0056B3] to-[#00A3E0] hover:opacity-90 text-white shadow-lg shadow-[#0056B3]/25 transition-all hover:scale-105 active:scale-95 py-1 h-7 md:h-9"
                            >
                              <Users className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1" />
                              <span className="hidden sm:inline">{t('rooms.occupy')}</span>
                              <span className="sm:hidden">OK</span>
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={(e) => freeRoom(room.id, room.name, e)}
                            className="w-full text-xs md:text-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/25 transition-all hover:scale-105 active:scale-95 py-1 h-7 md:h-9"
                          >
                            <PartyPopper className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1" />
                            <span className="hidden sm:inline">{t('rooms.free')}</span>
                            <span className="sm:hidden">✕</span>
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Actions admin pour les salles hors service */}
                    {isAdmin && isOutOfService && (
                      <div className="flex gap-1 mt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleBackInService(room.id, room.name)}
                          className="border-green-500 text-green-600 hover:bg-green-50 text-xs h-7"
                        >
                          {t('rooms.backInService')}
                        </Button>
                      </div>
                    )}

                    {/* Bouton "Mettre hors service" pour admin */}
                    {isAdmin && !isOutOfService && !isDetente && (
                      <div className="flex gap-1 mt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetOutOfService(room.id, room.name)}
                          className="border-amber-500 text-amber-600 hover:bg-amber-50 text-xs h-7"
                        >
                          {t('rooms.setOutOfService')}
                        </Button>
                      </div>
                    )}

                    {isDetente && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 italic flex items-center gap-1 bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg">
                        <Sofa className="w-3 h-3 text-amber-500" />
                        <span className="truncate">{t('rooms.alwaysAvailable')}</span>
                      </div>
                    )}

                    <Link href={`/rooms/${room.id}`}>
                      <p className="text-xs md:text-sm text-[#0056B3] dark:text-[#00A3E0] hover:underline mt-1 flex items-center gap-1 group-hover:gap-2 transition-all room-link">
                        <span className="truncate">{t('rooms.viewDetails')}</span>
                        <ChevronRight className="w-3 h-3 md:w-3.5 md:h-3.5 transition-transform group-hover:translate-x-1 shrink-0" />
                      </p>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>

        {filteredRooms.length === 0 && (
          <div className="text-center py-16 fade-in-up">
            <Sofa className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 animate-bounce-soft mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">{t('rooms.noRoomsMatch')}</p>
            <Button
              variant="outline"
              onClick={() => { setSearchTerm(''); setSelectedCategory(null) }}
              className="mt-4 hover:scale-105 transition-transform"
            >
              {t('rooms.resetFilters')}
            </Button>
          </div>
        )}

        <button
          onClick={handleAskWhoIsFree}
          aria-label={t('rooms.whoIsFree')}
          className="md:hidden fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-xl shadow-purple-500/40 flex items-center justify-center active:scale-90 transition-transform"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      </div>

      <style jsx global>{`
        .gradient-text {
          background-image: linear-gradient(90deg, #0056B3, #00A3E0, #8b5cf6, #0056B3);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: gradient-shift 6s ease infinite;
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .fade-in-up {
          animation: fade-in-up 0.5s ease both;
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .tilt-wrap {
          transition: transform 200ms ease-out;
          will-change: transform;
        }

        .icon-float {
          animation: icon-float 3.5s ease-in-out infinite;
        }
        @keyframes icon-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        .animated-gradient-bar {
          background-image: linear-gradient(90deg, var(--c1), var(--c2), var(--c1));
          background-size: 200% 100%;
          animation: gradient-shift 3s linear infinite;
        }

        .pulse-ring-red, .pulse-ring-green {
          animation: pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .pulse-ring-red { background: rgba(239, 68, 68, 0.5); }
        .pulse-ring-green { background: rgba(16, 185, 129, 0.5); }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        .animate-bounce-soft { animation: bounce-soft 2.2s ease-in-out infinite; }
        @keyframes bounce-soft {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        .search-glow:focus-within {
          box-shadow: 0 0 0 4px rgba(0, 86, 179, 0.12);
          border-radius: 0.75rem;
        }

        .orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(70px);
          opacity: 0.28;
        }
        .orb-a {
          width: 420px; height: 420px;
          top: -120px; left: -100px;
          background: radial-gradient(circle, #00A3E0, transparent 70%);
          animation: float-orb 16s ease-in-out infinite;
        }
        .orb-b {
          width: 380px; height: 380px;
          top: 30%; right: -140px;
          background: radial-gradient(circle, #8b5cf6, transparent 70%);
          animation: float-orb 20s ease-in-out infinite reverse;
        }
        .orb-c {
          width: 320px; height: 320px;
          bottom: -140px; left: 30%;
          background: radial-gradient(circle, #10b981, transparent 70%);
          animation: float-orb 18s ease-in-out infinite;
        }
        @keyframes float-orb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, 40px) scale(1.08); }
          66% { transform: translate(-20px, -30px) scale(0.95); }
        }

        .room-title {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .room-location {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .room-details {
          flex-wrap: wrap;
        }

        .room-details > span {
          flex-shrink: 1;
          min-width: 0;
          overflow: hidden;
        }

        .room-equipment {
          flex-wrap: wrap;
        }

        .room-equipment > span {
          flex-shrink: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 80px;
        }

        .room-timer {
          overflow: hidden;
        }

        .room-timer > span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .room-actions {
          overflow: hidden;
        }

        .room-link {
          overflow: hidden;
        }

        .room-link > span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .room-card {
          container-type: inline-size;
        }

        @container (max-width: 250px) {
          .room-details > span:last-child {
            display: none !important;
          }
          .room-equipment > span:nth-child(n+2) {
            display: none !important;
          }
          .room-progress {
            display: none !important;
          }
          .room-timer {
            display: none !important;
          }
        }

        @container (max-width: 200px) {
          .room-title {
            font-size: 0.75rem !important;
          }
          .room-location {
            display: none !important;
          }
          .room-details > span:not(:first-child) {
            display: none !important;
          }
          .room-equipment {
            display: none !important;
          }
          .room-actions {
            display: none !important;
          }
          .room-link {
            display: none !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .gradient-text, .fade-in-up, .icon-float,
          .animated-gradient-bar, .pulse-ring-red, .pulse-ring-green,
          .animate-bounce-soft, .orb, .tilt-wrap {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  )
}

// ---------- Tuile de statistique ----------
function StatTile({
  label,
  value,
  icon,
  hexA,
  hexB,
}: {
  label: string
  value: number
  icon: React.ReactNode
  hexA: string
  hexB: string
}) {
  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden bg-white dark:bg-[#1a1a2e] shadow-md hover:shadow-xl transition-shadow duration-300 hover:-translate-y-0.5"
      style={{ borderTop: `3px solid ${hexA}` }}
    >
      <div
        className="absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-10"
        style={{ background: `linear-gradient(135deg, ${hexA}, ${hexB})` }}
      ></div>
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">
        <span style={{ color: hexA }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
        {value}
      </div>
    </div>
  )
}