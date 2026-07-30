import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

// Initialisation avec le SDK stable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const MODEL = 'gemini-2.0-flash-exp'

// ---------------------------------------------------------------------------
// 1. Déclaration des outils que le modèle peut appeler
// ---------------------------------------------------------------------------
// ✅ Utilisation de 'as any' pour contourner le problème de typage TypeScript
const tools = [
  {
    functionDeclarations: [
      {
        name: 'get_free_rooms',
        description: "Retourne la liste des salles actuellement libres (hors salles hors service et hors espace détente).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
          required: []
        }
      },
      {
        name: 'get_occupied_rooms',
        description: "Retourne la liste des salles actuellement occupées, avec le nombre de personnes présentes et l'heure de fin prévue.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
          required: []
        }
      },
      {
        name: 'get_room_details',
        description: "Retourne les détails d'une salle précise à partir de son nom (ou une partie du nom).",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            room_name: { 
              type: SchemaType.STRING, 
              description: 'Nom (ou fragment de nom) de la salle recherchée' 
            }
          },
          required: ['room_name']
        }
      },
      {
        name: 'get_stats',
        description: "Retourne les statistiques globales d'occupation : taux d'occupation, salles confidentielles, salles hors service, etc.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {},
          required: []
        }
      },
      {
        name: 'get_bookings',
        description: 'Retourne les réservations à venir sur une période donnée.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            period: {
              type: SchemaType.STRING,
              enum: ['today', 'week', 'month'],
              description: 'Période à consulter : aujourd\'hui, cette semaine, ou ce mois-ci'
            }
          },
          required: ['period']
        }
      },
      {
        name: 'get_history',
        description: 'Retourne les dernières activités enregistrées (occupations et libérations de salles).',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            limit: { 
              type: SchemaType.NUMBER, 
              description: 'Nombre d\'événements à retourner (10 par défaut)' 
            }
          },
          required: []
        }
      }
    ]
  }
] as any // ✅ Solution : cast en 'any' pour éviter les erreurs de type

// ---------------------------------------------------------------------------
// 2. Exécution réelle des outils contre Supabase
// ---------------------------------------------------------------------------
async function executeTool(name: string, args: any, supabase: any) {
  switch (name) {
    case 'get_free_rooms': {
      const { data } = await supabase.from('rooms').select('*')
      const free = (data || []).filter(
        (r: any) => !r.is_occupied && !r.is_out_of_service && r.category !== 'detente'
      )
      return free.map((r: any) => ({
        name: r.name,
        location: r.location,
        capacity: r.capacity,
        equipment: r.equipment
      }))
    }

    case 'get_occupied_rooms': {
      const { data } = await supabase.from('rooms').select('*')
      const occupied = (data || []).filter((r: any) => r.is_occupied)
      return occupied.map((r: any) => ({
        name: r.name,
        current_people: r.current_people,
        max_people: r.max_people || r.capacity,
        occupied_until: r.occupied_until
      }))
    }

    case 'get_room_details': {
      const { data } = await supabase.from('rooms').select('*').ilike('name', `%${args.room_name}%`)
      return data || []
    }

    case 'get_stats': {
      const { data: rooms } = await supabase.from('rooms').select('*')
      const total = rooms?.length || 0
      const occupied = rooms?.filter((r: any) => r.is_occupied).length || 0
      return {
        total_rooms: total,
        free_rooms: total - occupied,
        occupied_rooms: occupied,
        occupancy_rate: total > 0 ? Math.round((occupied / total) * 100) : 0,
        confidential_rooms: rooms?.filter((r: any) => r.is_confidential).length || 0,
        out_of_service_rooms: rooms?.filter((r: any) => r.is_out_of_service).length || 0
      }
    }

    case 'get_bookings': {
      const now = new Date()
      let start: Date
      let end: Date

      if (args.period === 'today') {
        start = new Date(now)
        end = new Date(now)
        end.setDate(end.getDate() + 1)
      } else if (args.period === 'week') {
        start = new Date(now)
        end = new Date(now)
        end.setDate(end.getDate() + 7)
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      }

      const { data } = await supabase
        .from('bookings')
        .select('*, rooms(name)')
        .gte('booking_date', start.toISOString().split('T')[0])
        .lte('booking_date', end.toISOString().split('T')[0])

      return (data || []).map((b: any) => ({
        room: b.rooms?.name,
        date: b.booking_date,
        start: b.start_time,
        end: b.end_time,
        title: b.title
      }))
    }

    case 'get_history': {
      const { data } = await supabase
        .from('room_history')
        .select('*, rooms(name)')
        .order('changed_at', { ascending: false })
        .limit(args.limit || 10)

      return (data || []).map((h: any) => ({
        room: h.rooms?.name,
        status: h.is_occupied ? 'Occupée' : 'Libre',
        changed_at: h.changed_at
      }))
    }

    default:
      return { error: `Outil inconnu: ${name}` }
  }
}

const SYSTEM_INSTRUCTION = `Tu es l'assistant IA de MDI RoomPulse, une application de gestion de salles.
Réponds toujours en français, de façon concise et utile.
Utilise TOUJOURS les outils fournis pour obtenir des données à jour avant de répondre — ne devine JAMAIS
l'état des salles, des réservations ou des statistiques : ces données changent en temps réel.
Formate tes réponses avec des puces et des emojis pertinents (🟢 libre, 🔴 occupée, 📅 réservation, 📋 historique)
pour rester lisible, comme un petit tableau de bord.`

// ---------------------------------------------------------------------------
// 3. Route POST — version simplifiée sans boucle d'appel d'outils
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY manquante. Ajoutez-la dans .env.local puis redémarrez le serveur.' },
        { status: 500 }
      )
    }

    const { messages } = (await request.json()) as {
      messages: { role: 'user' | 'assistant'; content: string }[]
    }

    const supabase = await createClient()

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: tools, // ✅ tools est typé as any
    })

    const chat = model.startChat({
      history: messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    })

    // Dernier message de l'utilisateur
    const lastMessage = messages[messages.length - 1]
    const result = await chat.sendMessage(lastMessage.content)
    const text = result.response.text()

    return NextResponse.json({ reply: text })
  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
