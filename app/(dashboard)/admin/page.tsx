'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import ReportPDF from '@/components/ReportPDF'

export default function AdminPage() {
  const [rooms, setRooms] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any>(null)
  const supabase = createClient()

  const [formData, setFormData] = useState({
    name: '',
    capacity: '',
    equipment: '',
    location: '',
    category: 'poste',
    max_people: '',
    room_email: '',
    is_confidential: 'false'
  })

  useEffect(() => {
    fetchData()
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
        room_email: formData.room_email?.trim() || formData.name.toLowerCase().replace(/\s/g, '') + '@mdi.com'
      }

      if (formData.max_people) {
        data.max_people = Number(formData.max_people)
      }

      let error
      if (editingRoom) {
        const { error: updateError } = await supabase
          .from('rooms')
          .update(data)
          .eq('id', editingRoom.id)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('rooms')
          .insert(data)
        error = insertError
      }

      if (error) {
        console.error('Supabase error:', error)
        toast.error('Error saving room: ' + error.message)
      } else {
        toast.success(editingRoom ? 'Room updated!' : 'Room added!')
        fetchData()
        setIsDialogOpen(false)
        setEditingRoom(null)
        setFormData({ name: '', capacity: '', equipment: '', location: '', category: 'poste', max_people: '', room_email: '', is_confidential: 'false' })
      }
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error saving room: ' + error.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) {
      toast.error('Error deleting room')
    } else {
      toast.success('Room deleted')
      fetchData()
    }
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
      is_confidential: room.is_confidential ? 'true' : 'false'
    })
    setIsDialogOpen(true)
  }

  const stats = {
    totalRooms: rooms.length,
    totalUsers: users.length,
    occupiedRooms: rooms.filter(r => r.is_occupied).length,
    freeRooms: rooms.filter(r => !r.is_occupied).length,
    confidentialRooms: rooms.filter(r => r.is_confidential).length,
    totalHistory: history.length
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-[#0056B3]">Admin Dashboard</h1>
        <div className="flex gap-2">
          <PDFDownloadLink
            document={
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
            }
            fileName={`report-${new Date().toISOString().split('T')[0]}.pdf`}
          >
            {({ loading }) => (
              <Button disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Generating...' : '📄 Generate PDF'}
              </Button>
            )}
          </PDFDownloadLink>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0056B3] hover:bg-[#00449E]">
                {editingRoom ? 'Edit Room' : 'Add Room'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRoom ? 'Edit Room' : 'Add New Room'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Capacity</Label>
                    <Input type="number" value={formData.capacity} onChange={(e) => setFormData({...formData, capacity: e.target.value})} />
                  </div>
                  <div>
                    <Label>Max People</Label>
                    <Input type="number" value={formData.max_people} onChange={(e) => setFormData({...formData, max_people: e.target.value})} />
                  </div>
                </div>
                <div>
                  <Label>Room Email</Label>
                  <Input value={formData.room_email} onChange={(e) => setFormData({...formData, room_email: e.target.value})} />
                </div>
                <div>
                  <Label>Equipment (comma separated)</Label>
                  <Input value={formData.equipment} onChange={(e) => setFormData({...formData, equipment: e.target.value})} />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
                </div>
                <div>
                  <Label>Category</Label>
                  <select 
                    className="w-full border rounded-lg p-2"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="bureau">Bureau</option>
                    <option value="reunion">Reunion</option>
                    <option value="poste">Poste</option>
                    <option value="detente">Detente</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="confidential"
                    checked={formData.is_confidential === 'true'}
                    onChange={(e) => setFormData({...formData, is_confidential: e.target.checked ? 'true' : 'false'})}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="confidential">🔒 Confidential Room</Label>
                </div>
                <Button onClick={handleSubmit} className="w-full">
                  {editingRoom ? 'Update' : 'Add'} Room
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalRooms}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalUsers}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Free Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{stats.freeRooms}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Occupied Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{stats.occupiedRooms}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">🔒 Confidential</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-500">{stats.confidentialRooms}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rooms Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rooms Management</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>People</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>🔒</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell className="text-sm">{room.room_email || '-'}</TableCell>
                  <TableCell>{room.capacity}</TableCell>
                  <TableCell>{room.current_people || 0}/{room.max_people || room.capacity || 0}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${room.is_occupied ? 'bg-red-500' : 'bg-green-500'}`}>
                      {room.is_occupied ? 'Occupied' : 'Free'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {room.is_confidential ? '🔒' : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(room)}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(room.id)}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Users Management</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-sm">{user.id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                      {user.role || 'user'}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}