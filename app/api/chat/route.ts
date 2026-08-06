import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'

// Initialisation avec le SDK stable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

const MODEL = 'gemini-2.0-flash'

// ========== CACHE EN MÉMOIRE (gratuit) ==========
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
    console.log('📦 Cache hit - pas d\'appel API')
    return cached.response
  }
  
  if (cached) messageCache.delete(key)
  return null
}

function setCache(message: string, response: string): void {
  // Limiter la taille du cache
  if (messageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = messageCache.keys().next().value
    messageCache.delete(firstKey)
  }
  
  const key = getCacheKey(message)
  messageCache.set(key, { response, timestamp: Date.now() })
}

// ========== RATE LIMITING (gratuit) ==========
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_MINUTE = 3 // Max 3 questions par minute

function getRateLimitKey(ip: string, userId: string): string {
  return `${ip}:${userId}`
}

function checkRateLimit(ip: string, userId: string): { allowed: boolean; retryAfter: number } {
  const key = getRateLimitKey(ip, userId)
  const now = Date.now()
  const limit = rateLimitMap.get(key)

  // Réinitialiser si la fenêtre est dépassée
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true, retryAfter: 0 }
  }

  // Vérifier le nombre de requêtes
  if (limit.count >= MAX_REQUESTS_PER_MINUTE) {
    const retryAfter = Math.ceil((limit.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }

  limit.count++
  return { allowed: true, retryAfter: 0 }
}

// ---------------------------------------------------------------------------
// Déclaration des outils
// ---------------------------------------------------------------------------
const tools = [
  {
    functionDeclarations: [
      {
        name: 'get_free_rooms',
        description: "Retourne la liste des salles actuellement libres.",
        parameters: { type: SchemaType.OBJECT, properties: {}, required: [] }
      },
      {
        name: 'get_occupied_rooms',
        description: "Retourne la liste des salles occupées.",
        parameters: { type: SchemaType.OBJECT, properties: {}, required: [] }
      },
      {
        name: 'get_room_details',
        description: "Retourne les détails d'une salle précise.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: { room_name: { type: SchemaType.STRING, description: 'Nom de la salle' } },
          required: ['room_name']
        }
      },
      {
        name: 'get_stats',
        description: "Retourne les statistiques globales d'occupation.",
        parameters: { type: SchemaType.OBJECT, properties: {}, required: [] }
      },
      {
        name: 'get_bookings',
        description: 'Retourne les réservations à venir.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            period: { type: SchemaType.STRING, enum: ['today', 'week', 'month'] }
          },
          required: ['period']
        }
      },
      {
        name: 'get_history',
        description: 'Retourne les dernières activités enregistrées.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { limit: { type: SchemaType.NUMBER } },
          required: []
        }
      }
    ]
  }
] as any

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
      return free.map((r: any) => ({ name: r.name, location: r.location, capacity: r.capacity }))
    }
    case 'get_occupied_rooms': {
      const { data } = await supabase.from('rooms').select('*')
      return (data || []).filter((r: any) => r.is_occupied)
    }
    case 'get_room_details': {
      const { data } = await supabase.from('rooms').select('*').ilike('name', `%${args.room_name}%`)
      return data || []
    }
    case 'get_stats': {
      const { data: rooms } = await supabase.from('rooms').select('*')
      const total = rooms?.length || 0
      const occupied = rooms?.filter((r: any) => r.is_occupied).length || 0
      return { total_rooms: total, occupied_rooms: occupied, free_rooms: total - occupied }
    }
    case 'get_bookings': {
      const { data } = await supabase.from('bookings').select('*, rooms(name)').limit(10)
      return data || []
    }
    case 'get_history': {
      const { data } = await supabase.from('room_history').select('*, rooms(name)').limit(args.limit || 10)
      return data || []
    }
    default:
      return { error: `Outil inconnu: ${name}` }
  }
}

const SYSTEM_INSTRUCTION = `Tu es l'assistant IA de MDI RoomPulse.
Réponds toujours en français, de façon concise et utile.
Utilise TOUJOURS les outils fournis pour obtenir les données à jour.`

// ---------------------------------------------------------------------------
// Route POST optimisée
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    // Extraire IP et user ID pour le rate limit
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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY manquante' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: tools,
    })

    const chat = model.startChat({
      history: messages.slice(0, -1).map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    })

    const result = await chat.sendMessage(lastMessage)
    const text = result.response.text()

    // ✅ Mettre en cache la réponse
    setCache(lastMessage, text)

    return NextResponse.json({ reply: text, fromCache: false })
  } catch (error: any) {
    console.error('Chat API error:', error)
    
    // ✅ Gestion intelligente des erreurs
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return NextResponse.json(
        { error: 'API quota dépassé. Attendez quelques minutes avant de réessayer.' },
        { status: 429 }
      )
    }

    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}