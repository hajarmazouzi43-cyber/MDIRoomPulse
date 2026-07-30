// app/api/notify-sms/route.ts
import { NextResponse } from 'next/server'
import { notifyRoomStatusChange } from '@/lib/notifications'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export async function POST(request: Request) {
  try {
    const { roomId, status } = await request.json()

    if (!roomId) {
      return NextResponse.json({ success: false, error: 'roomId requis' }, { status: 400 })
    }

    // Client service-role : cette route tourne côté serveur, sans session
    // utilisateur/cookies. Sans ce client, les policies RLS sur `subscriptions`
    // et `profiles` bloqueraient silencieusement la lecture des abonnés.
    const supabase = createServiceRoleClient()

    const result = await notifyRoomStatusChange(roomId, status || 'free', supabase)

    return NextResponse.json({
      success: true,
      smsCount: result.sms,
      emailCount: result.email,
      message: `${result.sms} SMS envoyés, ${result.email} emails envoyés`
    })
  } catch (error) {
    console.error('Erreur API SMS:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'envoi'
      },
      { status: 500 }
    )
  }
}
