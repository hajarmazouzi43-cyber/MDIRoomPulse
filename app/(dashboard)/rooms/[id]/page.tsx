import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import SubscribeButton from '@/components/rooms/SubscribeButton'
import Link from 'next/link'

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()

  // ✅ Vérifier la session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/login')
  }

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .single()

  if (!room) {
    notFound()
  }

  const { count: subscribers } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', room.id)

  const categoryIcons: Record<string, string> = {
    bureau: '👔',
    reunion: '🏢',
    poste: '💻',
    detente: '🛋️'
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/rooms" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to rooms
        </Link>

        <div className="flex justify-between items-start mb-6">
          <h1 className="text-3xl font-bold text-[#0056B3]">
            {categoryIcons[room.category] || ''} {room.name}
          </h1>
          <Badge className={room.is_occupied ? 'bg-red-500' : 'bg-green-500'}>
            {room.is_occupied ? '🔴 Occupied' : '🟢 Available'}
          </Badge>
        </div>

        <Card className="mb-6">
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Capacity</p>
                <p className="text-lg font-semibold"> {room.capacity} person{room.capacity > 1 ? 's' : ''}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="text-lg font-semibold"> {room.location || 'Not specified'}</p>
              </div>
            </div>

            {room.equipment && room.equipment.length > 0 && (
              <div>
                <p className="text-sm text-gray-500">Equipment</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {room.equipment.map((item: string) => (
                    <span key={item} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                       {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <p className="text-sm text-gray-500">Subscribers</p>
              <p className="text-lg font-semibold">{subscribers || 0} subscriber{subscribers && subscribers > 1 ? 's' : ''}</p>
            </div>
          </CardContent>
        </Card>

        <SubscribeButton roomId={room.id} roomName={room.name} />
      </div>
    </div>
  )
}