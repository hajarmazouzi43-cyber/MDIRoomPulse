'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Download } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface HistoryItem {
  id: string
  room_id: string
  is_occupied: boolean
  changed_by: string
  changed_at: string
  rooms: {
    name: string
  }
  profiles: {
    email: string
    first_name: string
    last_name: string
  }
}

interface RoomRow {
  id: string
  name: string
  is_occupied: boolean
  occupied_at: string | null
  occupied_until: string | null
  current_people: number | null
  max_people: number | null
  occupied_by: string | null
  profiles: {
    email: string
    first_name: string | null
    last_name: string | null
  } | null
}

interface TimelineEntry {
  id: string
  roomId: string
  roomName: string
  status: string
  is_occupied: boolean
  startTime: string
  endTime: string | null
  startTimeFormatted: string
  endTimeFormatted: string
  duration: string
  durationMin: number | null
  userEmail: string
  userName: string
  peopleInfo: string
  actionText: string
}

const PRIMARY = '#2554E0'
const roomColors = ['#2554E0', '#7C3AED', '#DB2777', '#D97706', '#059669', '#0891B2']

const hashColor = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return roomColors[Math.abs(hash) % roomColors.length]
}

const initials = (name: string) => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRoomId, setFilterRoomId] = useState<string>('all')
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'all'>('all')
  const [filterUser, setFilterUser] = useState('')
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
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    const { data: historyData } = await supabase
      .from('room_history')
      .select(`
        *,
        rooms:room_id (name),
        profiles:changed_by (email, first_name, last_name)
      `)
      .order('changed_at', { ascending: false })
      .limit(100)

    const { data: roomsData } = await supabase
      .from('rooms')
      .select('id, name, is_occupied, occupied_at, occupied_until, current_people, max_people, occupied_by')

    const formattedRooms: RoomRow[] = (roomsData || []).map((room: any) => ({
      ...room,
      profiles: room.occupied_by ? {
        email: '',
        first_name: null,
        last_name: null
      } : null
    }))

    if (historyData) setHistory(historyData as HistoryItem[])
    if (formattedRooms) setRooms(formattedRooms)
    setLoading(false)
  }

  const formatAction = (item: HistoryItem) => {
    const firstName = item.profiles?.first_name || ''
    const lastName = item.profiles?.last_name || ''
    const userName = `${firstName} ${lastName}`.trim() || item.profiles?.email?.split('@')[0] || 'Utilisateur'

    const action = item.is_occupied ? t('history.occupied') : t('history.freed')
    const roomName = item.rooms?.name || 'salle inconnue'
    const time = new Date(item.changed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    return `${userName} ${action} la salle "${roomName}" à ${time}`
  }

  const formatTime = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const calculateDuration = (start: string | null, end: string | null): { label: string; minutes: number | null } => {
    if (!start || !end) return { label: t('history.inProgress'), minutes: null }
    const diffMin = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
    if (diffMin < 0) return { label: t('history.inProgress'), minutes: null }
    if (diffMin < 60) return { label: `${diffMin} min`, minutes: diffMin }
    const hours = Math.floor(diffMin / 60)
    const minutes = diffMin % 60
    return { label: minutes === 0 ? `${hours}h` : `${hours}h ${minutes}min`, minutes: diffMin }
  }

  const timeline: TimelineEntry[] = useMemo(() => {
    const roomMap = new Map<string, RoomRow>()
    rooms.forEach(room => roomMap.set(room.id, room))

    const historyByRoom = new Map<string, HistoryItem[]>()
    history.forEach(item => {
      if (!historyByRoom.has(item.room_id)) historyByRoom.set(item.room_id, [])
      historyByRoom.get(item.room_id)!.push(item)
    })

    const result: TimelineEntry[] = []

    historyByRoom.forEach((events, roomId) => {
      events.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
      const roomInfo = roomMap.get(roomId)
      const roomName = roomInfo?.name || 'Inconnue'

      for (let i = 0; i < events.length; i++) {
        const current = events[i]
        const next = events[i + 1] || null

        let status = current.is_occupied ? t('history.occupied') : t('history.freed')
        let endTime: string | null = next ? next.changed_at : null

        if (!next && roomInfo?.is_occupied && current.is_occupied) {
          endTime = roomInfo.occupied_until
          status = t('history.inProgress')
        }

        const { label: durationLabel, minutes: durationMin } = calculateDuration(current.changed_at, endTime)

        result.push({
          id: current.id,
          roomId,
          roomName,
          status,
          is_occupied: current.is_occupied,
          startTime: current.changed_at,
          endTime,
          startTimeFormatted: formatTime(current.changed_at),
          endTimeFormatted: endTime ? formatTime(endTime) : t('history.inProgress'),
          duration: durationLabel,
          durationMin,
          userEmail: current.profiles?.email || 'Système',
          userName: current.profiles?.first_name
            ? `${current.profiles.first_name} ${current.profiles.last_name || ''}`.trim()
            : current.profiles?.email?.split('@')[0] || 'Système',
          peopleInfo: roomInfo ? `${roomInfo.current_people || 0}/${roomInfo.max_people || 1}` : 'N/A',
          actionText: formatAction(current)
        })
      }
    })

    rooms.forEach(room => {
      if (room.is_occupied && room.occupied_at) {
        const existing = result.find(r => r.roomId === room.id && r.is_occupied && r.endTime === null)
        if (!existing) {
          const occupantName = room.profiles?.first_name
            ? `${room.profiles.first_name} ${room.profiles.last_name || ''}`.trim()
            : room.profiles?.email?.split('@')[0] || 'Utilisateur inconnu'

          result.push({
            id: `current-${room.id}`,
            roomId: room.id,
            roomName: room.name,
            status: t('history.inProgress'),
            is_occupied: true,
            startTime: room.occupied_at,
            endTime: room.occupied_until,
            startTimeFormatted: formatTime(room.occupied_at),
            endTimeFormatted: room.occupied_until ? formatTime(room.occupied_until) : t('history.inProgress'),
            duration: calculateDuration(room.occupied_at, room.occupied_until).label,
            durationMin: calculateDuration(room.occupied_at, room.occupied_until).minutes,
            userEmail: room.profiles?.email || 'Inconnu',
            userName: occupantName,
            peopleInfo: `${room.current_people || 0}/${room.max_people || 1}`,
            actionText: `${occupantName} occupe la salle "${room.name}" depuis ${formatTime(room.occupied_at)}`
          })
        }
      }
    })

    result.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    return result
  }, [history, rooms])

  const roomOptions = useMemo(() => {
    return [...rooms].sort((a, b) => a.name.localeCompare(b.name))
  }, [rooms])

  const filteredTimeline = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const todayStr = now.toDateString()
    const userQuery = filterUser.trim().toLowerCase()

    return timeline.filter(entry => {
      if (filterRoomId !== 'all' && entry.roomId !== filterRoomId) return false

      if (filterPeriod === 'today' && new Date(entry.startTime).toDateString() !== todayStr) return false
      if (filterPeriod === 'week' && new Date(entry.startTime) < weekAgo) return false

      if (userQuery && !entry.userName.toLowerCase().includes(userQuery)) return false

      return true
    })
  }, [timeline, filterRoomId, filterPeriod, filterUser])

  const resetFilters = () => {
    setFilterRoomId('all')
    setFilterPeriod('all')
    setFilterUser('')
  }

  const hasActiveFilters = filterRoomId !== 'all' || filterPeriod !== 'all' || filterUser.trim() !== ''

  const stats = useMemo(() => {
    const todayStr = new Date().toDateString()
    const todayEntries = timeline.filter(e => new Date(e.startTime).toDateString() === todayStr)
    const occupiedNow = rooms.filter(r => r.is_occupied).length

    const roomCounts = new Map<string, number>()
    todayEntries.forEach(e => roomCounts.set(e.roomName, (roomCounts.get(e.roomName) || 0) + 1))
    let topRoom = '—'
    let topCount = 0
    roomCounts.forEach((count, name) => {
      if (count > topCount) {
        topCount = count
        topRoom = name
      }
    })

    const durations = todayEntries.filter(e => e.durationMin !== null).map(e => e.durationMin as number)
    const avgMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null

    return {
      todayCount: todayEntries.length,
      occupiedNow,
      topRoom,
      avgLabel: avgMin === null ? '—' : avgMin < 60 ? `${avgMin} min` : `${Math.floor(avgMin / 60)}h ${avgMin % 60}min`
    }
  }, [timeline, rooms])

  const grouped = useMemo(() => {
    const groups: { label: string; entries: TimelineEntry[] }[] = []
    const todayStr = new Date().toDateString()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toDateString()

    filteredTimeline.forEach(entry => {
      const d = new Date(entry.startTime)
      const dStr = d.toDateString()
      const label = dStr === todayStr
        ? t('history.today')
        : dStr === yesterdayStr
          ? t('history.yesterday')
          : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

      let group = groups.find(g => g.label === label)
      if (!group) {
        group = { label, entries: [] }
        groups.push(group)
      }
      group.entries.push(entry)
    })

    return groups
  }, [filteredTimeline])

  const exportToPDF = () => {
    const doc = new jsPDF()
    const generatedAt = new Date().toLocaleString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    doc.setFontSize(16)
    doc.setTextColor(37, 84, 224)
    doc.text(t('history.title'), 14, 18)

    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`${t('history.generatedAt')} ${generatedAt}`, 14, 24)

    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)
    doc.text(
      `${t('history.movementsToday')}: ${stats.todayCount}   |   ${t('history.occupiedNow')}: ${stats.occupiedNow}   |   ${t('history.mostActive')}: ${stats.topRoom}   |   ${t('history.avgDuration')}: ${stats.avgLabel}`,
      14, 31
    )

    if (hasActiveFilters) {
      const activeRoomName = filterRoomId === 'all' ? null : roomOptions.find(r => r.id === filterRoomId)?.name
      const periodLabel = filterPeriod === 'today' ? t('history.periodToday') : filterPeriod === 'week' ? t('history.periodWeek') : null
      const parts = [
        activeRoomName ? tWithVars('history.roomFilter', { name: activeRoomName }) : null,
        periodLabel ? tWithVars('history.periodFilter', { period: periodLabel }) : null,
        filterUser.trim() ? tWithVars('history.userFilter', { name: filterUser.trim() }) : null
      ].filter(Boolean)
      doc.setFontSize(9)
      doc.setTextColor(150, 100, 20)
      doc.text(`${t('history.filtersApplied')} — ${parts.join('  ·  ')}`, 14, 36)
    }

    const rows = filteredTimeline.map((item) => [
      new Date(item.startTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      item.userName,
      item.roomName,
      item.is_occupied ? t('history.occupied') : t('history.freed'),
      `${item.startTimeFormatted} - ${item.endTimeFormatted}`,
      item.duration,
      item.peopleInfo !== 'N/A' ? item.peopleInfo : '-'
    ])

    autoTable(doc, {
      startY: hasActiveFilters ? 41 : 36,
      head: [[t('history.date'), t('history.user'), t('history.room'), t('history.action'), t('history.timeSlot'), t('history.duration'), t('history.persons')]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 84, 224], textColor: 255 },
      alternateRowStyles: { fillColor: [246, 248, 252] },
    })

    doc.save(`historique-salles-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-slate-800 rounded w-56"></div>
          <div className="h-24 bg-gray-200 dark:bg-slate-800 rounded-2xl"></div>
          <div className="h-20 bg-gray-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-20 bg-gray-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-950">
      <div className="container mx-auto py-10 px-4 max-w-4xl">

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: PRIMARY }}>
              {t('history.activityLog')}
            </span>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
              {t('history.title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {t('history.subtitle')}
            </p>
          </div>

          <button
            onClick={exportToPDF}
            disabled={filteredTimeline.length === 0}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            style={{ backgroundColor: PRIMARY }}
          >
            <Download className="w-4 h-4" />
            {t('history.exportPDF')}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.todayCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('history.movementsToday')}</div>
          </div>
          <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-2xl font-bold" style={{ color: stats.occupiedNow > 0 ? '#DC2626' : '#059669' }}>
              {stats.occupiedNow}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('history.occupiedNow')}</div>
          </div>
          <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-lg font-bold text-slate-900 dark:text-white truncate" title={stats.topRoom}>
              {stats.topRoom}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('history.mostActive')}</div>
          </div>
          <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.avgLabel}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('history.avgDuration')}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <select
            value={filterRoomId}
            onChange={(e) => setFilterRoomId(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': `${PRIMARY}55` } as React.CSSProperties}
          >
            <option value="all">{t('history.allRooms')}</option>
            {roomOptions.map(room => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1">
            {([
              { key: 'today', label: t('history.periodToday') },
              { key: 'week', label: t('history.periodWeek') },
              { key: 'all', label: t('history.periodAll') },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilterPeriod(opt.key)}
                className="text-xs font-medium px-3 py-1 rounded-md transition-all"
                style={
                  filterPeriod === opt.key
                    ? { backgroundColor: PRIMARY, color: 'white' }
                    : { color: '#64748B' }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder={t('history.filterUser')}
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 flex-1 min-w-[160px]"
            style={{ '--tw-ring-color': `${PRIMARY}55` } as React.CSSProperties}
          />

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('history.resetFilters')}
            </button>
          )}

          <span className="text-xs text-slate-400 ml-auto shrink-0">
            {filteredTimeline.length} {filteredTimeline.length > 1 ? t('history.results') : t('history.result')}
          </span>
        </div>

        {timeline.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <div className="text-4xl mb-3">🗓️</div>
            {t('history.noHistory')}
          </div>
        ) : filteredTimeline.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500">
            <div className="text-4xl mb-3">🔍</div>
            {t('history.noResults')}
            <button onClick={resetFilters} className="block mx-auto mt-3 text-sm font-medium" style={{ color: PRIMARY }}>
              {t('history.resetFilters')}
            </button>
          </div>
        ) : (
          <div className="relative">
            {grouped.map((group, gIndex) => (
              <div key={group.label} className="mb-8">
                <div className="sticky top-2 z-10 mb-4">
                  <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md capitalize">
                    {group.label}
                  </span>
                </div>

                <div className="relative pl-8">
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-800" />

                  <div className="space-y-3">
                    {group.entries.map((item) => {
                      const color = hashColor(item.roomName)
                      const isLive = item.status === t('history.inProgress')
                      return (
                        <div key={item.id} className="relative">
                          <span
                            className="absolute -left-8 top-5 w-3.5 h-3.5 rounded-full ring-4 ring-white dark:ring-slate-950"
                            style={{ backgroundColor: item.is_occupied ? '#DC2626' : '#059669' }}
                          >
                            {isLive && (
                              <span
                                className="absolute inset-0 rounded-full animate-ping"
                                style={{ backgroundColor: '#DC2626', opacity: 0.6 }}
                              />
                            )}
                          </span>

                          <div className="flex items-start gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                              style={{ backgroundColor: color }}
                            >
                              {initials(item.userName)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
                                  <span className="font-semibold text-slate-900 dark:text-white">{item.userName}</span>
                                  {' '}
                                  {item.is_occupied ? t('history.occupied') : t('history.freed')}{' '}
                                  <span
                                    className="font-medium px-1.5 py-0.5 rounded-md text-xs"
                                    style={{ backgroundColor: `${color}18`, color }}
                                  >
                                    {item.roomName}
                                  </span>
                                </p>

                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isLive ? 'text-white' : ''}`}
                                  style={{
                                    backgroundColor: isLive ? '#DC2626' : item.is_occupied ? '#FEE2E2' : '#DCFCE7',
                                    color: isLive ? 'white' : item.is_occupied ? '#B91C1C' : '#15803D'
                                  }}
                                >
                                  {isLive ? '● ' + t('history.inProgress').toUpperCase() : item.status.toUpperCase()}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
                                <span className="font-mono">{item.startTimeFormatted} → {item.endTimeFormatted}</span>
                                <span>·</span>
                                <span>{item.duration}</span>
                                {item.peopleInfo !== 'N/A' && (
                                  <>
                                    <span>·</span>
                                    <span>👥 {item.peopleInfo}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}