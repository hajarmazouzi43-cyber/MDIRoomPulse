'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function ExecutivePage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const supabase = createClient()
  const { t } = useLanguage()

  // ✅ Fonction helper pour les traductions avec variables
  const tWithVars = (key: string, vars?: Record<string, string | number>): string => {
    let message = t(key)
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        message = message.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
      }
    }
    return message
  }

  useEffect(() => {
    fetchRooms()
    
    const channel = supabase
      .channel('rooms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchRooms()
        setLastUpdate(new Date())
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
          <h1 className="text-4xl font-bold text-white">{t('executive.title')}</h1>
          <div className="text-gray-400 text-sm">
            🕐 {t('executive.lastUpdate')}: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-blue-900/50 border-blue-500">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-white">{total}</p>
              <p className="text-blue-300">{t('executive.totalRooms')}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-900/50 border-green-500">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-green-400">{free}</p>
              <p className="text-green-300">{t('executive.free')}</p>
            </CardContent>
          </Card>
          <Card className="bg-red-900/50 border-red-500">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-red-400">{occupied}</p>
              <p className="text-red-300">{t('executive.occupied')}</p>
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
                    {room.is_occupied ? t('executive.occupied') : t('executive.free')}
                  </Badge>
                </div>
                <div className="mt-2 text-gray-300 text-sm">
                  <p>{tWithVars('executive.people', { current: room.current_people || 0, max: room.max_people || room.capacity || 1 })}</p>
                  {room.occupied_until && (
                    <p>{tWithVars('executive.time', { time: new Date(room.occupied_until).toLocaleTimeString() })}</p>
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