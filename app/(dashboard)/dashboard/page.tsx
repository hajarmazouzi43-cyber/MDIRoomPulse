'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { notifyBookingReminder } from '@/lib/notifications'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Booking {
  id: string
  room_id: string
  user_id: string
  title: string
  description: string
  booking_date: string
  start_time: string
  end_time: string
  is_confidential: boolean
  room_name?: string
  user_email?: string
}

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedRoom, setSelectedRoom] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<{date: string, time: string} | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '09:00',
    end_time: '10:00',
    room_id: '',
    booking_date: '',
    is_confidential: false
  })

  const supabase = createClient()

  // Heures de travail (8h à 19h)
  const workingHours = Array.from({ length: 12 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`)

  useEffect(() => {
    getUser()
    fetchRooms()
  }, [])

  useEffect(() => {
    if (user) {
      fetchBookings()
    }
  }, [currentWeek, user])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('name')
    if (data) setRooms(data)
  }
  
  const sendReminder = async (bookingId: string) => {
    const result = await notifyBookingReminder(bookingId)
    if (result.email > 0 || result.whatsapp > 0) {
      toast.success(`📢 Reminder sent to ${result.email + result.whatsapp} users`)
    }
  }

  const fetchBookings = async () => {
    setLoading(true)
    
    const startOfWeek = new Date(currentWeek)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1)
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const { data: bookingsData } = await supabase
      .from('bookings')
      .select(`
        *,
        rooms!inner(name),
        profiles!inner(email)
      `)
      .gte('booking_date', startOfWeek.toISOString().split('T')[0])
      .lte('booking_date', endOfWeek.toISOString().split('T')[0])
      .order('booking_date')
      .order('start_time')

    if (bookingsData) {
      const formatted = bookingsData.map((b: any) => ({
        ...b,
        room_name: b.rooms?.name || 'N/A',
        user_email: b.profiles?.email || 'N/A'
      }))
      setBookings(formatted)
    }
    setLoading(false)
  }

  const changeWeek = (direction: number) => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(newWeek.getDate() + direction * 7)
    setCurrentWeek(newWeek)
  }

  const getWeekDays = () => {
    const start = new Date(currentWeek)
    start.setDate(start.getDate() - start.getDay() + 1)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      return date
    })
  }

  const isSlotBooked = (roomId: string, date: string, time: string) => {
    return bookings.some(b => 
      b.room_id === roomId && 
      b.booking_date === date && 
      b.start_time <= time && 
      b.end_time > time
    )
  }

  const isRoomOutOfService = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId)
    return room?.is_out_of_service || false
  }

  const getBookingForSlot = (roomId: string, date: string, time: string) => {
    return bookings.find(b => 
      b.room_id === roomId && 
      b.booking_date === date && 
      b.start_time <= time && 
      b.end_time > time
    )
  }

  const handleCellClick = (roomId: string, date: string, time: string) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour réserver')
      return
    }

    if (isRoomOutOfService(roomId)) {
      const room = rooms.find(r => r.id === roomId)
      toast.error(`🚫 Cette salle est hors service${room?.out_of_service_reason ? ` : ${room.out_of_service_reason}` : ''}`)
      return
    }

    const booked = isSlotBooked(roomId, date, time)
    if (booked) {
      const booking = getBookingForSlot(roomId, date, time)
      toast.info(`Réservé: ${booking?.title} - ${booking?.user_email}`)
      return
    }

    setSelectedSlot({ date, time })
    setSelectedRoom(roomId)
    setSelectedDate(date)
    setFormData({
      ...formData,
      start_time: time,
      end_time: `${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:00`,
      room_id: roomId,
      booking_date: date
    })
    setIsModalOpen(true)
  }

  const handleBookingSubmit = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter')
      return
    }

    if (isRoomOutOfService(formData.room_id)) {
      const room = rooms.find(r => r.id === formData.room_id)
      toast.error(`🚫 Cette salle est hors service${room?.out_of_service_reason ? ` : ${room.out_of_service_reason}` : ''}`)
      return
    }

    const hasConflict = bookings.some(b => 
      b.room_id === formData.room_id &&
      b.booking_date === formData.booking_date &&
      b.start_time < formData.end_time &&
      b.end_time > formData.start_time
    )

    if (hasConflict) {
      toast.error('⚠️ Impossible de réserver : un autre utilisateur a déjà réservé ce créneau. Choisissez un autre horaire.')
      return
    }

    const { error } = await supabase
      .from('bookings')
      .insert({
        room_id: formData.room_id,
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        booking_date: formData.booking_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        is_confidential: formData.is_confidential
      })

    if (error) {
      toast.error('Erreur lors de la réservation: ' + error.message)
    } else {
      toast.success('✅ Salle réservée avec succès !')
      setIsModalOpen(false)
      fetchBookings()
      setFormData({
        title: '',
        description: '',
        start_time: '09:00',
        end_time: '10:00',
        room_id: '',
        booking_date: '',
        is_confidential: false
      })
    }
  }

  const weekDays = getWeekDays()
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header avec navigation améliorée */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0056B3] dark:text-[#00A3E0]">
          📅 Dashboard - Planning Hebdomadaire
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 dark:bg-[#1e293b] p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeWeek(-1)}
              className="w-8 h-8 p-0 hover:bg-gray-200 dark:hover:bg-[#334155] rounded-lg text-lg"
            >
              ◀
            </Button>
            <span className="text-xs sm:text-sm font-medium px-2 min-w-[120px] text-center">
              {weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeWeek(1)}
              className="w-8 h-8 p-0 hover:bg-gray-200 dark:hover:bg-[#334155] rounded-lg text-lg"
            >
              ▶
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCurrentWeek(new Date())
              fetchBookings()
            }}
            className="text-xs sm:text-sm bg-[#0056B3] text-white hover:bg-[#00449E] border-0"
          >
            📍 Aujourd'hui
          </Button>
        </div>
      </div>

      {/* Tableau du planning coloré */}
      <div className="overflow-x-auto rounded-lg border dark:border-[#334155]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-3 bg-gray-200 dark:bg-[#1e293b] dark:border-[#334155] min-w-[120px] sticky left-0 z-10">
                <span className="font-semibold text-sm">Salles / Jours</span>
              </th>
              {weekDays.map((date) => (
                <th key={date.toISOString()} className="border p-3 bg-gray-200 dark:bg-[#1e293b] dark:border-[#334155] min-w-[120px]">
                  <div className="text-center">
                    <div className="font-semibold text-sm">{date.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                    <div className="text-xs text-gray-500">{date.toLocaleDateString('fr-FR')}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <td className="border p-2 font-medium bg-gray-100 dark:bg-[#1e293b] dark:border-[#334155] sticky left-0 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{room.name}</span>
                    {room.is_confidential && <span className="text-xs text-red-500">🔒</span>}
                    {room.is_out_of_service && <span className="text-xs text-gray-500">🚫</span>}
                  </div>
                </td>
                {weekDays.map((date) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const isOutOfService = isRoomOutOfService(room.id)
                  
                  return (
                    <td key={dateStr} className="border p-1 dark:border-[#334155]">
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {workingHours.map((time) => {
                          const booked = isSlotBooked(room.id, dateStr, time)
                          const booking = getBookingForSlot(room.id, dateStr, time)
                          const isCurrentSlot = selectedSlot?.date === dateStr && selectedSlot?.time === time
                          
                          let bgColor = 'bg-gray-50 dark:bg-[#1a1a2e]'
                          let textColor = 'text-gray-400'
                          let hoverColor = 'hover:bg-gray-100 dark:hover:bg-[#2d2d4e]'
                          let cursor = 'cursor-pointer'
                          let border = 'border border-gray-200 dark:border-[#2d2d4e]'
                          
                          if (isOutOfService) {
                            bgColor = 'bg-gray-200 dark:bg-gray-700'
                            textColor = 'text-gray-500'
                            cursor = 'cursor-not-allowed'
                            hoverColor = ''
                          } else if (booked && booking) {
                            bgColor = booking.is_confidential 
                              ? 'bg-purple-500 dark:bg-purple-700' 
                              : 'bg-blue-500 dark:bg-blue-600'
                            textColor = 'text-white'
                            hoverColor = 'hover:brightness-110'
                            border = 'border-blue-600 dark:border-blue-700'
                          } else {
                            bgColor = 'bg-green-100 dark:bg-green-900/30'
                            textColor = 'text-gray-600 dark:text-gray-300'
                            hoverColor = 'hover:bg-green-200 dark:hover:bg-green-900/50'
                            border = 'border-green-200 dark:border-green-800'
                          }
                          
                          return (
                            <div
                              key={time}
                              onClick={() => handleCellClick(room.id, dateStr, time)}
                              className={`
                                text-xs p-2 rounded transition-all duration-200
                                ${bgColor} ${textColor} ${hoverColor} ${cursor} ${border}
                                ${isCurrentSlot ? 'ring-2 ring-yellow-400 shadow-lg' : ''}
                                ${booked ? 'font-medium' : ''}
                              `}
                            >
                              {isOutOfService ? (
                                <span className="flex items-center justify-center gap-1">
                                  🚫 <span className="text-xs">Hors service</span>
                                </span>
                              ) : booked && booking ? (
                                <div className="flex flex-col">
                                  <span className="font-semibold text-xs">
                                    {booking.is_confidential ? '🔒 ' : ''}
                                    {time.slice(0, 5)}
                                  </span>
                                  <span className="text-xs truncate font-medium">
                                    {booking.title || 'Réunion'}
                                  </span>
                                  <span className="text-[10px] opacity-80">
                                    {booking.user_email?.split('@')[0] || ''}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-center block">{time.slice(0, 5)}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="mt-4 flex flex-wrap gap-4 p-3 bg-gray-50 dark:bg-[#1e293b] rounded-lg border dark:border-[#334155]">
        <span className="flex items-center gap-2 text-sm">
          <span className="w-4 h-4 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded"></span>
          Libre
        </span>
        <span className="flex items-center gap-2 text-sm">
          <span className="w-4 h-4 bg-blue-500 rounded"></span>
          Réservé
        </span>
        <span className="flex items-center gap-2 text-sm">
          <span className="w-4 h-4 bg-purple-500 rounded"></span>
          Réservé (Confidentiel)
        </span>
        <span className="flex items-center gap-2 text-sm">
          <span className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></span>
          Hors service
        </span>
        <span className="flex items-center gap-2 text-sm">
          <span className="w-4 h-4 border-2 border-yellow-400 rounded"></span>
          Sélectionné
        </span>
      </div>

      {/* Statistiques */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total réservations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{bookings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Salles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rooms.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{weekStart.toLocaleDateString('fr-FR')} - {weekEnd.toLocaleDateString('fr-FR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taux d'occupation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {rooms.length > 0 && workingHours.length > 0
                ? Math.round((bookings.length / (rooms.length * workingHours.length * 7)) * 100)
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}