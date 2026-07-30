// app/api/subscribe-sms/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { roomId, phone } = await request.json()
    const supabase = await createClient()

    // Vérifier si l'utilisateur est déjà abonné
    const { data: existing } = await supabase
      .from('room_subscribers')
      .select('id')
      .eq('room_id', roomId)
      .eq('phone', phone)
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Vous êtes déjà abonné à cette salle'
      })
    }

    // Ajouter l'abonnement
    const { error } = await supabase
      .from('room_subscribers')
      .insert({
        room_id: roomId,
        phone: phone,
        created_at: new Date().toISOString()
      })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur abonnement SMS:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur technique' 
      },
      { status: 500 }
    )
  }
}