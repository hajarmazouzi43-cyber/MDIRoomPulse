'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Room {
  id: string
  name: string
  capacity: number
  equipment: string[]
  location: string
  category: string
  is_occupied: boolean
  is_out_of_service: boolean
  current_people: number
  max_people: number
}

interface Booking {
  id: string
  room_id: string
  booking_date: string
  start_time: string
  end_time: string
}

export default function SearchPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [searchDate, setSearchDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [hasSearched, setHasSearched] = useState(false)
  const supabase = createClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: roomsData } = await supabase.from('rooms').select('*').order('name')
    const { data: bookingsData } = await supabase.from('bookings').select('*')
    
    if (roomsData) setRooms(roomsData)
    if (bookingsData) setBookings(bookingsData)
    setLoading(false)
  }

  const searchRooms = () => {
    if (!searchDate) {
      toast.error(t('search.selectDate'))
      return
    }

    if (startTime >= endTime) {
      toast.error(t('search.startBeforeEnd'))
      return
    }

    setHasSearched(true)

    const available = rooms.filter(room => {
      if (room.is_out_of_service) return false
      if (room.category === 'detente') return false

      const conflicting = bookings.some(b => 
        b.room_id === room.id &&
        b.booking_date === searchDate &&
        b.start_time < endTime &&
        b.end_time > startTime
      )

      return !conflicting
    })

    setFilteredRooms(available)
  }

  const resetSearch = () => {
    setFilteredRooms([])
    setHasSearched(false)
    setSearchDate('')
    setStartTime('09:00')
    setEndTime('17:00')
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="h-32 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-48 bg-gray-200 rounded"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-[#0056B3] dark:text-[#00A3E0] mb-6">
        {t('search.title')}
      </h1>

      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>{t('search.date')}</Label>
              <Input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="dark:bg-[#1e293b] dark:border-[#334155]"
              />
            </div>
            <div>
              <Label>{t('search.start')}</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="dark:bg-[#1e293b] dark:border-[#334155]"
              />
            </div>
            <div>
              <Label>{t('search.end')}</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="dark:bg-[#1e293b] dark:border-[#334155]"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={searchRooms} className="w-full bg-[#0056B3] hover:bg-[#00449E]">
                {t('search.search')}
              </Button>
              {hasSearched && (
                <Button onClick={resetSearch} variant="outline" className="w-full">
                  {t('search.reset')}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {hasSearched && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {filteredRooms.length} {filteredRooms.length > 1 ? t('search.resultsPlural') : t('search.results')}
            </h2>
            <span className="text-sm text-gray-500">
              {(() => {
                const [y, m, d] = searchDate.split('-').map(Number)
                return new Date(y, m - 1, d).toLocaleDateString('fr-FR')
              })()} - {startTime} → {endTime}
            </span>
          </div>

          {filteredRooms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                {t('search.noResults')}
                <br />
                <span className="text-sm">{t('search.tryOther')}</span>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRooms.map((room) => (
                <Card key={room.id} className="hover:shadow-lg transition-shadow border-green-200 dark:border-green-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex justify-between items-center">
                      <span>{room.name}</span>
                      <Badge className="bg-green-500">{t('search.available')}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-gray-600">{t('search.capacity', { capacity: room.capacity })}</p>
                    {room.location && <p className="text-sm text-gray-600">{t('search.location', { location: room.location })}</p>}
                    {room.equipment && room.equipment.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {room.equipment.slice(0, 3).map((item) => (
                          <span key={item} className="text-xs bg-gray-100 dark:bg-[#1e293b] px-2 py-1 rounded-full">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                    <Button 
                      className="w-full mt-2 bg-[#0056B3] hover:bg-[#00449E]"
                      onClick={() => window.location.href = `/rooms/${room.id}`}
                    >
                      {t('search.viewRoom')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {t('search.placeholder')}
          </CardContent>
        </Card>
      )}
    </div>
  )
}