'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Search, Pencil, Trash2, ShieldCheck, Clock, Download, DoorOpen, Building2, Users, Lock, Ban, CircleCheck, CheckCircle, XCircle, MailCheck } from 'lucide-react'
import ReportPDF from '@/components/ReportPDF'
import { notifyRoomOutOfService, notifyRoomStatusChange, sendEmailNotification, sendSMSNotification, getActiveOrUpcomingBookings } from '@/lib/notifications'

const PRIMARY = '#7C5CFC'
const PRIMARY_HOVER = '#6242D6'

const categoryLabels: Record<string, string> = {
  bureau: 'Bureau',
  reunion: 'Réunion',
  poste: 'Poste',
  detente: 'Détente',
}

const categoryColors: Record<string, string> = {
  bureau: '#7C5CFC',
  reunion: '#14B8A6',
  poste: '#F5A623',
  detente: '#FF6F61',
}

type RoomStatusFilter = 'all' | 'free' | 'occupied' | 'confidential' | 'out_of_service'
type CategoryFilter = 'all' | 'bureau' | 'reunion' | 'poste' | 'detente'
type RoleFilter = 'all' | 'admin' | 'user'

export default function AdminPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any>(null)

  // Code Admin
  const [showCodeDialog, setShowCodeDialog] = useState(true)
  const [adminCode, setAdminCode] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  // Filtres — Salles
  const [roomSearch, setRoomSearch] = useState('')
  const [roomCategory, setRoomCategory] = useState<CategoryFilter>('all')
  const [roomStatus, setRoomStatus] = useState<RoomStatusFilter>('all')

  // Filtres — Utilisateurs
  const [userSearch, setUserSearch] = useState('')
  const [userRole, setUserRole] = useState<RoleFilter>('all')

  const supabase = createClient()

  const [formData, setFormData] = useState({
    name: '',
    capacity: '',
    equipment: '',
    location: '',
    category: 'poste',
    max_people: '',
    room_email: '',
    is_confidential: 'false',
    is_out_of_service: 'false',
    out_of_service_reason: ''
  })

  // Vérifier le code admin et mettre à jour le rôle
  const verifyAdminCode = async () => {
    if (adminCode === 'ADMINatrsd2647') {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role !== 'admin') {
          await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', user.id)
          toast.info('Rôle administrateur accordé !')
        }
      }

      setIsAdmin(true)
      setShowCodeDialog(false)
      setAdminCode('')
      toast.success('Accès autorisé')
      fetchData()
    } else {
      toast.error('Code administrateur invalide')
      setAdminCode('')
    }
  }

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profile?.role === 'admin') {
          setIsAdmin(true)
          setShowCodeDialog(false)
          fetchData()
        }
      }
    }
    checkAdminStatus()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: roomsData } = await supabase.from('rooms').select('*').order('name')
    const { data: usersData } = await supabase.from('profiles').select('*')
    const { data: historyData } = await supabase
      .from('room_history')
      .select('*, rooms(name)')
      .order('changed_at', { ascending: false })
      .limit(50)

    if (roomsData) setRooms(roomsData)
    if (usersData) setUsers(usersData)
    if (historyData) setHistory(historyData)
    setLoading(false)
  }

  const handleSubmit = async () => {
    try {
      const data: any = {
        name: formData.name.trim(),
        capacity: Number(formData.capacity) || 1,
        equipment: formData.equipment ? formData.equipment.split(',').map(s => s.trim()).filter(Boolean) : [],
        location: formData.location?.trim() || '',
        category: formData.category || 'poste',
        is_confidential: formData.is_confidential === 'true',
        is_out_of_service: formData.is_out_of_service === 'true',
        out_of_service_reason: formData.out_of_service_reason || null,
        room_email: formData.room_email?.trim() || formData.name.toLowerCase().replace(/\s/g, '') + '@mdi.com'
      }

      if (formData.max_people) {
        data.max_people = Number(formData.max_people)
      }

      let error
      if (editingRoom) {
        // ✅ Si la salle devient hors service, envoyer des notifications
        const wasOutOfService = editingRoom.is_out_of_service
        const isNowOutOfService = data.is_out_of_service

        const { error: updateError } = await supabase
          .from('rooms')
          .update(data)
          .eq('id', editingRoom.id)
        error = updateError

        if (!error && !wasOutOfService && isNowOutOfService) {
          // ✅ NOTIFICATION : Salle devient hors service
          const result = await notifyRoomOutOfService(editingRoom.id, data.out_of_service_reason || 'Maintenance')
          toast.success(`📢 ${result.email + result.sms} abonnés notifiés`)
        }

        if (!error && wasOutOfService && !isNowOutOfService) {
          // ✅ NOTIFICATION : Salle redevient disponible
          const result = await notifyRoomStatusChange(editingRoom.id, 'back_in_service')
          toast.success(`📢 ${result.email + result.sms} abonnés notifiés`)
        }

      } else {
        const { error: insertError } = await supabase
          .from('rooms')
          .insert(data)
        error = insertError
      }

      if (error) {
        console.error('Supabase error:', error)
        toast.error('Erreur lors de l\'enregistrement de la salle : ' + error.message)
      } else {
        toast.success(editingRoom ? 'Salle mise à jour !' : 'Salle ajoutée !')
        fetchData()
        setIsDialogOpen(false)
        setEditingRoom(null)
        setFormData({
          name: '',
          capacity: '',
          equipment: '',
          location: '',
          category: 'poste',
          max_people: '',
          room_email: '',
          is_confidential: 'false',
          is_out_of_service: 'false',
          out_of_service_reason: ''
        })
      }
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Erreur lors de l\'enregistrement de la salle : ' + error.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette salle ?')) return
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) {
      toast.error('Erreur lors de la suppression de la salle')
    } else {
      toast.success('Salle supprimée')
      fetchData()
    }
  }

  // ✅ Libérer une salle de force avec notifications pour les réservataires
  const handleForceRelease = async (room: any) => {
    if (!confirm(`Forcer la libération de "${room.name}" ? Cela mettra fin immédiatement à l'occupation en cours.`)) return

    const { data: { user } } = await supabase.auth.getUser()

    try {
      // 1. Récupérer les réservations actives (en cours ou à venir — jamais celles déjà terminées)
      const bookings = await getActiveOrUpcomingBookings(supabase, room.id, 'user_id, id, title, booking_date, start_time, end_time')

      console.log(`📅 ${bookings.length} réservations actives trouvées`)

      // 2. Libérer la salle
      const { error: updateError } = await supabase
        .from('rooms')
        .update({
          is_occupied: false,
          occupied_by: null,
          occupied_at: null,
          occupied_until: null,
          current_people: 0
        })
        .eq('id', room.id)

      if (updateError) {
        toast.error('Erreur lors de la libération de la salle : ' + updateError.message)
        return
      }

      // 3. Annuler les réservations et notifier les utilisateurs
      if (bookings.length > 0) {
        // Annuler les réservations (par ID, celles déjà récupérées à l'étape 1 —
        // évite de refaire une requête avec un filtre de date fragile)
        const { error: cancelError } = await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .in('id', bookings.map((b) => b.id))

        if (cancelError) {
          console.error('❌ Erreur annulation réservations (handleForceRelease):', cancelError)
        }

        // ✅ Notifier tous les abonnés de la salle qu'elle est maintenant libre
        const result = await notifyRoomStatusChange(room.id, 'free')

        if (result.email > 0 || result.sms > 0) {
          toast.success(`📢 ${result.email + result.sms} abonnés notifiés de la libération`)
        }

        // ✅ Notifier spécifiquement chaque réservataire
        let notifiedCount = 0
        for (const booking of bookings) {
          const customMessage = `⚠️ L'administrateur a libéré la salle "${room.name}" et votre réservation "${booking.title || 'Réservation'}" a été annulée. Merci de réserver une autre salle.`

          const emailResult = await sendEmailNotification(
            booking.user_id,
            room.name,
            undefined as any,
            'cancel',
            undefined,
            undefined,
            customMessage,
            supabase
          )
          if (emailResult.success) notifiedCount++

          const smsResult = await sendSMSNotification(booking.user_id, room.name, 'cancel', customMessage, supabase)
          if (smsResult.success) notifiedCount++
        }

        if (notifiedCount > 0) {
          toast.success(`📢 ${bookings.length} réservataire(s) notifié(s) de l'annulation`)
        }
      }

      // 4. Historique
      await supabase.from('room_history').insert({
        room_id: room.id,
        is_occupied: false,
        changed_by: user?.id || null,
        user_name: user?.email?.split('@')[0] || user?.email || 'Admin',
        details: {
          action: 'force_release',
          bookings_cancelled: bookings?.length || 0
        }
      })

      toast.success(`✅ "${room.name}" a été libérée de force${bookings?.length ? ` (${bookings.length} réservations annulées)` : ''}`)
      fetchData()
    } catch (error: any) {
      console.error('Erreur force release:', error)
      toast.error('Erreur lors de la libération de force')
    }
  }

  // Changer le rôle d'un utilisateur
  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      toast.error('Erreur lors de la mise à jour du rôle : ' + error.message)
    } else {
      toast.success(`Rôle mis à jour vers "${newRole}"`)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    }
  }

  // ✅ VÉRIFICATION DES UTILISATEURS
