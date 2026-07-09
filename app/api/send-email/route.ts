import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const RESEND_API_KEY = process.env.RESEND_API_KEY

if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY is not set in environment variables')
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

export async function POST(request: Request) {
  try {
    if (!resend) {
      console.error('❌ Resend is not configured')
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      )
    }

    const { to, subject, html, from } = await request.json()

    const fromEmail = 'MDI RoomPulse <onboarding@resend.dev>'
    const replyTo = from || 'mdi-roompulse@mdi.com'

    console.log('📧 Sending from:', fromEmail)
    console.log('📧 Reply-to:', replyTo)
    console.log('📧 To:', to)

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: to,
      subject: subject,
      html: html,
      headers: {
        'Reply-To': replyTo
      }
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Email sent:', data)
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}