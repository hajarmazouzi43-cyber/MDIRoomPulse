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
import { useRole } from '@/hooks/useRole'

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

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCodeDialog, setShowCodeDialog] = useState(false)
  const [adminCode, setAdminCode] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const supabase = createClient()
  const { isAdmin } = useRole()

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
      .select('id, name, is_occupied, occupied_at, occupied_until, current_people, max_people')
    
    if (historyData) setHistory(historyData)
    if (roomsData) setRooms(roomsData)
    setLoading(false)
  }

  // ✅ Fonction pour formater l'action en français
  const formatAction = (item: HistoryItem) => {
    const firstName = item.profiles?.first_name || ''
    const lastName = item.profiles?.last_name || ''
    const userName = `${firstName} ${lastName}`.trim() || item.profiles?.email?.split('@')[0] || 'Utilisateur'
    
    const action = item.is_occupied ? 'a occupé' : 'a libéré'
    const roomName = item.rooms?.name || 'salle inconnue'
    const time = new Date(item.changed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    
    return `${userName} ${action} la salle "${roomName}" à ${time}`
  }

  // ✅ Suppression de l'historique (seulement pour admin)
  const clearHistory = async () => {
    if (!isAdmin) {
      toast.error('Vous n\'avez pas les droits pour supprimer l\'historique')
      return
    }

    if (adminCode !== 'ADMINatrsd2647') {
      toast.error('Code admin invalide')
      setAdminCode('')
      return
    }

    setIsDeleting(true)
    try {
      // Supprimer en plusieurs lots
      let deletedCount = 0
      let hasMore = true

      while (hasMore) {
        const { data: batch, error: fetchError } = await supabase
          .from('room_history')
          .select('id')
          .limit(50)

        if (fetchError) throw fetchError

        if (!batch || batch.length === 0) {
          hasMore = false
          break
        }

        const ids = batch.map((item: any) => item.id)
        const { error: deleteError } = await supabase
          .from('room_history')
          .delete()
          .in('id', ids)

        if (deleteError) throw deleteError
        deletedCount += ids.length
      }

      toast.success(`${deletedCount} entrées d'historique supprimées`)
      setShowCodeDialog(false)
      setAdminCode('')
      fetchData()
    } catch (error: any) {
      toast.error('Erreur lors de la suppression: ' + error.message)
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
            userName: 'En cours',
            peopleInfo: `${room.current_people || 0}/${room.max_people || 1}`,
            actionText: `Occupation en cours de la salle "${room.name}" depuis ${formatTime(room.occupied_at)}`
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
        {/* ✅ Bouton Clear History visible uniquement pour l'admin */}
        {isAdmin && (
          <Button
            onClick={() => setShowCodeDialog(true)}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            🗑️ Clear History
          </Button>
        )}
      </div>

      {/* Dialog pour le code admin */}
      <Dialog open={showCodeDialog} onOpenChange={setShowCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔐 Code Admin Requis</DialogTitle>
            <DialogDescription>
              Entrez le code admin pour supprimer tout l'historique. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-code">Code Admin</Label>
              <Input
                id="admin-code"
                type="password"
                placeholder="Entrez le code admin..."
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
                Contactez votre administrateur pour le code.
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
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={clearHistory}
              disabled={isDeleting}
            >
              {isDeleting ? 'Suppression...' : 'Oui, Supprimer tout'}
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
                  <TableHead className="w-[40%]">Action</TableHead>
                  <TableHead className="w-[15%]">Salle</TableHead>
                  <TableHead className="w-[15%]">Statut</TableHead>
                  <TableHead className="w-[20%]">Plage horaire</TableHead>
                  <TableHead className="w-[10%]">Durée</TableHead>
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
                      {item.actionText}
                    </TableCell>
                    <TableCell>
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