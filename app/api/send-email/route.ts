// app/api/send-email/route.ts
import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'

// Gmail SMTP — voir /api/notify-new-signup pour le contexte complet.
const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const DEFAULT_FROM = `MDI RoomPulse <${GMAIL_USER}>`

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
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error('❌ GMAIL_USER ou GMAIL_APP_PASSWORD manquant dans .env.local')
      return NextResponse.json(
        { error: 'GMAIL_USER / GMAIL_APP_PASSWORD non configurés sur le serveur' },
        { status: 500 }
      )
    }

    const { to, subject, html } = await request.json()

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Champs requis manquants: to, subject, html' },
        { status: 400 }
      )
    }

    const cleanTo = to.trim().toLowerCase()

    console.log(`📤 Tentative d'envoi (Gmail SMTP) — from: "${DEFAULT_FROM}", to: "${cleanTo}"`)

    const info = await getTransporter().sendMail({
      from: DEFAULT_FROM,
      to: cleanTo,
      subject,
      html,
    })

    console.log('✅ Email sent:', info.messageId)
    return NextResponse.json({ success: true, data: { id: info.messageId } })
  } catch (error: any) {
    console.error('❌ Gmail SMTP error complet:', {
      message: error.message,
      code: error.code,
      response: error.response,
    })
    return NextResponse.json(
      { error: error.message || 'Erreur serveur', code: error.code },
      { status: 500 }
    )
  }
}