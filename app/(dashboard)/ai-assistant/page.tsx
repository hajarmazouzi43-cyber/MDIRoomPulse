'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface RoomData {
  id: string
  name: string
  capacity: number
  equipment: string[]
  location: string
  category: string
  is_occupied: boolean
  is_confidential: boolean
  current_people: number
  max_people: number
  occupied_until: string | null
  room_email: string
  status: string
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rooms, setRooms] = useState<RoomData[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
    getUser()
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '👋 Bonjour ! Je suis votre assistant IA connecté à la base de données.\n\nJe peux vous donner des informations en temps réel sur :\n• 📊 Statistiques des salles\n• 🏢 Disponibilité des salles\n• 📅 Réservations\n• 📋 Historique\n• 💡 Recommandations\n\nEssayez : "Quelles sont les salles libres ?" ou "Statistiques du mois"',
        timestamp: new Date()
      },
    ])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const fetchData = async () => {
    // Récupérer les salles
    const { data: roomsData } = await supabase.from('rooms').select('*')
    if (roomsData) setRooms(roomsData)

    // Récupérer les réservations du mois
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('*, rooms(name)')
      .gte('booking_date', firstDay.toISOString().split('T')[0])
      .lte('booking_date', lastDay.toISOString().split('T')[0])
    if (bookingsData) setBookings(bookingsData)

    // Récupérer l'historique récent
    const { data: historyData } = await supabase
      .from('room_history')
      .select('*, rooms(name)')
      .order('changed_at', { ascending: false })
      .limit(50)
    if (historyData) setHistory(historyData)
  }

  // 🔍 Traitement de la requête avec données réelles
  const processQuery = (query: string): string => {
    const lower = query.toLowerCase().trim()

    // --- 1. SALUTATIONS ---
    if (lower.match(/^(bonjour|salut|coucou|hello|hi|hey|yo|hola)/)) {
      return `👋 Bonjour ! Je suis votre assistant IA. Je suis connecté à la base de données et je peux vous donner des informations en temps réel sur les salles, les réservations et les statistiques. Que puis-je faire pour vous ?`
    }

    // --- 2. STATISTIQUES GÉNÉRALES ---
    if (lower.match(/statistique|stat|stats|taux|pourcentage|combien|total|résumé|general/i)) {
      const totalRooms = rooms.length
      const occupiedRooms = rooms.filter(r => r.is_occupied).length
      const freeRooms = totalRooms - occupiedRooms
      const rate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
      const totalBookings = bookings.length
      const totalHistory = history.length
      const totalPeople = rooms.reduce((acc, r) => acc + (r.current_people || 0), 0)
      const maxCapacity = rooms.reduce((acc, r) => acc + (r.max_people || r.capacity || 0), 0)
      const confidentialRooms = rooms.filter(r => r.is_confidential).length
      const outOfServiceRooms = rooms.filter(r => r.is_out_of_service).length

      return `📊 **Statistiques en temps réel** :
• 🏢 Total salles : ${totalRooms}
• 🟢 Salles libres : ${freeRooms}
• 🔴 Salles occupées : ${occupiedRooms}
• 📈 Taux d'occupation : ${rate}%
• 👥 Personnes présentes : ${totalPeople} / ${maxCapacity}
• 📅 Réservations ce mois : ${totalBookings}
• 📋 Événements historiques : ${totalHistory}
• 🔒 Salles confidentielles : ${confidentialRooms}
• 🚫 Salles hors service : ${outOfServiceRooms}`
    }

    // --- 3. SALLES LIBRES ---
    if (lower.match(/libre|disponible|free|available|vide|vacant|qui est/i)) {
      const freeList = rooms.filter(r => !r.is_occupied && r.category !== 'detente' && !r.is_out_of_service)
      if (freeList.length === 0) {
        return '🟢 **Aucune salle libre** pour le moment. Vous pouvez vous installer dans le coin détente (fauteuils confortables).'
      }
      let response = `🟢 **Salles libres (${freeList.length})** :\n\n`
      freeList.forEach(r => {
        response += `• **${r.name}** - ${r.location || 'N/A'} - ${r.capacity} personnes`
        if (r.equipment && r.equipment.length > 0) {
          response += ` (${r.equipment.slice(0, 2).join(', ')})`
        }
        response += '\n'
      })
      return response
    }

    // --- 4. SALLES OCCUPÉES ---
    if (lower.match(/occupée|occupé|occupied|prise|pris|utilisée/i)) {
      const occupiedList = rooms.filter(r => r.is_occupied)
      if (occupiedList.length === 0) {
        return '🟢 **Toutes les salles sont libres !** 🎉'
      }
      let response = `🔴 **Salles occupées (${occupiedList.length})** :\n\n`
      occupiedList.forEach(r => {
        response += `• **${r.name}** - ${r.current_people || 0}/${r.max_people || r.capacity || 1} personnes`
        if (r.occupied_until) {
          response += ` - jusqu'à ${new Date(r.occupied_until).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}`
        }
        response += '\n'
      })
      return response
    }

    // --- 5. RÉSERVATIONS DU MOIS ---
    if (lower.match(/réservation|booking|calendrier|mois|planning/i)) {
      if (bookings.length === 0) {
        return '📅 **Aucune réservation** ce mois-ci.'
      }
      let response = `📅 **Réservations du mois (${bookings.length})** :\n\n`
      bookings.slice(0, 10).forEach(b => {
        const roomName = b.rooms?.name || 'Salle inconnue'
        const date = new Date(b.booking_date).toLocaleDateString('fr-FR')
        const start = b.start_time?.slice(0, 5) || 'N/A'
        const end = b.end_time?.slice(0, 5) || 'N/A'
        response += `• **${roomName}** - ${date} (${start} → ${end}) - ${b.title || 'Réunion'}\n`
      })
      if (bookings.length > 10) {
        response += `\n... et ${bookings.length - 10} autres réservations.`
      }
      return response
    }

    // --- 6. HISTORIQUE RÉCENT ---
    if (lower.match(/historique|history|dernier|récent|activité|actions|log/i)) {
      if (history.length === 0) {
        return '📋 **Aucun historique** récent disponible.'
      }
      let response = `📋 **Dernières activités (${Math.min(10, history.length)})** :\n\n`
      history.slice(0, 10).forEach(h => {
        const roomName = h.rooms?.name || 'Salle inconnue'
        const status = h.is_occupied ? 'Occupée' : 'Libre'
        const time = new Date(h.changed_at).toLocaleString('fr-FR')
        response += `• **${roomName}** : ${status} à ${time}\n`
      })
      return response
    }

    // --- 7. RECOMMANDATIONS ---
    if (lower.match(/recommandation|conseil|suggestion|optimiser|améliorer|advise/i)) {
      const total = rooms.length
      const occupied = rooms.filter(r => r.is_occupied).length
      const rate = total > 0 ? Math.round((occupied / total) * 100) : 0
      let recommendations = []

      if (rate > 80) {
        recommendations.push('🔴 **Taux d\'occupation élevé** (${rate}%). Pensez à ouvrir des salles supplémentaires si nécessaire.')
      } else if (rate < 30) {
        recommendations.push('🟢 **Taux d\'occupation faible** (${rate}%). Vous pourriez fermer certaines salles pour économiser l\'énergie.')
      } else {
        recommendations.push('🟡 **Taux d\'occupation optimal** (${rate}%). Bonne utilisation des salles !')
      }

      // Salles les plus utilisées
      const roomUsage = rooms
        .map(r => ({
          name: r.name,
          count: history.filter(h => h.room_id === r.id).length
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)

      if (roomUsage.length > 0 && roomUsage[0].count > 0) {
        recommendations.push(`🏢 **Salles les plus utilisées** : ${roomUsage.map(r => r.name).join(', ')}`)
      }

      // Heures de pointe
      const hours: Record<number, number> = {}
      history.forEach(h => {
        const hour = new Date(h.changed_at).getHours()
        hours[hour] = (hours[hour] || 0) + 1
      })
      const peak = Object.entries(hours).sort((a, b) => b[1] - a[1]).slice(0, 2)
      if (peak.length > 0) {
        recommendations.push(`⏰ **Heures de pointe** : ${peak.map(([h]) => `${h}h-${parseInt(h) + 1}h`).join(', ')}`)
      }

      return `📈 **Recommandations** :\n\n${recommendations.join('\n')}`
    }

    // --- 8. SALLE SPÉCIFIQUE ---
    const roomMatch = rooms.find(r => lower.includes(r.name.toLowerCase()))
    if (roomMatch) {
      const r = roomMatch
      return `📋 **Détails de "${r.name}"** :
• Statut : ${r.is_out_of_service ? '🚫 Hors service' : r.is_occupied ? '🔴 Occupée' : '🟢 Libre'}
• Capacité : ${r.capacity} personnes
• Personnes : ${r.current_people || 0} / ${r.max_people || r.capacity || 0}
• Localisation : ${r.location || 'N/A'}
• Équipements : ${r.equipment?.join(', ') || 'Aucun'}
${r.is_confidential ? '• 🔒 Salle confidentielle' : ''}
${r.is_out_of_service && r.out_of_service_reason ? `• 🚫 Raison : ${r.out_of_service_reason}` : ''}
${r.is_occupied && r.occupied_until ? `• ⏱️ Occupée jusqu'à ${new Date(r.occupied_until).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}` : ''}`
    }

    // --- 9. AIDE ---
    if (lower.match(/aide|help|commande|que peux-tu faire/i)) {
      return `🤖 **Je peux vous aider avec** :

🔍 **Questions possibles** :
• "Quelles sont les salles libres ?"
• "Quelles sont les salles occupées ?"
• "Statistiques des salles"
• "Réservations du mois"
• "Historique récent"
• "Recommandations"
• Nom d'une salle (ex: "Bureau CEO")
• "Aide" pour voir cette liste

Je suis connecté à la base de données, toutes mes réponses sont **en temps réel** !`
    }

    // --- 10. RÉPONSE PAR DÉFAUT ---
    return `🤔 Je n'ai pas bien compris votre question : "${query}"

💡 Essayez de reformuler avec :
• "Quelles sont les salles libres ?"
• "Statistiques des salles"
• "Réservations du mois"
• "Historique récent"
• "Recommandations"
• Le nom d'une salle spécifique

Ou tapez "Aide" pour voir toutes les commandes possibles.`
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Rafraîchir les données avant de répondre
    await fetchData()

    setTimeout(() => {
      const response = processQuery(input)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsLoading(false)
    }, 500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  // Suggestions rapides
  const quickQuestions = [
    'Quelles sont les salles libres ?',
    'Salles occupées',
    'Statistiques',
    'Réservations du mois',
    'Historique récent',
    'Recommandations',
  ]

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#0056B3] dark:text-[#00A3E0]">
          🤖 Assistant IA
        </h1>
        <Badge className="bg-green-500">🟢 Connecté à la base de données</Badge>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Assistant IA connecté à la base de données - Questions en temps réel
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-[#0056B3] text-white dark:bg-[#0056B3]'
                    : 'bg-gray-100 dark:bg-[#1e293b] text-gray-800 dark:text-gray-200'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-[#1e293b] p-3 rounded-lg">
                <span className="animate-pulse text-gray-500 dark:text-gray-400">...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4 flex gap-2">
          <Input
            placeholder="Posez une question sur les salles..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1 dark:bg-[#1e293b] dark:border-[#334155] dark:text-white"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-[#0056B3] hover:bg-[#00449E] dark:bg-[#0056B3] dark:hover:bg-[#00449E]"
          >
            Envoyer
          </Button>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickQuestions.map((q, i) => (
          <Button
            key={i}
            variant="outline"
            size="sm"
            onClick={() => {
              setInput(q)
              setTimeout(handleSend, 100)
            }}
            className="dark:border-[#334155] dark:text-gray-300 dark:hover:bg-[#1e293b]"
          >
            {q}
          </Button>
        ))}
      </div>
    </div>
  )
}