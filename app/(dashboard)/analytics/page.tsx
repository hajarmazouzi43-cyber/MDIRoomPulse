'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalRooms: 0,
    occupiedRooms: 0,
    freeRooms: 0,
    totalUsers: 0,
    totalSubscriptions: 0,
    totalHistory: 0
  })
  const [roomData, setRoomData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    setLoading(true)
    
    const { count: totalRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true })
    const { count: occupiedRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('is_occupied', true)
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    const { count: totalSubscriptions } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true })
    const { count: totalHistory } = await supabase.from('room_history').select('*', { count: 'exact', head: true })

    const { data: rooms } = await supabase
      .from('rooms')
      .select('name, current_people, max_people, is_occupied')

    setStats({
      totalRooms: totalRooms || 0,
      occupiedRooms: occupiedRooms || 0,
      freeRooms: (totalRooms || 0) - (occupiedRooms || 0),
      totalUsers: totalUsers || 0,
      totalSubscriptions: totalSubscriptions || 0,
      totalHistory: totalHistory || 0
    })

    if (rooms) {
      setRoomData(rooms.map(r => ({
        name: r.name.length > 12 ? r.name.slice(0, 10) + '..' : r.name,
        occupied: r.current_people || 0,
        available: (r.max_people || 1) - (r.current_people || 0),
        isOccupied: r.is_occupied
      })))
    }

    setLoading(false)
  }

  // Données pour le PieChart
  const pieData = [
    { name: 'Free', value: stats.freeRooms },
    { name: 'Occupied', value: stats.occupiedRooms },
  ]
  const COLORS = ['#10B981', '#EF4444']

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1,2].map(i => <div key={i} className="h-64 bg-gray-200 rounded"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-[#0056B3] mb-6">
        📊 Analytics
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Graphique à barres */}
        <Card>
          <CardHeader>
            <CardTitle>👥 People per Room</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="occupied" stackId="a" fill="#EF4444" name="Occupied" />
                <Bar dataKey="available" stackId="a" fill="#10B981" name="Available" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Camembert */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Rooms Status</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}