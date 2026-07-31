// app/api/admin/verify-user/route.ts
//
// Confirme réellement l'email d'un utilisateur dans Supabase Auth
// (auth.users.email_confirmed_at), contrairement au bouton "vérifier"
// de l'admin qui ne touchait avant que la colonne `profiles.is_verified`
// (un champ cosmétique de l'app) — laissant l'utilisateur toujours
// bloqué à la connexion si l'email de confirmation initial n'était
// jamais arrivé (mailer Supabase par défaut, très limité).
//
// Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env.local, car seule la clé
// service_role peut appeler l'API auth.admin.

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId manquant' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })

    if (error) {
      console.error('❌ Erreur confirmation auth.users:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`✅ Email confirmé dans auth.users pour l'utilisateur ${userId}`)
    return NextResponse.json({ success: true, user: data.user })
  } catch (error: any) {
    console.error('❌ Server error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}