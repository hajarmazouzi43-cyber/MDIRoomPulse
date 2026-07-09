'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AnalyticsMonthPage() {
  const [monthlyStats, setMonthlyStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const supabase = createClient()

  useEffect(() => {
    fetchMonthlyStats()
  }, [selectedMonth])

  const fetchMonthlyStats = async () => {
    setLoading(true)
    const year = selectedMonth.getFullYear()
    const month = selectedMonth.getMonth() + 1

    // Récupérer les réservations du mois
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .gte('created_at', `${year}-${String(month).padStart(2, '0')}-01`)
      .lte('created_at', `${year}-${String(month).padStart(2, '0')}-31`)

    // Récupérer les salles
    const { data: rooms } = await supabase.from('rooms').select('*')

    // Récupérer les utilisateurs
    const { data: users } = await supabase.from('profiles').select('*')

    // Statistiques
    const totalBookings = bookings?.length || 0
    const totalRooms = rooms?.length || 0
    const totalUsers = users?.length || 0

    // Salles les plus réservées
    const roomCounts: Record<string, number> = {}
    bookings?.forEach((b) => {
      roomCounts[b.room_id] = (roomCounts[b.room_id] || 0) + 1
    })
    const topRooms = Object.entries(roomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({
        name: rooms?.find((r) => r.id === id)?.name || 'Inconnue',
        count
      }))

    // Taux d'occupation
    const daysInMonth = new Date(year, month, 0).getDate()
    const totalSlots = totalRooms * daysInMonth * 8 // 8h de travail
    const occupancyRate = totalSlots > 0 ? Math.round((totalBookings / totalSlots) * 100) : 0

    setMonthlyStats({
      totalBookings,
      totalRooms,
      totalUsers,
      topRooms,
      occupancyRate,
      month: `${selectedMonth.toLocaleString('fr-FR', { month: 'long' })} ${year}`
    })

    setLoading(false)
  }

  const changeMonth = (direction: number) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() + direction)
    setSelectedMonth(newDate)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}
          </div>
        </div>
      </div>
    )
  }

  if (!monthlyStats) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold text-[#0056B3] mb-6">📊 Analytics du Mois</h1>
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Aucune donnée disponible pour ce mois.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#0056B3]">📊 Analytics du Mois</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => changeMonth(-1)}>◀</Button>
          <span className="text-lg font-semibold capitalize">{monthlyStats.month}</span>
          <Button variant="outline" onClick={() => changeMonth(1)}>▶</Button>
          <Button variant="outline" onClick={() => setSelectedMonth(new Date())}>
            Aujourd'hui
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Réservations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{monthlyStats.totalBookings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Salles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{monthlyStats.totalRooms}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{monthlyStats.totalUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Taux d'occupation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{monthlyStats.occupancyRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🏢 Salles les plus réservées</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyStats.topRooms.length === 0 ? (
            <p className="text-gray-500">Aucune réservation ce mois-ci</p>
          ) : (
            <ul className="space-y-2">
              {monthlyStats.topRooms.map((room: any, index: number) => (
                <li key={index} className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium">{index + 1}. {room.name}</span>
                  <span className="text-sm text-gray-500">{room.count} réservations</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}