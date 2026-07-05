'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

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
  }
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCodeDialog, setShowCodeDialog] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = createClient()

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
        profiles:changed_by (email)
      `)
      .order('changed_at', { ascending: false })
      .limit(100)
    
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('id, name, is_occupied, occupied_at, occupied_until, current_people, max_people')
    
    if (historyData) setHistory(historyData)
    if (roomsData) setRooms(roomsData)
    setLoading(false)
  }

const clearHistory = async () => {
  if (adminCode !== 'ADMINatrsd2647') {
    toast.error('Invalid admin code')
    setAdminCode('')
    return
  }

  setIsDeleting(true)

  try {
    // ✅ Appeler la fonction RPC
    const { data, error } = await supabase.rpc('clear_all_history')

    if (error) {
      console.error('RPC Error:', error)
      throw error
    }

    toast.success('History cleared successfully')
    setShowCodeDialog(false)
    setAdminCode('')
    fetchData()
  } catch (error: any) {
    console.error('Error:', error)
    toast.error('Error: ' + (error.message || 'Unknown error'))
  } finally {
    setIsDeleting(false)
  }
}
  const formatTime = (date: string | null) => {
    if (!date) return 'N/A'
    const d = new Date(date)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const calculateDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return 'En cours'
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffMin = Math.round((endDate.getTime() - startDate.getTime()) / 60000)
    if (diffMin < 0) return 'En cours'
    if (diffMin < 60) return `${diffMin} min`
    const hours = Math.floor(diffMin / 60)
    const minutes = diffMin % 60
    if (minutes === 0) return `${hours}h`
    return `${hours}h ${minutes}min`
  }

  const getHistoryWithRanges = () => {
    const roomMap = new Map()
    rooms.forEach(room => {
      roomMap.set(room.id, {
        name: room.name,
        is_occupied: room.is_occupied,
        occupied_at: room.occupied_at,
        occupied_until: room.occupied_until,
        current_people: room.current_people,
        max_people: room.max_people
      })
    })

    const historyByRoom = new Map<string, HistoryItem[]>()
    history.forEach(item => {
      if (!historyByRoom.has(item.room_id)) {
        historyByRoom.set(item.room_id, [])
      }
      historyByRoom.get(item.room_id)!.push(item)
    })

    const result: any[] = []

    historyByRoom.forEach((events, roomId) => {
      events.sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
      const roomInfo = roomMap.get(roomId)
      const roomName = roomInfo?.name || 'Inconnue'

      for (let i = 0; i < events.length; i++) {
        const current = events[i]
        const next = events[i + 1] || null
        
        let endTime = next ? next.changed_at : null
        let status = current.is_occupied ? 'Occupée' : 'Libre'
        
        if (!next && roomInfo?.is_occupied && current.is_occupied) {
          endTime = roomInfo.occupied_until
          status = 'Occupée (en cours)'
        }
        if (!next && !roomInfo?.is_occupied && !current.is_occupied) {
          status = 'Libre'
        }

        result.push({
          id: current.id,
          roomId: roomId,
          roomName: roomName,
          status: status,
          is_occupied: current.is_occupied,
          startTime: current.changed_at,
          endTime: next ? next.changed_at : (roomInfo?.is_occupied ? roomInfo.occupied_until : null),
          startTimeFormatted: formatTime(current.changed_at),
          endTimeFormatted: next ? formatTime(next.changed_at) : (roomInfo?.is_occupied ? formatTime(roomInfo.occupied_until) : 'En cours'),
          duration: calculateDuration(
            current.changed_at,
            next ? next.changed_at : (roomInfo?.is_occupied ? roomInfo.occupied_until : null)
          ),
          userEmail: current.profiles?.email || 'Système',
          peopleInfo: roomInfo ? `${roomInfo.current_people || 0}/${roomInfo.max_people || 1}` : 'N/A'
        })
      }
    })

    rooms.forEach(room => {
      if (room.is_occupied && room.occupied_at) {
        const existing = result.find(r => r.roomId === room.id && r.is_occupied && r.endTime === null)
        if (!existing) {
          result.push({
            id: `current-${room.id}`,
            roomId: room.id,
            roomName: room.name,
            status: 'Occupée (en cours)',
            is_occupied: true,
            startTime: room.occupied_at,
            endTime: room.occupied_until,
            startTimeFormatted: formatTime(room.occupied_at),
            endTimeFormatted: formatTime(room.occupied_until) || 'En cours',
            duration: calculateDuration(room.occupied_at, room.occupied_until),
            userEmail: 'En cours',
            peopleInfo: `${room.current_people || 0}/${room.max_people || 1}`
          })
        }
      }
    })

    result.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    return result
  }

  const historyWithRanges = getHistoryWithRanges()

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#0056B3]">
          📋 Historique des salles
        </h1>
        <Button
          onClick={() => setShowCodeDialog(true)}
          variant="destructive"
          className="bg-red-600 hover:bg-red-700"
        >
          🗑️ Clear History
        </Button>
      </div>

      {/* Dialog pour le code admin */}
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔐 Admin Code Required</DialogTitle>
            <DialogDescription>
              Enter the admin code to clear all history. This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-code">Admin Code</Label>
              <Input
                id="admin-code"
                type="password"
                placeholder="Enter admin code..."
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    clearHistory()
                  }
                }}
                autoFocus
              />
              <p className="text-xs text-gray-400">
                Contact your administrator for the code.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCodeDialog(false)
                setAdminCode('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={clearHistory}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {historyWithRanges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Aucun historique disponible.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Plage horaire</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Utilisateur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyWithRanges.map((item) => (
                  <TableRow 
                    key={item.id} 
                    className={`
                      hover:bg-gray-50 transition-colors
                      ${item.is_occupied ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'}
                    `}
                  >
                    <TableCell className="font-medium">
                      {item.roomName}
                    </TableCell>
                    <TableCell>
                      <Badge className={item.is_occupied ? 'bg-red-500' : 'bg-green-500'}>
                        {item.status || (item.is_occupied ? 'Occupée' : 'Libre')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {item.startTimeFormatted} → {item.endTimeFormatted}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {item.duration}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.userEmail}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}