'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

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
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('room_history')
      .select(`
        *,
        rooms:room_id (name),
        profiles:changed_by (email)
      `)
      .order('changed_at', { ascending: false })
      .limit(50)
    
    if (data) {
      setHistory(data)
    }
    setLoading(false)
  }

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
      <h1 className="text-3xl font-bold text-[#0056B3] mb-6">
        Historique des salles
      </h1>

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Aucun historique disponible pour le moment.
            <br />
            Occupe ou libère une salle pour commencer à enregistrer.
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
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.rooms?.name || 'Inconnue'}
                    </TableCell>
                    <TableCell>
                      <Badge className={item.is_occupied ? 'bg-red-500' : 'bg-green-500'}>
                        {item.is_occupied ? 'Occupee' : 'Libre'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.profiles?.email || 'Systeme'}
                    </TableCell>
                    <TableCell>
                      {new Date(item.changed_at).toLocaleString('fr-FR')}
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