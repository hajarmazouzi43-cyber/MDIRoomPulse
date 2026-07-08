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

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rooms, setRooms] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchData()
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '👋 Hello! I am your RoomPulse AI Assistant.\n\nAsk me anything about the rooms, occupancy, history, or get recommendations.\n\nI understand natural language, so just ask in your own words!',
        timestamp: new Date(),
      },
    ])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchData = async () => {
    const { data: roomsData } = await supabase.from('rooms').select('*')
    const { data: historyData } = await supabase
      .from('room_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(100)
    if (roomsData) setRooms(roomsData)
    if (historyData) setHistory(historyData)
  }

  // 🔍 Analyse avancée de la requête
  const processUserQuery = (query: string): string => {
    const lower = query.toLowerCase().trim()

    // --- 1. SALUTATIONS ---
    if (lower.match(/^(bonjour|salut|coucou|hello|hi|hey|yo|hola)/)) {
      return '👋 Bonjour ! Comment puis-je vous aider aujourd\'hui ? Vous pouvez me poser des questions sur les salles, les statistiques, ou demander des recommandations.'
    }

    // --- 2. QUI EST LIBRE ? / SALLES DISPONIBLES ---
    if (lower.match(/libre|disponible|free|available|vide|vacant|qui est/i)) {
      const freeList = rooms.filter((r) => !r.is_occupied && r.category !== 'detente')
      if (freeList.length === 0) {
        return '🟢 Toutes les salles sont occupées pour le moment. Vous pouvez vous installer dans le coin détente (fauteuils confortables).'
      }
      let response = `🟢 Salles libres (${freeList.length}) :\n`
      freeList.forEach((r) => {
        response += `• ${r.name} (${r.location || 'N/A'}) - ${r.capacity} personnes\n`
      })
      return response
    }

    // --- 3. SALLES OCCUPÉES ---
    if (lower.match(/occupée|occupé|occupied|prise|pris|utilisée/i)) {
      const occupiedList = rooms.filter((r) => r.is_occupied)
      if (occupiedList.length === 0) {
        return '🟢 Toutes les salles sont libres ! 🎉'
      }
      let response = `🔴 Salles occupées (${occupiedList.length}) :\n`
      occupiedList.forEach((r) => {
        response += `• ${r.name} (${r.current_people || 0}/${r.max_people || r.capacity || 1} personnes)`
        if (r.occupied_until) {
          response += ` - jusqu\'à ${new Date(r.occupied_until).toLocaleTimeString()}`
        }
        response += '\n'
      })
      return response
    }

    // --- 4. STATISTIQUES ---
    if (lower.match(/statistique|stat|stats|taux|pourcentage|combien|total|résumé/i)) {
      const total = rooms.length
      const occupied = rooms.filter((r) => r.is_occupied).length
      const free = total - occupied
      const rate = total > 0 ? Math.round((occupied / total) * 100) : 0
      const confidential = rooms.filter((r) => r.is_confidential).length
      const postes = rooms.filter((r) => r.category === 'poste').length
      const reunion = rooms.filter((r) => r.category === 'reunion').length
      const detente = rooms.filter((r) => r.category === 'detente').length
      const totalPeople = rooms.reduce((acc, r) => acc + (r.current_people || 0), 0)
      const maxCapacity = rooms.reduce((acc, r) => acc + (r.max_people || r.capacity || 0), 0)

      return `📊 Statistiques des salles :
• Total : ${total} salles
• Libres : ${free}
• Occupées : ${occupied}
• Taux d'occupation : ${rate}%
• Personnes présentes : ${totalPeople} / ${maxCapacity}
• Salles confidentielles : ${confidential}
• Postes de travail : ${postes}
• Salles de réunion : ${reunion}
• Coin détente : ${detente}`
    }

    // --- 5. HISTORIQUE ---
    if (lower.match(/historique|history|dernier|récent|activité|actions|log/i)) {
      const recent = history.slice(0, 10)
      if (recent.length === 0) {
        return '📋 Aucun historique récent disponible.'
      }
      let response = `📋 Dernières activités (${recent.length}) :\n`
      recent.forEach((h) => {
        const roomName = h.rooms?.name || 'Salle inconnue'
        const status = h.is_occupied ? 'Occupée' : 'Libre'
        const time = new Date(h.changed_at).toLocaleString()
        response += `• ${roomName} : ${status} à ${time}\n`
      })
      return response
    }

    // --- 6. RECOMMANDATIONS ---
    if (lower.match(/recommandation|conseil|suggestion|optimiser|améliorer|advise/i)) {
      const total = rooms.length
      const occupied = rooms.filter((r) => r.is_occupied).length
      const rate = total > 0 ? Math.round((occupied / total) * 100) : 0
      const recommendations = []

      if (rate > 80) {
        recommendations.push('🔴 Taux d\'occupation élevé (${rate}%). Pensez à ouvrir des salles supplémentaires si nécessaire.')
      } else if (rate < 30) {
        recommendations.push('🟢 Taux d\'occupation faible (${rate}%). Vous pourriez fermer certaines salles pour économiser de l\'énergie.')
      } else {
        recommendations.push('🟡 Taux d\'occupation optimal (${rate}%). Bonne utilisation des salles !')
      }

      // Salles les plus utilisées
      const usage = rooms
        .map((r) => ({
          name: r.name,
          count: history.filter((h) => h.room_id === r.id).length,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)

      if (usage.length > 0 && usage[0].count > 0) {
        recommendations.push(`🏢 Salles les plus utilisées : ${usage.map((r) => r.name).join(', ')}`)
      }

      // Heures de pointe
      const hours: Record<number, number> = {}
      history.forEach((h) => {
        const hour = new Date(h.changed_at).getHours()
        hours[hour] = (hours[hour] || 0) + 1
      })
      const peak = Object.entries(hours).sort((a, b) => b[1] - a[1]).slice(0, 2)
      if (peak.length > 0) {
        recommendations.push(`⏰ Heures de pointe : ${peak.map(([h]) => `${h}h-${parseInt(h) + 1}h`).join(', ')}`)
      }

      return `📈 Recommandations :\n${recommendations.join('\n')}`
    }

    // --- 7. SALLE SPÉCIFIQUE ---
    // Cherche une salle par nom
    const roomMatch = rooms.find((r) => lower.includes(r.name.toLowerCase()))
    if (roomMatch) {
      const r = roomMatch
      return `📋 Détails de "${r.name}" :
• Statut : ${r.is_occupied ? '🔴 Occupée' : '🟢 Libre'}
• Capacité : ${r.capacity} personnes
• Personnes : ${r.current_people || 0} / ${r.max_people || r.capacity || 0}
• Localisation : ${r.location || 'N/A'}
• Équipements : ${r.equipment?.join(', ') || 'Aucun'}
${r.is_confidential ? '🔒 Salle confidentielle' : ''}
${r.is_occupied && r.occupied_until ? `⏱️ Occupée jusqu'à ${new Date(r.occupied_until).toLocaleTimeString()}` : ''}`
    }

    // --- 8. CAPACITÉ / NOMBRE DE PERSONNES ---
    if (lower.match(/capacité|capacity|combien de personnes|max/i)) {
      const cap = rooms
        .filter((r) => r.category !== 'detente')
        .map((r) => `• ${r.name} : ${r.capacity} personnes (max ${r.max_people || r.capacity || 0})`)
        .join('\n')
      return `📊 Capacités des salles :\n${cap || 'Aucune salle disponible'}`
    }

    // --- 9. ÉQUIPEMENTS ---
    if (lower.match(/équipement|equipment|écran|vidéo|projecteur|visio|audio/i)) {
      const eq = rooms
        .filter((r) => r.equipment && r.equipment.length > 0)
        .map((r) => `• ${r.name} : ${r.equipment.join(', ')}`)
        .join('\n')
      return `🛠️ Équipements disponibles :\n${eq || 'Aucun équipement répertorié'}`
    }

    // --- 10. CONFIDENTIEL ---
    if (lower.match(/confidentiel|confidential|privé|private/i)) {
      const conf = rooms.filter((r) => r.is_confidential)
      if (conf.length === 0) {
        return '🔒 Aucune salle confidentielle pour le moment.'
      }
      return `🔒 Salles confidentielles :\n${conf.map((r) => `• ${r.name}`).join('\n')}`
    }

    // --- 11. AIDE ---
    if (lower.match(/aide|help|commande|que peux-tu faire/i)) {
      return `🤖 Je peux répondre à toutes vos questions sur les salles :

🔍 Questions possibles :
• "Qui est libre ?" / "Salles disponibles"
• "Qui est occupé ?" / "Salles occupées"
• "Statistiques" / "Résumé des salles"
• "Historique" / "Dernières activités"
• "Recommandations" / "Conseils"
• Nom d'une salle (ex: "Bureau CEO")
• "Capacité des salles"
• "Équipements disponibles"
• "Salles confidentielles"

Posez-moi n'importe quelle question en langage naturel !`
    }

    // --- 12. RÉPONSE PAR DÉFAUT (intelligente) ---
    // Essaie de comprendre le contexte de la question
    let fallback = `🤔 Je n'ai pas bien compris votre question : "${query}"

💡 Essayez de reformuler avec :
• "Qui est libre ?"
• "Statistiques des salles"
• "Historique récent"
• "Recommandations"
• Le nom d'une salle spécifique

Ou tapez "Aide" pour voir toutes les commandes possibles.`

    // Si la question contient un mot-clé, essaye de deviner
    if (lower.includes('combien') || lower.includes('nombre')) {
      fallback += '\n\n💡 Si vous voulez des statistiques, essayez "Statistiques"'
    }
    if (lower.includes('quoi') || lower.includes('que')) {
      fallback += '\n\n💡 Essayez "Aide" pour voir ce que je peux faire'
    }

    return fallback
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    setTimeout(() => {
      const response = processUserQuery(input)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 400)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#0056B3]">🤖 AI Assistant</h1>
        <Badge className="bg-green-500">Online</Badge>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-medium text-gray-500">
            RoomPulse AI Assistant - Ask me anything about the rooms
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
                    ? 'bg-[#0056B3] text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-lg">
                <span className="animate-pulse">...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4 flex gap-2">
          <Input
            placeholder="Ask anything about the rooms..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-[#0056B3] hover:bg-[#00449E]"
          >
            Send
          </Button>
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setInput('Qui est libre ?')
            setTimeout(handleSend, 100)
          }}
        >
          🔍 Libres
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setInput('Qui est occupé ?')
            setTimeout(handleSend, 100)
          }}
        >
          🔴 Occupés
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setInput('Statistiques')
            setTimeout(handleSend, 100)
          }}
        >
          📊 Stats
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setInput('Recommandations')
            setTimeout(handleSend, 100)
          }}
        >
          📈 Conseils
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setInput('Historique récent')
            setTimeout(handleSend, 100)
          }}
        >
          📋 Historique
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setInput('Aide')
            setTimeout(handleSend, 100)
          }}
        >
          ❓ Aide
        </Button>
      </div>
    </div>
  )
}