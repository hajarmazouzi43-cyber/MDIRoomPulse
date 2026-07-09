'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { toast } from 'sonner'
import { notifyRoomStatusChange, askWhoIsFree } from '@/lib/notifications'

console.log('ROOMS PAGE LOADED')

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

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchRooms()
    getUser()

    const channel = supabase
      .channel('rooms-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms'
        },
        () => {
          console.log('🔄 Room changed, refreshing...')
          fetchRooms()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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
      setRooms(data)
    }
    setLoading(false)
  }

  const allOccupied = rooms.filter(r => r.category !== 'detente' && !r.is_out_of_service).every(r => r.is_occupied)
  const hasFreeRooms = rooms.some(r => r.category !== 'detente' && !r.is_out_of_service && !r.is_occupied)

  const occupyRoomWithTime = async (roomId: string, roomName: string, peopleCount: number = 1, startTime: string, endTime: string) => {
    if (!user) {
      toast.error('Please sign in to occupy a room')
      return
    }

    // ✅ Vérifier si la salle est hors service
    const { data: roomStatus } = await supabase
      .from('rooms')
      .select('is_out_of_service, out_of_service_reason')
      .eq('id', roomId)
      .single()

    if (roomStatus?.is_out_of_service) {
      toast.error(`🚫 Cette salle est hors service${roomStatus.out_of_service_reason ? ` : ${roomStatus.out_of_service_reason}` : ''}`)
      return
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('max_people, current_people')
      .eq('id', roomId)
      .single()

    if (!room) {
      toast.error('Room not found')
      return
    }

    const maxPeople = room.max_people || 1
    const currentPeople = room.current_people || 0

    if (currentPeople >= maxPeople) {
      toast.error(`Room is full (${currentPeople}/${maxPeople})`)
      return
    }

    const newTotal = Math.min(currentPeople + peopleCount, maxPeople)

    const today = new Date().toISOString().split('T')[0]
    const startDateTime = new Date(`${today}T${startTime}:00`)
    const endDateTime = new Date(`${today}T${endTime}:00`)

    if (endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1)
    }

    const { error } = await supabase
      .from('rooms')
      .update({
        is_occupied: true,
        occupied_by: user.id,
        occupied_at: startDateTime.toISOString(),
        current_people: newTotal,
        occupied_until: endDateTime.toISOString(),
        occupation_duration: Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000)
      })
      .eq('id', roomId)

    if (error) {
      toast.error('Error occupying room')
    } else {
      toast.success(`${roomName}: ${newTotal}/${maxPeople} people from ${startTime} to ${endTime}`)
      
      const result = await notifyRoomStatusChange(roomId, 'occupied')
      if (result.email > 0 || result.whatsapp > 0) {
        toast.info(`📢 ${result.email + result.whatsapp} subscribers notified`)
      }
      
      fetchRooms()
    }
  }

  const freeRoom = async (roomId: string, roomName: string) => {
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
      toast.error('Error freeing room')
      return
    }

    toast.success(`${roomName} is now available`)

    const result = await notifyRoomStatusChange(roomId, 'free')
    if (result.email > 0 || result.whatsapp > 0) {
      toast.info(` ${result.email + result.whatsapp} subscribers notified`)
    }

    fetchRooms()
  }

  const handleAskWhoIsFree = async () => {
    if (!user) {
      toast.error('Please sign in to ask')
      return
    }

    toast.info('Asking who is free...')
    
    const result = await askWhoIsFree(user.id, user.email?.split('@')[0] || 'User')
    
    if (result.success) {
      toast.success(` ${result.free} rooms free, ${result.occupied} occupied`)
      console.log('Response:', result.response)
    } else {
      toast.error('Error checking room status')
    }
  }

  const categoryIcons: Record<string, string> = {
    bureau: '',
    reunion: '',
    poste: '',
    detente: ''
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-[#1e293b] rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-[#1e293b] rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  console.log('Rendering rooms, count:', rooms.length)

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-[#0056B3] dark:text-[#00A3E0]">
          Rooms & Spaces
        </h1>
        
        <Button
          onClick={handleAskWhoIsFree}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Who is free?
        </Button>
      </div>

      {allOccupied && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-4 mb-6 rounded">
          <div className="flex items-center">
            <span className="text-2xl mr-3"></span>
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-400">All rooms are occupied</p>
              <p className="text-yellow-700 dark:text-yellow-300">
                Please take a seat in the lounge area with comfortable sofas.
              </p>
            </div>
          </div>
        </div>
      )}

      {!allOccupied && hasFreeRooms && (
        <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-400 p-4 mb-6 rounded">
          <p className="text-green-700 dark:text-green-400">
            Some spaces are available. Check the list below.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const icon = categoryIcons[room.category] || ''
          const isDetente = room.category === 'detente'
          
          return (
            <Card 
              key={room.id} 
              className={`
                hover:shadow-lg transition-shadow 
                ${room.is_out_of_service 
                  ? 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/30' 
                  : room.is_occupied 
                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20' 
                    : 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                } 
                relative
              `}
            >
              {room.is_confidential && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded-bl-lg rounded-tr-lg">
                  🔒 Confidential
                </div>
              )}
              {room.is_out_of_service && (
                <div className="absolute top-0 left-0 bg-gray-600 text-white text-xs px-2 py-1 rounded-tr-lg rounded-bl-lg">
                  🚫 Hors service
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center">
                  <span className="flex items-center gap-2 dark:text-white">
                    <span>{icon}</span>
                    <span>{room.name}</span>
                  </span>
                  {room.is_out_of_service ? (
                    <Badge className="bg-gray-500">
                      🚫 Hors service
                    </Badge>
                  ) : (
                    <Badge className={room.is_occupied ? 'bg-red-500' : 'bg-green-500'}>
                      {room.is_occupied ? 'Occupied' : 'Available'}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="dark:text-gray-300">Capacity: {room.capacity} person{room.capacity > 1 ? 's' : ''}</p>
                
                {room.max_people > 0 && (
                  <p className="text-sm dark:text-gray-300">
                    People: <span className="font-semibold">{room.current_people || 0}</span> / {room.max_people}
                  </p>
                )}
                
                {room.location && <p className="dark:text-gray-300">Location: {room.location}</p>}
                
                {room.equipment && room.equipment.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Equipment:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {room.equipment.slice(0, 3).map((item: string) => (
                        <span key={item} className="text-xs bg-gray-100 dark:bg-[#1e293b] px-2 py-1 rounded-full dark:text-gray-300">
                          {item}
                        </span>
                      ))}
                      {room.equipment.length > 3 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">+{room.equipment.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}

                {room.is_out_of_service && room.out_of_service_reason && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Raison: {room.out_of_service_reason}
                  </p>
                )}

                {!isDetente && user && !room.is_out_of_service && (
                  <div className="flex flex-col gap-2 mt-2">
                    {!room.is_occupied ? (
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex flex-wrap items-center gap-2 w-full">
                          <input
                            type="number"
                            min={1}
                            max={(room.max_people || 1) - (room.current_people || 0)}
                            defaultValue={1}
                            className="w-12 sm:w-14 h-10 text-center border rounded-lg bg-white dark:bg-[#1e293b] dark:border-[#334155] dark:text-white flex-shrink-0"
                            id={`people-${room.id}`}
                          />
                          <input
                            type="time"
                            defaultValue="13:00"
                            className="w-20 sm:w-24 h-10 text-center border rounded-lg bg-white dark:bg-[#1e293b] dark:border-[#334155] dark:text-white flex-shrink-0"
                            id={`start-time-${room.id}`}
                          />
                          <input
                            type="time"
                            defaultValue="16:00"
                            className="w-20 sm:w-24 h-10 text-center border rounded-lg bg-white dark:bg-[#1e293b] dark:border-[#334155] dark:text-white flex-shrink-0"
                            id={`end-time-${room.id}`}
                          />
                          <Button
                            onClick={() => {
                              const peopleInput = document.getElementById(`people-${room.id}`) as HTMLInputElement
                              const startInput = document.getElementById(`start-time-${room.id}`) as HTMLInputElement
                              const endInput = document.getElementById(`end-time-${room.id}`) as HTMLInputElement
                              const count = parseInt(peopleInput?.value) || 1
                              const startTime = startInput?.value || '13:00'
                              const endTime = endInput?.value || '16:00'
                              occupyRoomWithTime(room.id, room.name, count, startTime, endTime)
                            }}
                            className="flex-1 min-w-[70px] bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 h-10"
                          >
                            Occupy
                          </Button>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">People | Start | End</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex flex-wrap items-center justify-between bg-gray-100 dark:bg-[#1e293b] rounded-lg px-3 py-2 gap-2">
                          <span className="text-sm font-medium dark:text-white">
                            {room.current_people || 0}/{room.max_people || room.capacity || 1} people
                          </span>
                          {room.occupied_at && room.occupied_until && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              ⏱️ {new Date(room.occupied_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})} 
                              → {new Date(room.occupied_until).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}
                            </span>
                          )}
                        </div>
                        <Button
                          onClick={() => freeRoom(room.id, room.name)}
                          className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                       