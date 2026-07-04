import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import RoomChart from '@/components/dashboard/RoomChart'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
  
  const total = rooms?.length || 0
  const free = rooms?.filter(r => !r.is_occupied && r.category !== 'detente').length || 0
  const occupied = rooms?.filter(r => r.is_occupied).length || 0
  const totalPeople = rooms?.reduce((acc, r) => acc + (r.current_people || 0), 0) || 0
  const totalCapacity = rooms?.reduce((acc, r) => acc + (r.max_people || r.capacity || 1), 0) || 0

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-[#0056B3] mb-6">
        📊 Dashboard
      </h1>
      
      {/* Graphique principal */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>👥 People per Room (Real-time)</CardTitle>
        </CardHeader>
        <CardContent>
          <RoomChart />
        </CardContent>
      </Card>

      {/* Deux graphiques côte à côte */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Graphique : Occupation vs Disponible */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Rooms Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-500">{free}</p>
              <p className="text-sm text-gray-500">🟢 Available</p>
              <p className="text-4xl font-bold text-red-500 mt-4">{occupied}</p>
              <p className="text-sm text-gray-500">🔴 Occupied</p>
              <p className="text-4xl font-bold text-gray-500 mt-4">{total}</p>
              <p className="text-sm text-gray-500">📋 Total Rooms</p>
            </div>
          </CardContent>
        </Card>

        {/* Graphique : Personnes vs Capacité */}
        <Card>
          <CardHeader>
            <CardTitle>👥 People vs Capacity</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-500">{totalPeople}</p>
              <p className="text-sm text-gray-500">👤 People in rooms</p>
              <p className="text-4xl font-bold text-purple-500 mt-4">{totalCapacity}</p>
              <p className="text-sm text-gray-500">📊 Total capacity</p>
              <p className="text-2xl font-bold text-gray-700 mt-4">
                {totalCapacity > 0 ? Math.round((totalPeople / totalCapacity) * 100) : 0}%
              </p>
              <p className="text-sm text-gray-500">📈 Occupancy rate</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}