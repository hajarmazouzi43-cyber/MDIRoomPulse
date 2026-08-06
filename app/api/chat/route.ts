import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

// Initialisation Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
})

const MODEL = 'llama-3.3-70b-versatile' // ✅ Modèle actuel supporté

// ========== CACHE EN MÉMOIRE ==========
const messageCache = new Map<string, { response: string; timestamp: number }>()
const CACHE_TTL = 3600000 // 1 heure
const MAX_CACHE_SIZE = 100

function getCacheKey(message: string): string {
  return Buffer.from(message).toString('base64').slice(0, 50)
}

function getFromCache(message: string): string | null {
  const key = getCacheKey(message)
  const cached = messageCache.get(key)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('📦 Cache hit')
    return cached.response
  }
  
  if (cached) messageCache.delete(key)
  return null
}

function setCache(message: string, response: string): void {
  if (messageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = messageCache.keys().next().value
    if (firstKey !== undefined) {
      messageCache.delete(firstKey)
    }
  }
  
  const key = getCacheKey(message)
  messageCache.set(key, { response, timestamp: Date.now() })
}

// ========== RATE LIMITING ==========
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000
const MAX_REQUESTS_PER_MINUTE = 10

function checkRateLimit(ip: string, userId: string): { allowed: boolean; retryAfter: number } {
  const key = `${ip}:${userId}`
  const now = Date.now()
  const limit = rateLimitMap.get(key)

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true, retryAfter: 0 }
  }

  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    const retryAfter = Math.ceil((limit.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }

  limit.count++
  return { allowed: true, retryAfter: 0 }
}

// ---------------------------------------------------------------------------
// Exécution des outils
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
      const { data } = await supabase
        .from('bookings')
        .select('*, rooms(name)')
        .order('booking_date', { ascending: true })
        .limit(20)

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

const SYSTEM_INSTRUCTION = `Tu es l'assistant IA de MDI RoomPulse, une application de gestion de salles de réunion.
Réponds toujours en français, de façon concise et utile.
Utilise TOUJOURS les outils fournis pour obtenir des données à jour avant de répondre.
Formate tes réponses avec des puces et des emojis pertinents (🟢 libre, 🔴 occupée, 📅 réservation) pour rester lisible.`

// ---------------------------------------------------------------------------
// Route POST avec Groq
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY manquante. Ajoutez-la dans .env.local' },
        { status: 500 }
      )
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const { messages, userId } = (await request.json()) as {
      messages: { role: 'user' | 'assistant'; content: string }[]
      userId?: string
    }

    // ✅ RATE LIMITING
    const { allowed, retryAfter } = checkRateLimit(ip, userId || 'anonymous')
    if (!allowed) {
      return NextResponse.json(
        { 
          error: `Trop de requêtes. Réessayez dans ${retryAfter} secondes.`,
          retryAfter
        },
        { status: 429 }
      )
    }

    const lastMessage = messages[messages.length - 1].content

    // ✅ CACHING
    const cachedResponse = getFromCache(lastMessage)
    if (cachedResponse) {
      return NextResponse.json({ reply: cachedResponse, fromCache: true })
    }

    const supabase = await createClient()

    // Appel à Groq
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: SYSTEM_INSTRUCTION
        },
        ...messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      ],
      model: MODEL,
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.9
    })

    const text = completion.choices[0]?.message?.content || 'Pas de réponse'

    // ✅ Mettre en cache
    setCache(lastMessage, text)

    return NextResponse.json({ reply: text, fromCache: false })
  } catch (error: any) {
    console.error('Groq API error:', error)
    
    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Groq limite atteinte. Réessayez dans quelques secondes.' },
        { status: 429 }
      )
    }

    if (error.status === 401 || error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'Clé Groq API invalide. Vérifiez GROQ_API_KEY dans .env.local' },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}