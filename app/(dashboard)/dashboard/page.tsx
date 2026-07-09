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
  
  // Fonction pour envoyer un rappel
  const sendReminder = async (bookingId: string) => {
    const result = await notifyBookingReminder(bookingId)
    if (result.email > 0 || result.whatsapp > 0) {
      toast.success(`📢 Reminder sent to ${result.email + result.whatsapp} users`)
    }
  }

  const fetchBookings = async () => {
    setLoading(true)
    
    // Calculer le début et la fin de la semaine
    const startOfWeek = new Date(currentWeek)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1) // Lundi
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 6) // Dimanche
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

  // Naviguer dans les semaines
  const changeWeek = (direction: number) => {
    const newWeek = new Date(currentWeek)
    newWeek.setDate(newWeek.getDate() + direction * 7)
    setCurrentWeek(newWeek)
  }

  // Obtenir les jours de la semaine
  const getWeekDays = () => {
    const start = new Date(currentWeek)
    start.setDate(start.getDate() - start.getDay() + 1)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      return date
    })
  }

  // Vérifier si un créneau est réservé
  const isSlotBooked = (roomId: string, date: string, time: string) => {
    return bookings.some(b => 
      b.room_id === roomId && 
      b.booking_date === date && 
      b.start_time <= time && 
      b.end_time > time
    )
  }

  // ✅ Vérifier si une salle est hors service
  const isRoomOutOfService = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId)
    return room?.is_out_of_service || false
  }

  // Récupérer la réservation pour un créneau
  const getBookingForSlot = (roomId: string, date: string, time: string) => {
    return bookings.find(b => 
      b.room_id === roomId && 
      b.booking_date === date && 
      b.start_time <= time && 
      b.end_time > time
    )
  }

  // Gérer le clic sur une cellule
  const handleCellClick = (roomId: string, date: string, time: string) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour réserver')
      return
    }

    // ✅ Vérifier si la salle est hors service
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

    // Ouvrir la modale de réservation
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

  // Soumettre la réservation
  const handleBookingSubmit = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter')
      return
    }

    // ✅ Vérifier à nouveau si la salle est hors service
    if (isRoomOutOfService(formData.room_id)) {
      const room = rooms.find(r => r.id === formData.room_id)
      toast.error(`🚫 Cette salle est hors service${room?.out_of_service_reason ? ` : ${room.out_of_service_reason}` : ''}`)
      return
    }

    // Vérifier les conflits
    const hasConflict = bookings.some(b => 
      b.room_id === formData.room_id &&
      b.booking_date === formData.booking_date &&
      b.start_time < formData.end_time &&
      b.end_time > formData.start_time &&
      b.id !== formData.id // Pour les modifications
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
      {/* Header avec navigation */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#0056B3] dark:text-[#00A3E0]">
          📅 Dashboard - Planning Hebdomadaire
        </h1>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => changeWeek(-1)}
            className="text-lg"
          >
            ◀
          </Button>
          <span className="text-sm font-medium">
            {weekStart.toLocaleDateString('fr-FR')} - {weekEnd.toLocaleDateString('fr-FR')}
          </span>
          <Button
            variant="outline"
            onClick={() => changeWeek(1)}
            className="text-lg"
          >
            ▶
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCurrentWeek(new Date())
              fetchBookings()
            }}
            className="text-sm"
          >
            Aujourd'hui
          </Button>
        </div>
      </div>

      {/* Tableau du planning */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2 bg-gray-100 dark:bg-[#1e293b] dark:border-[#334155] min-w-[120px]">
                <span className="font-semibold">Salles / Jours</span>
              </th>
              {weekDays.map((date) => (
                <th key={date.toISOString()} className="border p-2 bg-gray-100 dark:bg-[#1e293b] dark:border-[#334155] min-w-[120px]">
                  <div className="text-center">
                    <div className="font-semibold">{date.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                    <div className="text-sm text-gray-500">{date.toLocaleDateString('fr-FR')}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id}>
                <td className="border p-2 font-medium bg-gray-50 dark:bg-[#1e293b] dark:border-[#334155]">
                  <div className="flex items-center gap-2">
                    <span>{room.name}</span>
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
                          
                          return (
                            <div
                              key={time}
                              onClick={() => handleCellClick(room.id, dateStr, time)}
                              className={`
                                text-xs p-1 rounded cursor-pointer transition-all
                                ${isOutOfService 
                                  ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50' 
                                  : booked 
                                    ? 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50' 
                                    : 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50'
                                }
                                ${isCurrentSlot ? 'ring-2 ring-blue-500' : ''}
                              `}
                            >
                              {isOutOfService ? (
                                <span className="text-gray-500">🚫 Hors service</span>
                              ) : booked && booking ? (
                                <div className="truncate" title={booking.title}>
                                  {booking.is_confidential ? '🔒 ' : ''}
                                  {time} - {booking.title}
                                </div>
                              ) : (
                                <span className="text-gray-400">{time}</span>
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

      {/* Modal de réservation */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📝 Réserver une salle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Salle</Label>
              <select
                className="w-full border rounded-lg p-2 dark:bg-[#1e293b] dark:border-[#334155]"
                value={formData.room_id}
                onChange={(e) => setFormData({...formData, room_id: e.target.value})}
              >
                <option value="">Choisir une salle</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} {room.is_out_of_service ? '🚫 (Hors service)' : ''}
                  </option>
                ))}
              </select>
              {formData.room_id && isRoomOutOfService(formData.room_id) && (
                <p className="text-sm text-red-500 mt-1">
                  ⚠️ Cette salle est actuellement hors service
                </p>
              )}
            </div>
            <div>
              <Label>Titre</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Nom de la réunion"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Description (optionnel)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Début</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                />
              </div>
              <div>
                <Label>Fin</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                />
              </div>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.booking_date}
                onChange={(e) => setFormData({...formData, booking_date: e.target.value})}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_confidential}
                onChange={(e) => setFormData({...formData, is_confidential: e.target.checked})}
                className="w-4 h-4"
              />
              <Label>🔒 Réservation confidentielle</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleBookingSubmit} 
              className="bg-[#0056B3] hover:bg-[#00449E]"
              disabled={formData.room_id && isRoomOutOfService(formData.room_id)}
            >
              Réserver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
