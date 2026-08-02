'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getLocalDateString } from '@/lib/dateUtils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, ChevronLeft, ChevronRight, Clock, CalendarDays } from 'lucide-react'

interface Booking {
  id: string
  room_id: string
  user_id: string
  title: string
  booking_date: string
  start_time: string
  end_time: string
  room_name?: string
}

// 🎨 Palette pro : une teinte par jour de semaine (Lun → Dim)
const dayAccent = [
  '#3B6FD4', // Lundi
  '#6C63C7', // Mardi
  '#9457C9', // Mercredi
  '#B23E82', // Jeudi
  '#D68A3A', // Vendredi
  '#2FA37A', // Samedi
  '#D9534F', // Dimanche
]

// 🎨 Palette pro : une teinte par salle (point + pastilles de réservation)
const roomColors = [
  '#2554E0',
  '#7C3AED',
  '#DB2777',
  '#D97706',
  '#059669',
  '#DC2626',
]

const PRIMARY = '#2554E0'
const PRIMARY_HOVER = '#1D42B8'

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedRoom, setSelectedRoom] = useState('')
  const [availableRooms, setAvailableRooms] = useState<any[]>([])
  const [showAvailableRooms, setShowAvailableRooms] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    start_time: '09:00',
    end_time: '10:00',
    room_id: '',
    booking_date: ''
  })

  const supabase = createClient()
  const dateInputRef = useRef<HTMLInputElement>(null)
  const touchStartX = useRef<number | null>(null)

  // Ouvre le sélecteur de date natif (permet de sauter directement à un mois/année)
  const openDatePicker = () => {
    const el = dateInputRef.current
    if (!el) return
    if (typeof (el as any).showPicker === 'function') {
      (el as any).showPicker()
    } else {
      el.focus()
      el.click()
    }
  }

  // Swipe tactile pour naviguer semaine par semaine, comme sur un calendrier de téléphone
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(deltaX) > 45) {
      changeWeek(deltaX < 0 ? 1 : -1)
    }
    touchStartX.current = null
  }
  const weekDayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  const monthShort = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

  // Lundi de la semaine contenant `date`
  const getMonday = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay() // 0 = dimanche ... 6 = samedi
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // Les 7 jours (Lun → Dim) de la semaine affichée
  const weekDays = useMemo(() => {
    const monday = getMonday(currentDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [currentDate])

  useEffect(() => {
    getUser()
    fetchRooms()
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [weekDays[0]?.toDateString()])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('name')
    if (data) setRooms(data)
  }

  const fetchBookings = async () => {
    setLoading(true)
    const startDate = getLocalDateString(weekDays[0])
    const endDate = getLocalDateString(weekDays[6])

    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        rooms!inner(name)
      `)
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .order('booking_date')
      .order('start_time')

    if (data) {
      const formatted = data.map((b: any) => ({
        ...b,
        room_name: b.rooms?.name || 'N/A'
      }))
      setBookings(formatted)
    }
    setLoading(false)
  }

  const checkAvailableRooms = (date: string, start: string, end: string) => {
    if (!date || !start || !end) {
      toast.error('Veuillez remplir tous les champs')
      return
    }

    if (start >= end) {
      toast.error('L\'heure de début doit être avant l\'heure de fin')
      return
    }

    const available = rooms.filter(room => {
      if (room.is_out_of_service) return false
      if (room.category === 'detente') return false

      const hasConflict = bookings.some(b =>
        b.room_id === room.id &&
        b.booking_date === date &&
        b.start_time < end &&
        b.end_time > start
      )

      return !hasConflict
    })

    setAvailableRooms(available)
    setShowAvailableRooms(true)
  }

  // Navigue d'une semaine en avant (+1) ou en arrière (-1), comme un calendrier mobile
  const changeWeek = (direction: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + direction * 7)
    setCurrentDate(newDate)
  }

  const goToToday = () => setCurrentDate(new Date())

  const getBookingsForDay = (date: Date, roomId: string) => {
    const dateStr = getLocalDateString(date)
    return bookings.filter(b =>
      b.room_id === roomId &&
      b.booking_date === dateStr
    )
  }

  const handleCellClick = (date: Date, roomId: string, time: string) => {
    if (!user) {
      toast.error('Veuillez vous connecter')
      return
    }

    const dateStr = getLocalDateString(date)

    const existing = bookings.find(b =>
      b.room_id === roomId &&
      b.booking_date === dateStr &&
      b.start_time <= time &&
      b.end_time > time
    )

    if (existing) {
      toast.info(`Réservé: ${existing.title}`)
      return
    }

    setSelectedDate(dateStr)
    setSelectedRoom(roomId)
    setShowAvailableRooms(false)
    setAvailableRooms([])
    setFormData({
      title: '',
      start_time: time,
      end_time: `${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:00`,
      room_id: roomId,
      booking_date: dateStr
    })
    setIsModalOpen(true)
  }

  const handleBookingSubmit = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter')
      return
    }

    if (!formData.title || !formData.room_id || !formData.booking_date) {
      toast.error('Veuillez remplir tous les champs')
      return
    }

    const hasConflict = bookings.some(b =>
      b.room_id === formData.room_id &&
      b.booking_date === formData.booking_date &&
      b.start_time < formData.end_time &&
      b.end_time > formData.start_time
    )

    if (hasConflict) {
      toast.error('⚠️ Ce créneau est déjà réservé')
      return
    }

    const { error } = await supabase
      .from('bookings')
      .insert({
        room_id: formData.room_id,
        user_id: user.id,
        title: formData.title,
        booking_date: formData.booking_date,
        start_time: formData.start_time,
        end_time: formData.end_time
      })

    if (error) {
      toast.error('Erreur: ' + error.message)
    } else {
      toast.success('✅ Salle réservée !')

      // Synchronisation avec la page Rooms : si ce créneau couvre l'instant présent
      // (réservation "maintenant"), on marque directement la salle comme occupée
      const now = new Date()
      const todayStr = getLocalDateString(now)
      const nowTime = now.toTimeString().slice(0, 5)

      if (
        formData.booking_date === todayStr &&
        formData.start_time <= nowTime &&
        formData.end_time > nowTime
      ) {
        const endDateTime = new Date(`${formData.booking_date}T${formData.end_time}:00`)
        await supabase
          .from('rooms')
          .update({
            is_occupied: true,
            occupied_by: user.id,
            occupied_at: now.toISOString(),
            occupied_until: endDateTime.toISOString(),
            current_people: 1
          })
          .eq('id', formData.room_id)
      }

      setIsModalOpen(false)
      setShowAvailableRooms(false)
      setAvailableRooms([])
      fetchBookings()
      setFormData({
        title: '',
        start_time: '09:00',
        end_time: '10:00',
        room_id: '',
        booking_date: ''
      })
    }
  }

  // Libellé de la semaine affichée, ex: "29 Juin – 5 Juillet 2026" ou "7 – 13 Juillet 2026"
  const weekLabel = useMemo(() => {
    const start = weekDays[0]
    const end = weekDays[6]
    const sameMonth = start.getMonth() === end.getMonth()
    if (sameMonth) {
      return `${start.getDate()} – ${end.getDate()} ${monthNames[start.getMonth()]} ${start.getFullYear()}`
    }
    return `${start.getDate()} ${monthShort[start.getMonth()]} – ${end.getDate()} ${monthShort[end.getMonth()]} ${end.getFullYear()}`
  }, [weekDays])

  const today = new Date()
  const visibleRooms = rooms.filter(r => r.category !== 'detente')

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
            📅 Réservations
          </h1>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          style={{ backgroundColor: PRIMARY }}
          className="hover:opacity-90 text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle réservation
        </Button>
      </div>

      {/* Navigation semaine */}
      <div className="flex items-center justify-between mb-6 bg-gray-50 dark:bg-[#1a1a2e] rounded-xl p-3">
        <button
          onClick={() => changeWeek(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#334155] shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all"
          style={{ color: PRIMARY }}
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            {weekLabel}
          </span>
          <button
            onClick={goToToday}
            className="text-sm font-medium px-3 py-1 rounded-md transition-colors"
            style={{ color: PRIMARY, backgroundColor: `${PRIMARY}14` }}
          >
            Aujourd'hui
          </button>
          <button
            onClick={openDatePicker}
            className="relative w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-[#334155] transition-colors"
            style={{ color: PRIMARY }}
            aria-label="Aller à une date précise"
            title="Sauter à une date (mois/année)"
          >
            <CalendarDays className="w-4.5 h-4.5" />
            <input
              ref={dateInputRef}
              type="date"
              value={getLocalDateString(currentDate)}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m, d] = e.target.value.split('-').map(Number)
                  setCurrentDate(new Date(y, m - 1, d))
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </button>
        </div>
        <button
          onClick={() => changeWeek(1)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#334155] shadow-sm hover:shadow-md hover:scale-105 active:scale-95 transition-all"
          style={{ color: PRIMARY }}
          aria-label="Semaine suivante"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Calendrier - vue semaine */}
      <Card className="border border-gray-200 dark:border-[#334155] shadow-sm rounded-xl overflow-hidden">
        <CardContent
          className="p-0 overflow-x-auto"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <table className="w-full border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '130px' }} />
              {weekDays.map((_, i) => (
                <col key={i} style={{ width: `calc((100% - 130px) / 7)` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="p-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-[#1a1a2e] sticky left-0 z-10">
                  Salle
                </th>
                {weekDays.map((day, index) => {
                  const accent = dayAccent[index]
                  const isToday = day.toDateString() === today.toDateString()
                  return (
                    <th key={index} className="p-2 text-center">
                      <div
                        className="px-3 py-2 rounded-lg text-center transition-transform"
                        style={{
                          backgroundColor: accent,
                          boxShadow: isToday ? `0 0 0 2px white, 0 0 0 4px ${accent}` : undefined
                        }}
                      >
                        <span className="text-xs text-white/75 font-medium tracking-wide">
                          {weekDayLabels[index]}
                        </span>
                        <span className="block text-lg font-semibold text-white">
                          {day.getDate()}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRooms.map((room, roomIndex) => {
                const roomColor = roomColors[roomIndex % roomColors.length]
                return (
                  <tr key={room.id} className="border-t border-gray-100 dark:border-[#334155] hover:bg-gray-50/50 dark:hover:bg-[#1a1a2e]/50 transition-colors">
                    <td className="p-3 bg-white dark:bg-[#0f172a] sticky left-0 z-10 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: roomColor }}></span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{room.name}</span>
                      </div>
                    </td>
                    {weekDays.map((day, dayIndex) => {
                      const dayBookings = getBookingsForDay(day, room.id)
                      const isToday = day.toDateString() === today.toDateString()

                      return (
                        <td
                          key={dayIndex}
                          className={`p-2 align-top text-center overflow-hidden ${isToday ? 'bg-[#2554E0]/[0.04]' : ''}`}
                        >
                          <div className="min-h-[56px] w-full flex flex-col items-stretch justify-center gap-1">
                            {dayBookings.length > 0 ? (
                              dayBookings.map((b) => (
                                <div
                                  key={b.id}
                                  onClick={() => toast.info(`${b.title} - ${b.start_time.slice(0, 5)} → ${b.end_time.slice(0, 5)}`)}
                                  className="w-full min-w-0 rounded-lg px-2 py-1.5 text-left text-white cursor-pointer hover:opacity-90 hover:scale-[1.02] transition-all overflow-hidden"
                                  style={{ backgroundColor: roomColor }}
                                >
                                  <div className="flex items-center gap-1 text-[10px] opacity-90">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span>{b.start_time.slice(0, 5)}h → {b.end_time.slice(0, 5)}h</span>
                                  </div>
                                  <div className="text-xs font-medium truncate leading-tight mt-0.5">
                                    {b.title}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <button
                                onClick={() => handleCellClick(day, room.id, '09:00')}
                                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#1e293b] text-gray-400 hover:text-white hover:scale-110 transition-all duration-300 flex items-center justify-center text-lg font-light"
                                style={{ '--hover-bg': PRIMARY } as React.CSSProperties}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = PRIMARY)}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                              >
                                +
                              </button>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Liste des réservations du jour */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
          Réservations du jour
        </h3>
        <div className="space-y-1.5">
          {bookings
            .filter(b => b.booking_date === getLocalDateString())
            .map((booking) => {
              const dayIndex = new Date(booking.booking_date).getDay()
              const color = dayAccent[dayIndex === 0 ? 6 : dayIndex - 1]
              return (
                <div key={booking.id} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1a1a2e] transition-colors">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {booking.start_time.slice(0, 5)} → {booking.end_time.slice(0, 5)}h
                  </span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>{booking.title}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">- {booking.room_name}</span>
                </div>
              )
            })}
          {bookings.filter(b => b.booking_date === getLocalDateString()).length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Aucune réservation aujourd'hui</p>
          )}
        </div>
      </div>

      {/* Modal de réservation */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ color: PRIMARY }}>📝 Nouvelle réservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Titre</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Réunion avec l'équipe"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.booking_date}
                onChange={(e) => {
                  setFormData({ ...formData, booking_date: e.target.value })
                  setShowAvailableRooms(false)
                  setAvailableRooms([])
                }}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Début</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => {
                    setFormData({ ...formData, start_time: e.target.value })
                    setShowAvailableRooms(false)
                    setAvailableRooms([])
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Fin</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => {
                    setFormData({ ...formData, end_time: e.target.value })
                    setShowAvailableRooms(false)
                    setAvailableRooms([])
                  }}
                  className="mt-1"
                />
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full transition-colors"
              style={{ borderColor: PRIMARY, color: PRIMARY }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = PRIMARY
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ''
                e.currentTarget.style.color = PRIMARY
              }}
              onClick={() => checkAvailableRooms(formData.booking_date, formData.start_time, formData.end_time)}
            >
              🔍 Voir les salles disponibles
            </Button>

            {showAvailableRooms && (
              <div className="mt-2">
                <p className="text-sm font-medium mb-2" style={{ color: PRIMARY }}>
                  {availableRooms.length} salle{availableRooms.length > 1 ? 's' : ''} disponible{availableRooms.length > 1 ? 's' : ''}
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableRooms.map((room) => (
                    <div
                      key={room.id}
                      className={`
                        p-3 rounded-lg border-2 cursor-pointer transition-all
                        ${formData.room_id === room.id
                          ? 'border-[#2554E0] bg-blue-50 dark:bg-blue-900/20 shadow-md'
                          : 'border-gray-200 dark:border-[#334155] hover:border-[#2554E0] hover:shadow-md'
                        }
                      `}
                      onClick={() => {
                        setFormData({ ...formData, room_id: room.id })
                        toast.success(`Salle "${room.name}" sélectionnée`)
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{room.name}</span>
                        <span className="text-xs text-gray-400">👥 {room.capacity}</span>
                      </div>
                      {room.location && (
                        <p className="text-xs text-gray-400 mt-1">{room.location}</p>
                      )}
                    </div>
                  ))}
                  {availableRooms.length === 0 && (
                    <div className="p-4 text-center text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      ⚠️ Aucune salle disponible
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label>Salle sélectionnée</Label>
              {formData.room_id ? (
                <div className="mt-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex justify-between items-center border-2 border-green-200 dark:border-green-800">
                  <span className="font-medium" style={{ color: PRIMARY }}>
                    {rooms.find(r => r.id === formData.room_id)?.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, room_id: '' })}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Aucune salle sélectionnée</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsModalOpen(false)
                setShowAvailableRooms(false)
                setAvailableRooms([])
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleBookingSubmit}
              style={{ backgroundColor: PRIMARY }}
              className="hover:opacity-90 text-white"
              disabled={!formData.room_id}
            >
              Réserver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}