// ✅ VÉRIFICATION DES UTILISATEURS
  const handleVerifyUser = async (userId: string, userEmail: string, isVerified: boolean) => {
    try {
      // 0. Confirmer l'email dans Supabase Auth (sinon le login reste
      // bloqué même si profiles.is_verified passe à true)
      if (!isVerified) {
        const authRes = await fetch('/api/admin/verify-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })
        if (!authRes.ok) {
          const authResult = await authRes.json()
          throw new Error(authResult.error || 'Échec de la confirmation Supabase Auth')
        }
      }

      // 1. Mettre à jour le statut de vérification
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: !isVerified })
        .eq('id', userId)

      if (error) throw error

      // 2. Si on vérifie l'utilisateur (pas de désactivation), envoyer un email
      if (!isVerified) {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userEmail,
            subject: '✅ Compte vérifié - MDI RoomPulse',
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #10B981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px; }
                    .button { background: #0056B3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
                    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>✅ Compte vérifié</h1>
                    </div>
                    <div class="content">
                      <p>Bonjour,</p>
                      <p>Votre compte a été <strong>vérifié</strong> par l'administrateur de MDI RoomPulse.</p>
                      <p>Vous pouvez maintenant accéder à toutes les fonctionnalités de l'application.</p>
                      <p style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/dashboard" class="button">
                          Accéder au dashboard
                        </a>
                      </p>
                      <p style="font-size: 14px; color: #666;">
                        Si vous avez des questions, contactez votre administrateur.
                      </p>
                    </div>
                    <div class="footer">
                      <p>MDI RoomPulse - Gestion des salles</p>
                    </div>
                  </div>
                </body>
              </html>
            `
          })
        })
      }

      toast.success(isVerified ? '✅ Utilisateur désactivé' : `✅ ${userEmail} vérifié avec succès !`)
      fetchData()
    } catch (error) {
      toast.error('Erreur lors de la vérification')
      console.error(error)
    }
  }

  // Export CSV générique
  const exportToCSV = (rows: Record<string, any>[], filename: string) => {
    if (rows.length === 0) {
      toast.error('Rien à exporter')
      return
    }
    const headers = Object.keys(rows[0])
    const escapeCell = (value: any) => {
      const str = value === null || value === undefined ? '' : String(value)
      return `"${str.replace(/"/g, '""')}"`
    }
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => escapeCell(row[h])).join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exporté')
  }

  const exportRoomsCSV = () => {
    exportToCSV(
      filteredRooms.map(r => ({
        name: r.name,
        category: categoryLabels[r.category] || r.category,
        email: r.room_email || '',
        capacity: r.capacity,
        max_people: r.max_people || r.capacity || 0,
        current_people: r.current_people || 0,
        status: r.is_out_of_service ? 'Hors service' : (r.is_occupied ? 'Occupée' : 'Libre'),
        confidential: r.is_confidential ? 'Oui' : 'Non',
        location: r.location || ''
      })),
      `salles-export-${new Date().toISOString().split('T')[0]}.csv`
    )
  }

  const exportUsersCSV = () => {
    exportToCSV(
      filteredUsers.map(u => ({
        id: u.id,
        email: u.email || '',
        role: u.role || 'user',
        is_verified: u.is_verified ? 'Oui' : 'Non',
        created_at: new Date(u.created_at).toLocaleDateString()
      })),
      `utilisateurs-export-${new Date().toISOString().split('T')[0]}.csv`
    )
  }

  const handleEdit = (room: any) => {
    setEditingRoom(room)
    setFormData({
      name: room.name || '',
      capacity: room.capacity?.toString() || '',
      equipment: room.equipment?.join(', ') || '',
      location: room.location || '',
      category: room.category || 'poste',
      max_people: room.max_people?.toString() || '',
      room_email: room.room_email || '',
      is_confidential: room.is_confidential ? 'true' : 'false',
      is_out_of_service: room.is_out_of_service ? 'true' : 'false',
      out_of_service_reason: room.out_of_service_reason || ''
    })
    setIsDialogOpen(true)
  }

  const stats = {
    totalRooms: rooms.length,
    totalUsers: users.length,
    occupiedRooms: rooms.filter(r => r.is_occupied).length,
    freeRooms: rooms.filter(r => !r.is_occupied).length,
    confidentialRooms: rooms.filter(r => r.is_confidential).length,
    outOfServiceRooms: rooms.filter(r => r.is_out_of_service).length,
    totalHistory: history.length
  }

  // ---- Filtrage des salles ----
  const filteredRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase()
    return rooms.filter(room => {
      if (q && !room.name?.toLowerCase().includes(q) && !room.room_email?.toLowerCase().includes(q)) return false
      if (roomCategory !== 'all' && room.category !== roomCategory) return false

      if (roomStatus === 'free' && (room.is_occupied || room.is_out_of_service)) return false
      if (roomStatus === 'occupied' && !room.is_occupied) return false
      if (roomStatus === 'confidential' && !room.is_confidential) return false
      if (roomStatus === 'out_of_service' && !room.is_out_of_service) return false

      return true
    })
  }, [rooms, roomSearch, roomCategory, roomStatus])

  const resetRoomFilters = () => {
    setRoomSearch('')
    setRoomCategory('all')
    setRoomStatus('all')
  }
  const hasRoomFilters = roomSearch.trim() !== '' || roomCategory !== 'all' || roomStatus !== 'all'

  // ---- Filtrage des utilisateurs ----
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return users.filter(user => {
      if (q && !user.id?.toLowerCase().includes(q) && !user.email?.toLowerCase().includes(q)) return false
      if (userRole !== 'all' && (user.role || 'user') !== userRole) return false
      return true
    })
  }, [users, userSearch, userRole])

  const resetUserFilters = () => {
    setUserSearch('')
    setUserRole('all')
  }
  const hasUserFilters = userSearch.trim() !== '' || userRole !== 'all'

  if (!isAdmin) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#F5F7FA] flex items-center justify-center p-4">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <Card className="relative w-full max-w-md rounded-2xl border-[#E7E5EC] shadow-lg">
          <CardHeader>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: `${PRIMARY}18` }}>
              <ShieldCheck className="w-6 h-6" style={{ color: PRIMARY }} />
            </div>
            <CardTitle className="text-2xl font-bold" style={{ color: PRIMARY }}>Accès administrateur requis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-[#6B6B7A]">
              Entrez le code administrateur pour accéder au tableau de bord.
            </p>
            <div className="space-y-2">
              <Label htmlFor="admin-code">Code administrateur</Label>
              <Input
                id="admin-code"
                type="password"
                placeholder="Entrez le code admin..."
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    verifyAdminCode()
                  }
                }}
                autoFocus
                className="border-[#DAD7E3] focus-visible:ring-[#7C5CFC]"
              />
              <p className="text-xs text-[#6B6B7A]">
                Contactez votre administrateur pour obtenir le code.
              </p>
            </div>
            <Button onClick={verifyAdminCode} style={{ backgroundColor: PRIMARY }} className="w-full hover:opacity-90">
              Vérifier
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="w-full py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-[#E7E5EC] rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-[#E7E5EC] rounded-2xl"></div>)}
          </div>
        </div>
      </div>
    )
  }

  const statCards = [
    { label: 'Total salles', value: stats.totalRooms, icon: Building2, color: '#7C5CFC' },
    { label: 'Utilisateurs', value: stats.totalUsers, icon: Users, color: '#7C5CFC' },
    { label: 'Salles libres', value: stats.freeRooms, icon: CircleCheck, color: '#14B8A6' },
    { label: 'Salles occupées', value: stats.occupiedRooms, icon: DoorOpen, color: '#FF6F61' },
    { label: 'Confidentielles', value: stats.confidentialRooms, icon: Lock, color: '#7C5CFC' },
    { label: 'Hors service', value: stats.outOfServiceRooms, icon: Ban, color: '#6B6B7A' },
  ]

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Bandeau d'en-tête */}
      <div className="relative overflow-hidden blueprint-grid-bg border-b border-[#E7E5EC]">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="relative w-full py-10 px-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: PRIMARY }}>Espace admin</span>
              <h1 className="font-display text-3xl font-bold text-[#1A1A2E] mt-1">Tableau de bord administrateur</h1>
            </div>
            <div className="flex gap-2">
              <ReportPDF
                rooms={rooms}
                history={history}
                stats={{
                  totalRooms: rooms.length,
                  occupiedRooms: rooms.filter(r => r.is_occupied).length,
                  freeRooms: rooms.filter(r => !r.is_occupied).length,
                  totalUsers: users.length,
                  totalSubscriptions: rooms.reduce((acc, r) => acc + (r.subscribers_count || 0), 0),
                  totalHistory: history.length
                }}
              />
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button style={{ backgroundColor: PRIMARY }} className="hover:opacity-90 text-white">
                    {editingRoom ? 'Modifier la salle' : 'Ajouter une salle'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingRoom ? 'Modifier la salle' : 'Ajouter une nouvelle salle'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nom</Label>
                      <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Capacité</Label>
                        <Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} />
                      </div>
                      <div>
                        <Label>Personnes max</Label>
                        <Input type="number" value={formData.max_people} onChange={(e) => setFormData({ ...formData, max_people: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>E-mail de la salle</Label>
                      <Input value={formData.room_email} onChange={(e) => setFormData({ ...formData, room_email: e.target.value })} />
                    </div>
                    <div>
                      <Label>Équipement (séparé par des virgules)</Label>
                      <Input value={formData.equipment} onChange={(e) => setFormData({ ...formData, equipment: e.target.value })} />
                    </div>
                    <div>
                      <Label>Emplacement</Label>
                      <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                    </div>
                    <div>
                      <Label>Catégorie</Label>
                      <select
                        className="w-full border rounded-lg p-2 border-[#DAD7E3] bg-white"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="bureau">Bureau</option>
                        <option value="reunion">Réunion</option>
                        <option value="poste">Poste</option>
                        <option value="detente">Détente</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="confidential"
                        checked={formData.is_confidential === 'true'}
                        onChange={(e) => setFormData({ ...formData, is_confidential: e.target.checked ? 'true' : 'false' })}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="confidential">🔒 Salle confidentielle</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="out_of_service"
                        checked={formData.is_out_of_service === 'true'}
                        onChange={(e) => setFormData({ ...formData, is_out_of_service: e.target.checked ? 'true' : 'false' })}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="out_of_service">🚫 Hors service</Label>
                    </div>
                    {formData.is_out_of_service === 'true' && (
                      <div>
                        <Label>Raison (optionnel)</Label>
                        <Input
                          value={formData.out_of_service_reason}
                          onChange={(e) => setFormData({ ...formData, out_of_service_reason: e.target.value })}
                          placeholder="Maintenance, rénovation, etc."
                        />
                      </div>
                    )}
                    <Button onClick={handleSubmit} style={{ backgroundColor: PRIMARY }} className="w-full hover:opacity-90 text-white">
                      {editingRoom ? 'Mettre à jour' : 'Ajouter'} la salle
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full py-8 px-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="plaque-hover rounded-2xl p-4 bg-white border border-[#E7E5EC] shadow-sm"
              style={{ ['--plaque-color' as string]: s.color }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: `${s.color}18` }}
              >
                <s.icon className="w-4.5 h-4.5" style={{ color: s.color }} />
              </div>
              <p className="text-xs font-medium text-[#6B6B7A] mb-1">{s.label}</p>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tableau des salles */}
        <Card className="rounded-2xl border-[#E7E5EC] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1A1A2E]">Gestion des salles</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Filtres salles */}
            <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B7A]" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou e-mail..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2 rounded-lg border border-[#E7E5EC] bg-[#F5F7FA] text-[#1A1A2E] placeholder:text-[#9A98A8] focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': `${PRIMARY}55` } as React.CSSProperties}
                />
              </div>

              <select
                value={roomCategory}
                onChange={(e) => setRoomCategory(e.target.value as CategoryFilter)}
                className="text-sm px-3 py-2 rounded-lg border border-[#E7E5EC] bg-[#F5F7FA] text-[#1A1A2E]"
              >
                <option value="all">Toutes les catégories</option>
                <option value="bureau">Bureau</option>
                <option value="reunion">Réunion</option>
                <option value="poste">Poste</option>
                <option value="detente">Détente</option>
              </select>

              <div className="flex items-center gap-1 rounded-lg bg-[#F5F7FA] border border-[#E7E5EC] p-1">
                {([
                  { key: 'all', label: 'Toutes' },
                  { key: 'free', label: 'Libres' },
                  { key: 'occupied', label: 'Occupées' },
                  { key: 'confidential', label: '🔒' },
                  { key: 'out_of_service', label: '🚫' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setRoomStatus(opt.key)}
                    className="text-xs font-medium px-2.5 py-1 rounded-md transition-all"
                    style={roomStatus === opt.key ? { backgroundColor: PRIMARY, color: 'white' } : { color: '#6B6B7A' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {hasRoomFilters && (
                <button onClick={resetRoomFilters} className="text-xs font-medium px-3 py-1.5 rounded-lg text-[#6B6B7A] hover:bg-[#F5F7FA] transition-colors">
                  ✕ Réinitialiser
                </button>
              )}

              <button
                onClick={exportRoomsCSV}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E7E5EC] text-[#1A1A2E] hover:bg-[#F5F7FA] transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Exporter en CSV
              </button>

              <span className="text-xs text-[#9A98A8] ml-auto shrink-0">
                {filteredRooms.length} / {rooms.length}
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Capacité</TableHead>
                  <TableHead>Personnes</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>🔒</TableHead>
                  <TableHead>🚫</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">{room.name}</TableCell>
                    <TableCell>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: `${categoryColors[room.category] || '#6B6B7A'}18`,
                          color: categoryColors[room.category] || '#6B6B7A'
                        }}
                      >
                        {categoryLabels[room.category] || room.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#6B6B7A]">{room.room_email || '-'}</TableCell>
                    <TableCell>{room.capacity}</TableCell>
                    <TableCell>{room.current_people || 0}/{room.max_people || room.capacity || 0}</TableCell>
                    <TableCell>
                      {room.is_out_of_service ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium text-white bg-[#6B6B7A]">
                          🚫 Hors service
                        </span>
                      ) : (
                        <span
                          className="px-2 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: room.is_occupied ? '#FF6F61' : '#14B8A6' }}
                        >
                          {room.is_occupied ? 'Occupée' : 'Libre'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{room.is_confidential ? '🔒' : '-'}</TableCell>
                    <TableCell>{room.is_out_of_service ? '🚫' : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {room.is_occupied && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleForceRelease(room)}
                            className="border-[#F5A623]/40 text-[#B9720E] hover:bg-[#FFF7EA]"
                          >
                            <DoorOpen className="w-3.5 h-3.5 mr-1" /> Libérer
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleEdit(room)}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Modifier
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(room.id)}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRooms.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-[#9A98A8]">
                      Aucune salle ne correspond à ces filtres.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Tableau des utilisateurs */}
        <Card className="mt-8 rounded-2xl border-[#E7E5EC] shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#1A1A2E]">Gestion des utilisateurs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Filtres utilisateurs */}
            <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B7A]" />
                <input
                  type="text"
                  placeholder="Rechercher par ID ou e-mail..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2 rounded-lg border border-[#E7E5EC] bg-[#F5F7FA] text-[#1A1A2E] placeholder:text-[#9A98A8] focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': `${PRIMARY}55` } as React.CSSProperties}
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-[#F5F7FA] border border-[#E7E5EC] p-1">
                {([
                  { key: 'all', label: 'Tous' },
                  { key: 'admin', label: 'Admin' },
                  { key: 'user', label: 'Utilisateur' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setUserRole(opt.key)}
                    className="text-xs font-medium px-2.5 py-1 rounded-md transition-all"
                    style={userRole === opt.key ? { backgroundColor: PRIMARY, color: 'white' } : { color: '#6B6B7A' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {hasUserFilters && (
                <button onClick={resetUserFilters} className="text-xs font-medium px-3 py-1.5 rounded-lg text-[#6B6B7A] hover:bg-[#F5F7FA] transition-colors">
                  ✕ Réinitialiser
                </button>
              )}

              <button
                onClick={exportUsersCSV}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E7E5EC] text-[#1A1A2E] hover:bg-[#F5F7FA] transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Exporter en CSV
              </button>

              <span className="text-xs text-[#9A98A8] ml-auto shrink-0">
                {filteredUsers.length} / {users.length}
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-sm">{user.id.slice(0, 8)}...</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>
                      <select
                        value={user.role || 'user'}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="text-xs font-medium px-2 py-1 rounded-full border-none cursor-pointer focus:outline-none focus:ring-2"
                        style={
                          user.role === 'admin'
                            ? { backgroundColor: PRIMARY, color: 'white' }
                            : { backgroundColor: '#E7E5EC', color: '#1A1A2E' }
                        }
                      >
                        <option value="user">Utilisateur</option>
                        <option value="admin">Admin</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      {user.is_verified ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3.5 h-3.5" /> Vérifié
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          <XCircle className="w-3.5 h-3.5" /> En attente
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString('fr-FR')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!user.is_verified ? (
                          <Button
                            size="sm"
                            onClick={() => handleVerifyUser(user.id, user.email, false)}
                            className="bg-green-500 hover:bg-green-600 text-white text-xs h-8"
                          >
                            <MailCheck className="w-3.5 h-3.5 mr-1" /> Vérifier
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerifyUser(user.id, user.email, true)}
                            className="text-xs h-8 border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Désactiver
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-[#9A98A8]">
                      Aucun utilisateur ne correspond à ces filtres.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Activité récente */}
        <Card className="mt-8 rounded-2xl border-[#E7E5EC] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1A1A2E]">
              <Clock className="w-4 h-4" style={{ color: PRIMARY }} />
              Activité récente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Salle</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice(0, 15).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.rooms?.name || 'Inconnue'}</TableCell>
                    <TableCell>
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: item.is_occupied ? '#FF6F61' : '#14B8A6' }}
                      >
                        {item.is_occupied ? 'Occupée' : 'Libérée'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-[#6B6B7A]">
                      {new Date(item.changed_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-[#9A98A8]">
                      Aucune activité enregistrée pour le moment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}