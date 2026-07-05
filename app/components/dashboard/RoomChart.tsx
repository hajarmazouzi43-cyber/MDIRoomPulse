'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface RoomData {
  id: string
  name: string
  current_people: number
  max_people: number
}

export default function RoomChart() {
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('id, name, current_people, max_people')
      .order('name')
    
    if (data) {
      setRooms(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchRooms()

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
          console.log('🔄 Chart: Room changed, refreshing...')
          fetchRooms()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return <div className="h-64 animate-pulse bg-gray-200 rounded"></div>
  }

  const chartData = rooms.map(room => ({
    name: room.name.length > 12 ? room.name.slice(0, 10) + '..' : room.name,
    occupied: room.current_people || 0,
    available: (room.max_people || 1) - (room.current_people || 0),
  }))

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        No rooms available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip 
          formatter={(value: any) => {
            if (typeof value === 'number') return [`${value} people`]
            return [value]
          }}
          labelFormatter={(label: any) => `Room: ${label}`}
        />
        <Bar dataKey="occupied" stackId="a" fill="#EF4444" name="Occupied" />
        <Bar dataKey="available" stackId="a" fill="#10B981" name="Available" />
      </BarChart>
    </ResponsiveContainer>
  )
}