'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import SubscribeButton from '@/components/rooms/SubscribeButton'
import Link from 'next/link'
import RoomQRCode from '@/components/rooms/RoomQRCode'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Room {
  id: string
  name: string
  capacity: number
  equipment: string[]
  location: string
  category: string
  is_occupied: boolean
}

export default function RoomDetailPage() {
  // ✅ Traduction réactive via le contexte client (se met à jour instantanément)
  const { t } = useLanguage()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [room, setRoom] = useState<Room | null>(null)
  const [subscribers, setSubscribers] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [notFoundFlag, setNotFoundFlag] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', id)
        .single()

      if (!roomData) {
        setNotFoundFlag(true)
        setLoading(false)
        return
      }

      const { count } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomData.id)

      setRoom(roomData as Room)
      setSubscribers(count || 0)
      setLoading(false)
    }

    load()
  }, [id, router])

  if (notFoundFlag) {
    notFound()
  }

  if (loading || !room) {
    return null
  }

  const categoryIcons: Record<string, string> = {
    bureau: '👔',
    reunion: '🏢',
    poste: '💻',
    detente: '🛋️'
  }

  const isOccupied = room.is_occupied

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/rooms" className="text-blue-600 hover:underline mb-4 inline-block">
          {t('roomDetail.back')}
        </Link>

        <div className="flex justify-between items-start mb-6">
          <h1 className="text-3xl font-bold text-[#0056B3]">
            {categoryIcons[room.category] || ''} {room.name}
          </h1>
          <Badge className={isOccupied ? 'bg-red-500' : 'bg-green-500'}>
            {isOccupied ? t('roomDetail.occupied') : t('roomDetail.available')}
          </Badge>
        </div>

        <Card className="mb-6">
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">{t('roomDetail.capacity')}</p>
                <p className="text-lg font-semibold"> {room.capacity} {room.capacity > 1 ? t('roomDetail.persons') : t('roomDetail.person')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('roomDetail.location')}</p>
                <p className="text-lg font-semibold"> {room.location || t('roomDetail.notSpecified')}</p>
              </div>
            </div>

            {room.equipment && room.equipment.length > 0 && (
              <div>
                <p className="text-sm text-gray-500">{t('roomDetail.equipment')}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {room.equipment.map((item: string) => (
                    <span key={item} className="bg-gray-100 px-3 py-1 rounded-full text-sm">
                       {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <RoomQRCode roomId={room.id} roomName={room.name} />
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500">{t('roomDetail.subscribers')}</p>
              <p className="text-lg font-semibold">{subscribers || 0} {subscribers && subscribers > 1 ? t('roomDetail.subscribersPlural') : t('roomDetail.subscriber')}</p>
            </div>
          </CardContent>
        </Card>

        <SubscribeButton roomId={room.id} roomName={room.name} />
      </div>
    </div>
  )
}
