// app/api/notify-new-signup/route.ts
//
// Notifie tous les admins qu'un nouvel utilisateur vient de s'inscrire.
// Contrairement à l'ancienne version (dans login/page.tsx, côté navigateur),
// cette route tourne côté serveur avec la clé service_role : elle n'est donc
// jamais bloquée par les policies RLS, même si l'utilisateur qui vient de
// s'inscrire n'a pas encore de session active (cas normal juste après un
// signUp avec confirmation d'email requise).

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

let transporter: nodemailer.Transporter | null = null
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
  }
  return transporter
}

export async function POST(request: Request) {
  try {
    const { userEmail, userId } = await request.json()

    if (!userEmail || !userId) {
      return NextResponse.json({ error: 'userEmail / userId manquant' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // 1. Créer/mettre à jour le profil — fait ici avec service_role car,
    // juste après un signUp avec confirmation d'email requise,
    // l'utilisateur n'a pas encore de session active : un upsert fait
    // depuis le navigateur avec la clé anon serait bloqué par RLS.
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: userEmail,
        role: 'user',
        is_verified: false,
        email_consent_granted: false,
        whatsapp_consent_granted: false
      })

    if (profileError) {
      console.error('❌ Erreur création profil (service_role):', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error('❌ GMAIL_USER / GMAIL_APP_PASSWORD manquant dans .env.local')
      return NextResponse.json({ error: 'Email admin non configuré sur le serveur', profileCreated: true }, { status: 500 })
    }

    // 2. Notifier les admins
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin')

    if (adminError) {
      console.error('❌ Erreur récupération admins (service_role):', adminError)
      return NextResponse.json({ error: adminError.message }, { status: 500 })
    }

    const adminEmails = (admins || []).map(a => a.email).filter(Boolean)

    if (adminEmails.length === 0) {
      console.log('⚠️ Aucun admin trouvé pour la notification de nouvel utilisateur')
      return NextResponse.json({ success: true, notified: 0, warning: 'Aucun admin trouvé' })
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #7C5CFC; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px; }
            .button { background: #7C5CFC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
            .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🆕 Nouvel utilisateur</h1></div>
            <div class="content">
              <p>Bonjour Admin,</p>
              <p>Un nouvel utilisateur vient de créer un compte sur <strong>MDI RoomPulse</strong>.</p>
              <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="margin: 0;"><strong>📧 Email :</strong> ${userEmail}</p>
                <p style="margin: 5px 0 0;"><strong>🆔 ID :</strong> ${userId.slice(0, 8)}...</p>
              </div>
              <p>Veuillez vérifier ce compte pour lui permettre d'accéder à l'application.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${APP_URL}/admin" class="button">👑 Vérifier les utilisateurs</a>
              </p>
            </div>
            <div class="footer"><p>MDI RoomPulse - Gestion des salles</p></div>
          </div>
        </body>
      </html>
    `

    let notified = 0
    for (const adminEmail of adminEmails) {
      try {
        await getTransporter().sendMail({
          from: `MDI RoomPulse <${GMAIL_USER}>`,
          to: adminEmail,
          subject: '🆕 Nouvel utilisateur en attente de vérification',
          html,
        })
        notified++
        console.log(`✅ Admin notifié: ${adminEmail}`)
      } catch (err: any) {
        console.error(`❌ Échec envoi à ${adminEmail}:`, err.message)
      }
    }

    return NextResponse.json({ success: true, notified, totalAdmins: adminEmails.length })
  } catch (error: any) {
    console.error('❌ Server error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}