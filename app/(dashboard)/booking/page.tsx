'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

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

  // Nouvelle réservation
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
      toast.error('Please sign in to book a room')
      return
    }

    if (!newBooking.title || !newBooking.room_id || !newBooking.start || !newBooking.end) {
      toast.error('Please fill all fields')
      return
    }

    // newBooking.start / .end sont des chaînes "datetime-local" du type
    // "2026-08-05T14:30". On les découpe en booking_date / start_time /
    // end_time car c'est le schéma utilisé partout ailleurs (occupation
    // directe, rappels, sync du statut des salles) — sans ça, la salle ne
    // devient jamais "occupée" ni "libre" automatiquement pour cette
    // réservation.
    const [startDatePart, startTimePart] = newBooking.start.split('T')
    const [endDatePart, endTimePart] = newBooking.end.split('T')

    if (startDatePart !== endDatePart) {
      toast.error('Start and end must be on the same day')
      return
    }

    if (endTimePart <= startTimePart) {
      toast.error('End time must be after start time')
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
      toast.error('Error booking room')
    } else {
      toast.success('Room booked!')
      fetchData()
      setIsDialogOpen(false)
      setNewBooking({ title: '', start: '', end: '', room_id: '' })
    }
  }

  const handleBookingDelete = async (bookingId: string) => {
    if (!confirm('Are you sure?')) return
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)
    
    if (error) {
      toast.error('Error deleting booking')
    } else {
      toast.success('Booking deleted')
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
        <h1 className="text-3xl font-bold text-[#0056B3]">📅 Booking</h1>
      </div>

      {/* Sélecteur de salle */}
      <div className="mb-4">
        <Label>Select Room</Label>
        <select
          className="w-full border rounded-lg p-2"
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
        >
          <option value="">All rooms</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
      </div>

      {/* Calendrier */}
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
                title: `${b.room_name} - ${b.title}`,
                start: `${b.booking_date}T${b.start_time}`,
                end: `${b.booking_date}T${b.end_time}`,
                extendedProps: { booking: b }
              }))
            }
            eventClick={(info) => {
              const booking = info.event.extendedProps.booking
              if (confirm(`Delete "${booking.title}" in ${booking.room_name}?`)) {
                handleBookingDelete(booking.id)
              }
            }}
            height="auto"
          />
        </CardContent>
      </Card>

      {/* Dialog pour ajouter */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book a Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newBooking.title}
                onChange={(e) => setNewBooking({...newBooking, title: e.target.value})}
                placeholder="Meeting with team"
              />
            </div>
            <div>
              <Label>Room</Label>
              <select
                className="w-full border rounded-lg p-2"
                value={newBooking.room_id}
                onChange={(e) => setNewBooking({...newBooking, room_id: e.target.value})}
              >
                <option value="">Select a room</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start</Label>
                <Input
                  type="datetime-local"
                  value={newBooking.start}
                  onChange={(e) => setNewBooking({...newBooking, start: e.target.value})}
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={newBooking.end}
                  onChange={(e) => setNewBooking({...newBooking, end: e.target.value})}
                />
              </div>
            </div>
            <Button onClick={handleBookingSubmit} className="w-full">
              Book Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}