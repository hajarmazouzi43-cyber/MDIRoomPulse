'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function ExecutivePage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const supabase = createClient()

  useEffect(() => {
    fetchRooms()
    
    const channel = supabase
      .channel('rooms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms()
        setLastUpdate(new Date())
      })
      .subscribe()

    // ✅ Nettoyer correctement
    return () => {
      supabase.removeChannel(channel)
    }
  // ✅ Ajouter supabase comme dépendance
  }, [supabase])

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*').order('name')
    if (data) setRooms(data)
  }

  const total = rooms.length
  const occupied = rooms.filter(r => r.is_occupied).length
  const free = total - occupied

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">🏢 Executive Dashboard</h1>
          <div className="text-gray-400 text-sm">
            🕐 {lastUpdate.toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-blue-900/50 border-blue-500">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-white">{total}</p>
              <p className="text-blue-300">Total Rooms</p>
            </CardContent>
          </Card>
          <Card className="bg-green-900/50 border-green-500">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-green-400">{free}</p>
              <p className="text-green-300">Free</p>
            </CardContent>
          </Card>
          <Card className="bg-red-900/50 border-red-500">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-red-400">{occupied}</p>
              <p className="text-red-300">Occupied</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rooms.map(room => (
            <Card key={room.id} className={`${room.is_occupied ? 'bg-red-900/30 border-red-500' : 'bg-green-900/30 border-green-500'} border-2`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-white font-semibold">{room.name}</h3>
                  <Badge className={room.is_occupied ? 'bg-red-500' : 'bg-green-500'}>
                    {room.is_occupied ? 'Occupied' : 'Free'}
                  </Badge>
                </div>
                <div className="mt-2 text-gray-300 text-sm">
                  <p>👥 {room.current_people || 0}/{room.max_people || room.capacity || 1}</p>
                  {room.occupied_until && (
                    <p>⏱️ {new Date(room.occupied_until).toLocaleTimeString()}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}