import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { to, subject, html, from } = await request.json()

    const fromEmail = 'MDI RoomPulse <onboarding@resend.dev>'
    const replyTo = from || 'mdi-roompulse@mdi.com'

    console.log('📧 Sending from:', fromEmail)
    console.log('📧 Reply-to:', replyTo)
    console.log('📧 To:', to)

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      // ✅ Supprime reply_to et utilise replyTo dans le body du mail
      to: to,
      subject: subject,
      html: html,
      headers: {
        'Reply-To': replyTo  // ✅ Utilise les headers pour le reply-to
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