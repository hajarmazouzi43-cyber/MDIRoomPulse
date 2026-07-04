import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

type RoomStatus = 'free' | 'occupied' | 'maintenance'

interface Room {
  id: string
  name: string
  capacity: number
  equipment: string[]
  location: string
  category: string
  status: RoomStatus
  is_occupied: boolean
  occupied_by: string | null
  occupied_at: string | null
  created_at: string
  updated_at: string
  max_people?: number
  current_people?: number
  room_email?: string
}

export default async function FloorPlanPage() {
  const supabase = await createClient()
  
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .order('name')

  const ceo = rooms?.find((r: Room) => r.category === 'bureau')
  const reunion = rooms?.find((r: Room) => r.category === 'reunion')
  const postes = rooms?.filter((r: Room) => r.category === 'poste') || []
  const detente = rooms?.find((r: Room) => r.category === 'detente')

  const statusColors: Record<RoomStatus, string> = {
    free: 'bg-green-500',
    occupied: 'bg-red-500',
    maintenance: 'bg-yellow-500'
  }

  const statusLabels: Record<RoomStatus, string> = {
    free: 'Available',
    occupied: 'Occupied',
    maintenance: 'Maintenance'
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-[#0056B3] mb-6">
        Floor Plan
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CEO Office */}
        <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300">
          <h2 className="text-lg font-bold text-blue-700 mb-3">CEO Office</h2>
          {ceo && <RoomCard room={ceo} statusColors={statusColors} statusLabels={statusLabels} />}
        </div>

        {/* Meeting Room */}
        <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-300">
          <h2 className="text-lg font-bold text-purple-700 mb-3">Meeting Room</h2>
          {reunion && <RoomCard room={reunion} statusColors={statusColors} statusLabels={statusLabels} />}
        </div>

        {/* Workstations */}
        <div className="bg-green-50 rounded-lg p-4 border-2 border-green-300">
          <h2 className="text-lg font-bold text-green-700 mb-3">Workstations</h2>
          <div className="grid grid-cols-2 gap-2">
            {postes.map((poste: Room) => (
              <RoomCard key={poste.id} room={poste} small statusColors={statusColors} statusLabels={statusLabels} />
            ))}
          </div>
        </div>
      </div>

      {/* Lounge Area */}
      {detente && (
        <div className="mt-6 bg-yellow-50 rounded-lg p-4 border-2 border-yellow-300">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-yellow-700">Lounge Area</h2>
            <RoomCard room={detente} small statusColors={statusColors} statusLabels={statusLabels} />
          </div>
          {detente.equipment && detente.equipment.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              {detente.equipment.join(' • ')}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span> Available
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span> Occupied
          </span>
          <span className="flex items-center">
            <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span> Maintenance
          </span>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Click on a room to see details and subscribe
        </div>
      </div>
    </div>
  )
}

function RoomCard({ 
  room, 
  small = false, 
  statusColors, 
  statusLabels 
}: { 
  room: Room
  small?: boolean
  statusColors: Record<RoomStatus, string>
  statusLabels: Record<RoomStatus, string>
}) {
  const status = room.status as RoomStatus || 'free'

  return (
    <Link href={`/rooms/${room.id}`}>
      <Card className={`hover:shadow-lg transition-shadow cursor-pointer ${small ? 'p-1' : ''}`}>
        <CardContent className={`${small ? 'p-2' : 'p-4'}`}>
          <div className="flex justify-between items-center">
            <span className={`font-medium ${small ? 'text-sm' : ''}`}>{room.name}</span>
            <Badge className={`${statusColors[status] || 'bg-gray-500'} text-white text-xs`}>
              {statusLabels[status] || room.status}
            </Badge>
          </div>
          {!small && (
            <>
              <p className="text-sm text-gray-500 mt-1">Capacity: {room.capacity} person{room.capacity > 1 ? 's' : ''}</p>
              {room.equipment && room.equipment.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">Equipment: {room.equipment.slice(0, 3).join(' • ')}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}