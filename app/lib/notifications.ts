import { createClient } from '@/lib/supabase/client'

interface NotificationResult {
  success: boolean
  error?: string
}

/**
 * Envoyer une notification par email (via API Route)
 * avec l'email de la salle comme expéditeur
 */
export async function sendEmailNotification(
  userId: string,
  roomName: string,
  roomEmail: string,  // ← NOUVEAU : email de la salle
  status: 'occupied' | 'free',
  currentPeople?: number,
  maxPeople?: number
): Promise<NotificationResult> {
  const supabase = createClient()

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email, email_consent_granted')
      .eq('id', userId)
      .single()

    console.log('Profile query result:', { profile, error })

    if (error || !profile?.email || !profile.email_consent_granted) {
      return { success: false, error: 'User has not given email consent' }
    }

    const statusText = status === 'occupied' ? 'occupied' : 'available'
    const subject = status === 'occupied' 
      ? `Room "${roomName}" is occupied (${currentPeople || 0}/${maxPeople || 0})`
      : `Room "${roomName}" is now available`

    console.log(`Sending email from ${roomEmail} to ${profile.email}...`)

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: roomEmail,  // ← Email de la salle
        to: profile.email,
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { 
                  background: ${status === 'occupied' ? '#EF4444' : '#10B981'}; 
                  color: white; 
                  padding: 20px; 
                  text-align: center; 
                  border-radius: 8px 8px 0 0;
                }
                .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
                .button { 
                  background: #0056B3; 
                  color: white; 
                  padding: 12px 24px; 
                  text-decoration: none; 
                  border-radius: 6px; 
                  display: inline-block;
                }
                .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>${status === 'occupied' ? 'Room Occupied' : 'Room Available'}</h1>
                </div>
                <div class="content">
                  <h2>${status === 'occupied' ? 'Room is currently occupied' : 'Good news'}</h2>
                  <p>The room <strong>"${roomName}"</strong> is now <strong>${statusText}</strong>.</p>
                  ${currentPeople !== undefined && maxPeople !== undefined ? (
                    `<p>People: ${currentPeople} / ${maxPeople}</p>`
                  ) : ''}
                  <p style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/rooms" class="button">
                      View All Rooms
                    </a>
                  </p>
                </div>
                <div class="footer">
                  <p>MDI RoomPulse - You are receiving this because you subscribed to ${roomName}.</p>
                  <p>To unsubscribe, go to your <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/profile">profile settings</a>.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to send email')
    }

    await supabase.from('notification_logs').insert({
      user_id: userId,
      room_id: null,
      type: 'email',
      status: 'sent',
    })

    console.log(`Email sent from ${roomEmail} to ${profile.email}`)
    return { success: true }
  } catch (error: any) {
    console.error('Email error:', error)
    await supabase.from('notification_logs').insert({
      user_id: userId,
      room_id: null,
      type: 'email',
      status: 'failed',
    })
    return { success: false, error: error.message }
  }
}

/**
 * Envoyer une notification WhatsApp (SIMULATION)
 */
