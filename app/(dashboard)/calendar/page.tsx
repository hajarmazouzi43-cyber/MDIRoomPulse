'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface CalendarEvent {
  title: string
  start: string
  end: string
  location?: string
  description?: string
}

export default function CalendarPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { t } = useLanguage()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: roomsData } = await supabase.from('rooms').select('*')
    if (roomsData) {
      setRooms(roomsData)
      const calendarEvents = roomsData
        .filter((r: any) => r.is_occupied && r.occupied_at)
        .map((r: any) => ({
          title: `${t('calendar.room', { name: r.name })}`,
          start: r.occupied_at,
          end: r.occupied_until || new Date(Date.now() + 3600000).toISOString(),
          location: r.location || 'N/A',
          description: t('calendar.description', { capacity: r.capacity, current: r.current_people || 0 }),
        }))
      setEvents(calendarEvents)
    }
    setLoading(false)
  }

  const syncToGoogleCalendar = () => {
    if (events.length === 0) {
      toast.info('No events to sync')
      return
    }

    const event = events[0]
    const params = new URLSearchParams()
    params.append('action', 'TEMPLATE')
    params.append('text', event.title)
    params.append('dates', `${event.start.replace(/[-:]/g, '')}/${event.end.replace(/[-:]/g, '')}`)
    if (event.location) params.append('location', event.location)
    if (event.description) params.append('details', event.description)

    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`)
    toast.success('Opening Google Calendar')
  }

  const syncToOutlookCalendar = () => {
    if (events.length === 0) {
      toast.info('No events to sync')
      return
    }

    const event = events[0]
    const start = encodeURIComponent(event.start)
    const end = encodeURIComponent(event.end)
    const subject = encodeURIComponent(event.title)
    const body = encodeURIComponent(event.description || '')
    const location = encodeURIComponent(event.location || '')

    window.open(
      `https://outlook.office.com/calendar/deeplink/compose?subject=${subject}&startdt=${start}&enddt=${end}&body=${body}&location=${location}`
    )
    toast.success('Opening Outlook Calendar')
  }

  const exportICS = () => {
    if (events.length === 0) {
      toast.info('No events to export')
      return
    }

    let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MDI RoomPulse//EN\n'
    events.forEach((event) => {
      icsContent += 'BEGIN:VEVENT\n'
      icsContent += `UID:${Date.now()}-${Math.random()}\n`
      icsContent += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z\n`
      icsContent += `DTSTART:${event.start.replace(/[-:]/g, '').slice(0, 15)}Z\n`
      icsContent += `DTEND:${event.end.replace(/[-:]/g, '').slice(0, 15)}Z\n`
      icsContent += `SUMMARY:${event.title}\n`
      if (event.location) icsContent += `LOCATION:${event.location}\n`
      if (event.description) icsContent += `DESCRIPTION:${event.description}\n`
      icsContent += 'END:VEVENT\n'
    })
    icsContent += 'END:VCALENDAR'

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `calendar-${new Date().toISOString().split('T')[0]}.ics`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('ICS file exported!')
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-[#0056B3] mb-6">
        {t('calendar.title')}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('calendar.googleCalendar')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              {t('calendar.syncInfo')}
            </p>
            <Button onClick={syncToGoogleCalendar} className="w-full bg-blue-600 hover:bg-blue-700">
              {t('calendar.syncGoogle')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('calendar.outlookCalendar')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              {t('calendar.syncInfo')}
            </p>
            <Button onClick={syncToOutlookCalendar} className="w-full bg-blue-600 hover:bg-blue-700">
              {t('calendar.syncOutlook')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('calendar.exportICS')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              {t('calendar.exportInfo')}
            </p>
            <Button onClick={exportICS} className="w-full bg-green-600 hover:bg-green-700">
              {t('calendar.export')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('calendar.currentEvents')}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-gray-500">{t('calendar.noEvents')}</p>
          ) : (
            <ul className="space-y-2">
              {events.map((event, index) => (
                <li key={index} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(event.start).toLocaleString()} → {new Date(event.end).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">{event.location}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}