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
  occupied_by: string | null
  occupied_at: string | null
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

      // ✅ Realtime
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

  const allOccupied = rooms.filter(r => r.category !== 'detente').every(r => r.is_occupied)
  const hasFreeRooms = rooms.some(r => r.category !== 'detente' && !r.is_occupied)

const occupyRoom = async (roomId: string, roomName: string, peopleCount: number = 1) => {
  if (!user) {
    toast.error('Please sign in to occupy a room')
    return
  }

  console.log('📊 Occupying:', { roomId, roomName, peopleCount })

  const { data: room } = await supabase
    .from('rooms')
    .select('max_people, current_people')
    .eq('id', roomId)
    .single()

  console.log('📊 Room data:', room)

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
  console.log('📊 New total:', newTotal)

  const { error } = await supabase
    .from('rooms')
    .update({
      is_occupied: true,
      occupied_by: user.id,
      occupied_at: new Date().toISOString(),
      current_people: newTotal
    })
    .eq('id', roomId)

  console.log('📊 Update error:', error)

  if (error) {
    toast.error('Error occupying room')
  } else {
    toast.success(`${roomName}: ${newTotal}/${maxPeople} people`)
    
    const result = await notifyRoomStatusChange(roomId, 'occupied')
    if (result.email > 0 || result.whatsapp > 0) {
      toast.info(` ${result.email + result.whatsapp} subscribers notified`)
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
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
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
        <h1 className="text-3xl font-bold text-[#0056B3]">
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
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded">
          <div className="flex items-center">
            <span className="text-2xl mr-3"></span>
            <div>
              <p className="font-semibold text-yellow-800">All rooms are occupied</p>
              <p className="text-yellow-700">
                Please take a seat in the lounge area with comfortable sofas.
              </p>
            </div>
          </div>
        </div>
      )}

      {!allOccupied && hasFreeRooms && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6 rounded">
          <p className="text-green-700">
            Some spaces are available. Check the list below.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const icon = categoryIcons[room.category] || ''
          const isDetente = room.category === 'detente'
          
          return (
            <Card key={room.id} className={`hover:shadow-lg transition-shadow ${room.is_occupied ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span>{room.name}</span>
                  </span>
                  <Badge className={room.is_occupied ? 'bg-red-500' : 'bg-green-500'}>
                    {room.is_occupied ? 'Occupied' : 'Available'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>Capacity: {room.capacity} person{room.capacity > 1 ? 's' : ''}</p>
                
                {room.max_people > 0 && (
                  <p className="text-sm">
                    People: <span className="font-semibold">{room.current_people || 0}</span> / {room.max_people}
                  </p>
                )}
                
                {room.location && <p>Location: {room.location}</p>}
                
                {room.equipment && room.equipment.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500">Equipment:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {room.equipment.slice(0, 3).map((item: string) => (
                        <span key={item} className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                          {item}
                        </span>
                      ))}
                      {room.equipment.length > 3 && (
                        <span className="text-xs text-gray-400">+{room.equipment.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}

                {!isDetente && user && (
                  <div className="flex gap-2 mt-2">
                    {!room.is_occupied ? (
                      <div className="flex gap-2 w-full">
                        <input
                          type="number"
                          min={1}
                          max={(room.max_people || 1) - (room.current_people || 0)}
                          defaultValue={1}
                          className="w-16 h-10 text-center border rounded-lg"
                          id={`people-${room.id}`}
                        />
                        <Button
                          onClick={() => {
                            const input = document.getElementById(`people-${room.id}`) as HTMLInputElement
                            const count = parseInt(input?.value) || 1
                            occupyRoom(room.id, room.name, count)
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          Occupy
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 w-full">
                        <div className="flex items-center justify-center bg-gray-100 rounded-lg px-3 text-sm font-medium min-w-[60px]">
                          {room.current_people || 0}/{room.max_people || room.capacity || 1}
                        </div>
                        <Button
                          onClick={() => freeRoom(room.id, room.name)}
                          className="flex-1 bg-red-600 hover:bg-red-700"
                        >
                          Free
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {isDetente && (
                  <div className="text-sm text-gray-500 italic">
                    Lounge area - Always available
                  </div>
                )}

                <Link href={`/rooms/${room.id}`}>
                  <p className="text-sm text-blue-600 hover:underline mt-2">
                    View details
                  </p>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
        <p className="text-sm text-gray-600">
          Total: <span className="font-bold">{rooms.length}</span> spaces
          <span className="ml-4">Available: <span className="font-bold">{rooms.filter(r => !r.is_occupied && r.category !== 'detente').length}</span></span>
          <span className="ml-4">Occupied: <span className="font-bold">{rooms.filter(r => r.is_occupied).length}</span></span>
          <span className="ml-4">Lounge: <span className="font-bold">{rooms.filter(r => r.category === 'detente').length}</span></span>
        </p>
      </div>
    </div>
  )
}