export async function sendWhatsAppNotification(
  userId: string,
  roomName: string,
  status: 'occupied' | 'free'
): Promise<NotificationResult> {
  const supabase = createClient()

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, whatsapp_consent_granted')
      .eq('id', userId)
      .single()

    if (!profile?.phone || !profile.whatsapp_consent_granted) {
      return { success: false, error: 'User has not given WhatsApp consent' }
    }

    const statusEmoji = status === 'occupied' ? '🔴' : '🟢'
    const statusText = status === 'occupied' ? 'occupied' : 'available'
    
    console.log(`[SIMULATION] WhatsApp to ${profile.phone}: ${statusEmoji} "${roomName}" is ${statusText}`)

    await supabase.from('notification_logs').insert({
      user_id: userId,
      room_id: null,
      type: 'whatsapp',
      status: 'sent',
    })

    return { success: true }
  } catch (error: any) {
    console.error('WhatsApp error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Notifier tous les abonnés d'une salle
 */
export async function notifyRoomStatusChange(roomId: string, status: 'occupied' | 'free') {
  console.log('notifyRoomStatusChange called for room:', roomId, 'status:', status)
  
  const supabase = createClient()

  // 1. Récupérer la salle AVEC room_email, current_people, max_people
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('name, room_email, current_people, max_people')  // ← Ajout room_email
    .eq('id', roomId)
    .single()

  console.log('Room found:', room)
  console.log('Room error:', roomError)

  if (!room) {
    console.error('Room not found:', roomId)
    return { email: 0, whatsapp: 0 }
  }

  // 2. Récupérer les abonnés
  const { data: subscriptions, error: subError } = await supabase
    .from('subscriptions')
    .select('user_id, email_enabled, whatsapp_enabled')
    .eq('room_id', roomId)

  console.log('Subscriptions found:', subscriptions?.length || 0)
  console.log('Subscriptions data:', subscriptions)
  console.log('Subscriptions error:', subError)

  if (!subscriptions || subscriptions.length === 0) {
    console.log(`No subscribers for room: ${room.name}`)
    return { email: 0, whatsapp: 0 }
  }

  // 3. Pour chaque abonné, envoyer la notification
  let emailCount = 0
  let whatsappCount = 0

  for (const sub of subscriptions) {
    console.log(`Processing subscription for user ${sub.user_id}`)
    
    if (sub.email_enabled) {
      console.log(`Sending email to user ${sub.user_id}`)
      const result = await sendEmailNotification(
        sub.user_id,
        room.name,
        room.room_email || 'mdi-roompulse@mdi.com',  // ← Email de la salle
        status,
        room.current_people,
        room.max_people
      )
      if (result.success) {
        emailCount++
        console.log(`Email sent to user ${sub.user_id}`)
      } else {
        console.log(`Email failed for user ${sub.user_id}:`, result.error)
      }
    }

    if (sub.whatsapp_enabled) {
      console.log(`Sending WhatsApp to user ${sub.user_id}`)
      const result = await sendWhatsAppNotification(sub.user_id, room.name, status)
      if (result.success) {
        whatsappCount++
        console.log(`WhatsApp sent to user ${sub.user_id}`)
      } else {
        console.log(`WhatsApp failed for user ${sub.user_id}:`, result.error)
      }
    }
  }

  console.log(`Notified ${emailCount} by email, ${whatsappCount} by WhatsApp`)
  return { email: emailCount, whatsapp: whatsappCount }
}

/**
 * Demander "Qui est libre ?" → Toutes les salles répondent
 */
export async function askWhoIsFree(userId: string, userName: string = 'Someone') {
  const supabase = createClient()

  console.log(`${userName} asked "Who is free?"`)

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .order('name')

  if (!rooms || rooms.length === 0) {
    return { success: false, error: 'No rooms found' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, phone, email_consent_granted, whatsapp_consent_granted')
    .eq('id', userId)
    .single()

  const freeRooms = rooms.filter(r => !r.is_occupied && r.category !== 'detente')
  const occupiedRooms = rooms.filter(r => r.is_occupied)
  const lounge = rooms.find(r => r.category === 'detente')

  let responseMessage = `${userName} asked "Who is free?"\n\n`

  if (freeRooms.length > 0) {
    responseMessage += `FREE ROOMS (${freeRooms.length}):\n`
    freeRooms.forEach(r => {
      responseMessage += `  - ${r.name} - ${r.location || 'N/A'}\n`
    })
  } else {
    responseMessage += `No free rooms available\n`
  }

  if (occupiedRooms.length > 0) {
    responseMessage += `\nOCCUPIED ROOMS (${occupiedRooms.length}):\n`
    occupiedRooms.forEach(r => {
      responseMessage += `  - ${r.name} - ${r.location || 'N/A'}\n`
    })
  }

  if (lounge) {
    responseMessage += `\nLOUNGE AREA: Always available for relaxation`
  }

  if (profile?.email_consent_granted && profile?.email) {
    console.log(`Sending status summary to ${profile.email}`)
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: profile.email,
          subject: `Room Status Summary`,
          html: `
            <h2>Room Status Summary</h2>
            <pre style="white-space: pre-wrap; font-family: monospace;">${responseMessage}</pre>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/rooms">View all rooms</a></p>
          `,
        }),
      })

      if (response.ok) {
        console.log(`Status summary sent to ${profile.email}`)
      }
    } catch (error) {
      console.error('Failed to send status summary:', error)
    }
  }

  if (profile?.whatsapp_consent_granted && profile?.phone) {
    console.log(`[SIMULATION] WhatsApp to ${profile.phone}:\n${responseMessage}`)
  }

  return {
    success: true,
    free: freeRooms.length,
    occupied: occupiedRooms.length,
    total: rooms.length,
    response: responseMessage
  }
}