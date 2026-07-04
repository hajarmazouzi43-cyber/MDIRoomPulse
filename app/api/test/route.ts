import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend('re_L5ZzhL5s_Kfy98zL7TM6BTJmWjw9tVDFt')

export async function GET() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'MDI RoomPulse <onboarding@resend.dev>',
      to: 'hajarmazouzi43@gmail.com',
      subject: 'Test direct',
      html: '<h1>🎉 Test réussi !</h1>',
    })

    if (error) {
      console.error('❌ Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Resend success:', data)
    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('❌ Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}