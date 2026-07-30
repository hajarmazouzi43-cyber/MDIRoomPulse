'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import { Building2, CircleCheck, DoorOpen, CalendarDays, Users, ClipboardList, History, Gauge, BarChart3 } from 'lucide-react'

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalRooms: 0,
    occupiedRooms: 0,
    freeRooms: 0,
    totalUsers: 0,
    totalBookings: 0,
    totalHistory: 0,
    monthlyBookings: 0
  })
  const [roomData, setRoomData] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    setLoading(true)

    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { count: totalRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true })
    const { count: occupiedRooms } = await supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('is_occupied', true)
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    const { count: totalBookings } = await supabase.from('bookings').select('*', { count: 'exact', head: true })
    const { count: monthlyBookings } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('booking_date', firstDay)
      .lte('booking_date', lastDay)
    const { count: totalHistory } = await supabase.from('room_history').select('*', { count: 'exact', head: true })

    const { data: rooms } = await supabase
      .from('rooms')
      .select('name, current_people, max_people, is_occupied')

    // Données mensuelles (simulées pour l'exemple)
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    const monthlyData = months.map((month, i) => ({
      month,
      bookings: Math.floor(Math.random() * 20) + 5,
      occupancy: Math.floor(Math.random() * 80) + 20
    }))

    setStats({
      totalRooms: totalRooms || 0,
      occupiedRooms: occupiedRooms || 0,
      freeRooms: (totalRooms || 0) - (occupiedRooms || 0),
      totalUsers: totalUsers || 0,
      totalBookings: totalBookings || 0,
      totalHistory: totalHistory || 0,
      monthlyBookings: monthlyBookings || 0
    })

    if (rooms) {
      const withRate = rooms.map(r => {
        const max = r.max_people || 1
        const current = r.current_people || 0
        const rate = r.is_occupied
          ? Math.min(100, Math.round((current / max) * 100) || 100)
          : 0
        return {
          name: r.name.length > 14 ? r.name.slice(0, 12) + '..' : r.name,
          occupancyRate: rate,
          isOccupied: r.is_occupied,
        }
      })
      withRate.sort((a, b) => b.occupancyRate - a.occupancyRate)
      setRoomData(withRate)
    }

    setMonthlyData(monthlyData)
    setLoading(false)
  }

  const pieData = [
    { name: '🟢 Libres', value: stats.freeRooms, color: '#14B8A6' },
    { name: '🔴 Occupées', value: stats.occupiedRooms, color: '#FF6F61' },
  ]

  if (loading) {
    return (
      <div className="w-full py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-[#E7E5EC] rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-[#E7E5EC] rounded-2xl"></div>)}
          </div>
        </div>
      </div>
    )
  }

  const topStats = [
    { label: 'Total salles', value: stats.totalRooms, icon: Building2, color: '#7C5CFC' },
    { label: 'Libres', value: stats.freeRooms, icon: CircleCheck, color: '#14B8A6' },
    { label: 'Occupées', value: stats.occupiedRooms, icon: DoorOpen, color: '#FF6F61' },
    { label: 'Réservations du mois', value: stats.monthlyBookings, icon: CalendarDays, color: '#F5A623' },
  ]

  const bottomStats = [
    { label: 'Utilisateurs', value: stats.totalUsers, icon: Users, color: '#7C5CFC' },
    { label: 'Total réservations', value: stats.totalBookings, icon: ClipboardList, color: '#FF6F61' },
    { label: 'Historique', value: stats.totalHistory, icon: History, color: '#14B8A6' },
    {
      label: "Taux d'occupation",
      value: `${stats.totalRooms > 0 ? Math.round((stats.occupiedRooms / stats.totalRooms) * 100) : 0}%`,
      icon: Gauge,
      color: '#F5A623',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Bandeau d'en-tête */}
      <div className="relative overflow-hidden blueprint-grid-bg border-b border-[#E7E5EC]">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="relative w-full py-10 px-4">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#7C5CFC]">Vue d'ensemble</span>
          <h1 className="font-display text-3xl font-bold text-[#1A1A2E] mt-1 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-[#7C5CFC]" />
            Statistiques
          </h1>
        </div>
      </div>

      <div className="w-full py-8 px-4">
        {/* Cartes de statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {topStats.map((s) => (
            <div
              key={s.label}
              className="plaque-hover rounded-2xl p-5 bg-white border border-[#E7E5EC] shadow-sm"
              style={{ ['--plaque-color' as string]: s.color }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${s.color}18` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <p className="text-xs font-medium text-[#6B6B7A] mb-1">{s.label}</p>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique à barres — taux d'occupation actuel */}
          <Card className="plaque-hover rounded-2xl border-[#E7E5EC] shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold text-[#1A1A2E]">
                📊 Occupation par salle (actuel)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roomData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E5EC" />
                  <XAxis type="number" domain={[0, 100]} unit="%" stroke="#6B6B7A" />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: '#6B6B7A' }} />
                  <Tooltip
                    formatter={(value: any) => {
                      if (typeof value === 'number') {
                        return [`${value}%`, 'Taux d\'occupation']
                      }
                      return [value, 'Taux d\'occupation']
                    }}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #E7E5EC' }}
                  />
                  <Bar dataKey="occupancyRate" name="Taux d'occupation actuel" radius={[0, 6, 6, 0]}>
                    {roomData.map((room, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={room.occupancyRate >= 70 ? '#FF6F61' : room.occupancyRate >= 30 ? '#F5A623' : '#14B8A6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Camembert */}
          <Card className="plaque-hover rounded-2xl border-[#E7E5EC] shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold text-[#1A1A2E]">📊 Statut global</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={{ stroke: '#9A98A8', strokeWidth: 1 }}
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={90}
                    innerRadius={40}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => {
                      if (typeof value === 'number') {
                        return [`${value} salle(s)`, 'Nombre']
                      }
                      return [value, 'Nombre']
                    }}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #E7E5EC' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Graphique en ligne - Tendance mensuelle */}
          <Card className="plaque-hover rounded-2xl border-[#E7E5EC] shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-display text-lg font-semibold text-[#1A1A2E]">📈 Tendance mensuelle</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E5EC" />
                  <XAxis dataKey="month" stroke="#6B6B7A" />
                  <YAxis yAxisId="left" stroke="#6B6B7A" />
                  <YAxis yAxisId="right" orientation="right" stroke="#6B6B7A" />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      if (typeof value === 'number') {
                        if (name === 'bookings' || name === '📅 Réservations') {
                          return [`${value} réservations`, 'Réservations']
                        }
                        return [`${value}%`, 'Taux d\'occupation']
                      }
                      return [value, name]
                    }}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #E7E5EC' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#7C5CFC" strokeWidth={3} name="📅 Réservations" dot={{ fill: '#7C5CFC', r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke="#F5A623" strokeWidth={3} name="📊 Taux d'occupation %" dot={{ fill: '#F5A623', r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Statistiques supplémentaires */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {bottomStats.map((s) => (
            <div
              key={s.label}
              className="plaque-hover rounded-2xl p-4 bg-white border border-[#E7E5EC] shadow-sm text-center"
              style={{ ['--plaque-color' as string]: s.color }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${s.color}18` }}>
                <s.icon className="w-4.5 h-4.5" style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-medium text-[#6B6B7A] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}