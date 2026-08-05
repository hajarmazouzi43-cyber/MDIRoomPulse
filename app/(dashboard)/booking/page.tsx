// app/(dashboard)/booking/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Booking {
  id: string
  room_id: string
  user_id: string
  title: string
  booking_date: string
  start_time: string
  end_time: string
  status: string
  room_name: string
}

export default function BookingPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [selectedRoom, setSelectedRoom] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const { t } = useLanguage()

  // ✅ Fonction helper pour les traductions avec variables
  const tWithVars = (key: string, vars?: Record<string, string | number>): string => {
    let message = t(key)
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        message = message.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
      }
    }
    return message
  }

  const [newBooking, setNewBooking] = useState({
    title: '',
    start: '',
    end: '',
    room_id: ''
  })

  useEffect(() => {
    fetchData()
    getUser()
  }, [])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const fetchData = async () => {
    setLoading(true)
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*, rooms(name)')
      .order('booking_date')
      .order('start_time')
    
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('*')
      .order('name')

    if (bookingsData) {
      setBookings(bookingsData.map(b => ({
        ...b,
        room_name: b.rooms?.name || 'Inconnue'
      })))
    }
    if (roomsData) setRooms(roomsData)
    setLoading(false)
  }

  const handleDateSelect = (selectInfo: any) => {
    setSelectedDate(selectInfo.startStr)
    setNewBooking({
      title: '',
      start: selectInfo.startStr,
      end: selectInfo.endStr,
      room_id: selectedRoom || rooms[0]?.id || ''
    })
    setIsDialogOpen(true)
  }

  const handleBookingSubmit = async () => {
    if (!user) {
      toast.error(t('booking.pleaseSignIn'))
      return
    }

    if (!newBooking.title || !newBooking.room_id || !newBooking.start || !newBooking.end) {
      toast.error(t('booking.fillAllFields'))
      return
    }

    const [startDatePart, startTimePart] = newBooking.start.split('T')
    const [endDatePart, endTimePart] = newBooking.end.split('T')

    if (startDatePart !== endDatePart) {
      toast.error(t('booking.sameDayRequired'))
      return
    }

    if (endTimePart <= startTimePart) {
      toast.error(t('booking.endAfterStart'))
      return
    }

    const { error } = await supabase
      .from('bookings')
      .insert({
        title: newBooking.title,
        booking_date: startDatePart,
        start_time: startTimePart,
        end_time: endTimePart,
        status: 'confirmed',
        room_id: newBooking.room_id,
        user_id: user.id
      })

    if (error) {
      toast.error(t('booking.bookError'))
    } else {
      toast.success(t('booking.bookSuccess'))
      fetchData()
      setIsDialogOpen(false)
      setNewBooking({ title: '', start: '', end: '', room_id: '' })
    }
  }

  const handleBookingDelete = async (bookingId: string) => {
    if (!confirm(tWithVars('booking.deleteConfirm', { title: 'cette réservation', room: 'salle' }))) return
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)
    
    if (error) {
      toast.error(t('booking.deleteError'))
    } else {
      toast.success(t('booking.deleteSuccess'))
      fetchData()
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#0056B3]">{t('booking.title')}</h1>
      </div>

      <div className="mb-4">
        <Label>{t('booking.selectRoom')}</Label>
        <select
          className="w-full border rounded-lg p-2"
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
        >
          <option value="">{t('booking.allRooms')}</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-4">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,dayGridWeek'
            }}
            initialView="dayGridMonth"
            selectable={true}
            select={handleDateSelect}
            events={bookings
              .filter(b => !selectedRoom || b.room_id === selectedRoom)
              .map(b => ({
                id: b.id,
                title: tWithVars('booking.eventTitle', { room: b.room_name, title: b.title }),
                start: `${b.booking_date}T${b.start_time}`,
                end: `${b.booking_date}T${b.end_time}`,
                extendedProps: { booking: b }
              }))
            }
            eventClick={(info) => {
              const booking = info.event.extendedProps.booking
              if (confirm(tWithVars('booking.deleteConfirm', { title: booking.title, room: booking.room_name }))) {
                handleBookingDelete(booking.id)
              }
            }}
            height="auto"
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('booking.bookRoom')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('booking.titleLabel')}</Label>
              <Input
                value={newBooking.title}
                onChange={(e) => setNewBooking({...newBooking, title: e.target.value})}
                placeholder={t('booking.titlePlaceholder')}
              />
            </div>
            <div>
              <Label>{t('booking.roomLabel')}</Label>
              <select
                className="w-full border rounded-lg p-2"
                value={newBooking.room_id}
                onChange={(e) => setNewBooking({...newBooking, room_id: e.target.value})}
              >
                <option value="">{t('booking.selectRoom')}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('booking.startLabel')}</Label>
                <Input
                  type="datetime-local"
                  value={newBooking.start}
                  onChange={(e) => setNewBooking({...newBooking, start: e.target.value})}
                />
              </div>
              <div>
                <Label>{t('booking.endLabel')}</Label>
                <Input
                  type="datetime-local"
                  value={newBooking.end}
                  onChange={(e) => setNewBooking({...newBooking, end: e.target.value})}
                />
              </div>
            </div>
            <Button onClick={handleBookingSubmit} className="w-full">
              {t('booking.book')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}