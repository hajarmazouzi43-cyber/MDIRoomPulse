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
  roomEmail: string,
  status: 'occupied' | 'free' | 'reminder' | 'change' | 'cancel',
  currentPeople?: number,
  maxPeople?: number,
  customMessage?: string
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

    let subject = ''
    let header = ''
    let body = ''
    let buttonText = 'View All Rooms'

    switch (status) {
      case 'occupied':
        subject = `🔴 Room "${roomName}" is occupied`
        header = 'Room Occupied'
        body = `The room "${roomName}" is currently occupied.`
        break
      case 'free':
        subject = `🟢 Room "${roomName}" is now available`
        header = 'Room Available'
        body = `The room "${roomName}" is now available.`
        buttonText = 'Book Now'
        break
      case 'reminder':
        subject = `⏰ Reminder: "${roomName}" in 15 minutes`
        header = 'Booking Reminder'
        body = customMessage || `Your booking for "${roomName}" starts in 15 minutes.`
        buttonText = 'View Booking'
        break
      case 'change':
        subject = `🔄 Booking change: "${roomName}"`
        header = 'Booking Updated'
        body = customMessage || `The booking for "${roomName}" has been updated.`
        buttonText = 'View Details'
        break
      case 'cancel':
        subject = `❌ Booking cancelled: "${roomName}"`
        header = 'Booking Cancelled'
        body = customMessage || `The booking for "${roomName}" has been cancelled.`
        buttonText = 'View Rooms'
        break
      default:
        subject = `Room "${roomName}" notification`
        header = 'Room Notification'
        body = `Update about "${roomName}".`
    }

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: roomEmail || 'mdi-roompulse@mdi.com',
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
                  background: ${status === 'occupied' ? '#EF4444' : status === 'free' ? '#10B981' : '#0056B3'}; 
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
                  <h1>${header}</h1>
                </div>
                <div class="content">
                  <h2>${body}</h2>
                  ${currentPeople !== undefined && maxPeople !== undefined ? (
                    `<p>👥 People: ${currentPeople} / ${maxPeople}</p>`
                  ) : ''}
                  <p style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/rooms" class="button">
                      ${buttonText}
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

    console.log(`✅ Email sent from ${roomEmail} to ${profile.email}`)
    return { success: true }
  } catch (error: any) {
    console.error('❌ Email error:', error)
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
 * Envoyer une notification WhatsApp
 */
export async function sendWhatsAppNotification(
  userId: string,
  roomName: string,
  status: 'occupied' | 'free' | 'reminder' | 'change' | 'cancel',
  customMessage?: string
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

    const statusEmoji = status === 'occupied' ? '🔴' : status === 'free' ? '🟢' : status === 'reminder' ? '⏰' : status === 'change' ? '🔄' : '❌'
    const statusText = status === 'occupied' ? 'occupied' : status === 'free' ? 'available' : status === 'reminder' ? 'reminder' : status === 'change' ? 'updated' : 'cancelled'
    
    const message = customMessage || `${statusEmoji} Room "${roomName}" is ${statusText}!\n\nView all rooms: ${process.env.NEXT_PUBLIC_APP_URL}/rooms`

    console.log(`[WhatsApp] to ${profile.phone}: ${message}`)

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
 * Notifier les abonnés d'une salle (avec préférences)
 */
export async function notifyRoomStatusChange(roomId: string, status: 'occupied' | 'free') {
  console.log('notifyRoomStatusChange called for room:', roomId, 'status:', status)
  
  const supabase = createClient()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('name, room_email, current_people, max_people')
    .eq('id', roomId)
    .single()

  console.log('Room found:', room)
  console.log('Room error:', roomError)

  if (!room) {
    console.error('Room not found:', roomId)
    return { email: 0, whatsapp: 0 }
  }

  // Récupérer les abonnés avec préférences
  const { data: subscriptions, error: subError } = await supabase
    .from('subscriptions')
    .select('user_id, email_enabled, whatsapp_enabled, notify_free')
    .eq('room_id', roomId)

  console.log('Subscriptions found:', subscriptions?.length || 0)

  if (!subscriptions || subscriptions.length === 0) {
    console.log(`No subscribers for room: ${room.name}`)
    return { email: 0, whatsapp: 0 }
  }

  let emailCount = 0
  let whatsappCount = 0

  for (const sub of subscriptions) {
    // Vérifier si l'utilisateur veut être notifié pour les salles libres
    if (status === 'free' && sub.notify_free === false) {
      console.log(`User ${sub.user_id} has disabled free room notifications`)
      continue
    }

    if (sub.email_enabled) {
      const result = await sendEmailNotification(
        sub.user_id,
        room.name,
        room.room_email || 'mdi-roompulse@mdi.com',
        status,
        room.current_people,
        room.max_people
      )
      if (result.success) emailCount++
    }

    if (sub.whatsapp_enabled) {
      const result = await sendWhatsAppNotification(sub.user_id, room.name, status)
      if (result.success) whatsappCount++
    }
  }

  console.log(`Notified ${emailCount} by email, ${whatsappCount} by WhatsApp`)
  return { email: emailCount, whatsapp: whatsappCount }
}

/**
 * Notifier un utilisateur pour un rappel de réservation
 */
export async function notifyBookingReminder(bookingId: string) {
  const supabase = createClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, rooms(name), profiles(email)')
    .eq('id', bookingId)
    .single()

  if (error || !booking) {
    console.error('Booking not found:', bookingId)
    return { email: 0, whatsapp: 0 }
  }

  // Vérifier si l'utilisateur veut des rappels
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('notify_reminder')
    .eq('user_id', booking.user_id)
    .eq('room_id', booking.room_id)
    .single()

  if (!sub || !sub.notify_reminder) {
    console.log(`User ${booking.user_id} has disabled reminders`)
    return { email: 0, whatsapp: 0 }
  }

  const roomName = booking.rooms?.name || 'Salle'
  const customMessage = `⏰ Votre réservation pour "${roomName}" commence dans 15 min !`

  let emailCount = 0
  let whatsappCount = 0

  if (booking.profiles?.email) {
    const result = await sendEmailNotification(
      booking.user_id,
      roomName,
      'mdi-roompulse@mdi.com',
      'reminder',
      undefined,
      undefined,
      customMessage
    )
    if (result.success) emailCount++
  }

  const result = await sendWhatsAppNotification(booking.user_id, roomName, 'reminder', customMessage)
  if (result.success) whatsappCount++

  return { email: emailCount, whatsapp: whatsappCount }
}

/**
 * Notifier un changement de réservation
 */
export async function notifyBookingChange(bookingId: string, changeType: 'time' | 'room' | 'cancel', oldData?: any) {
  const supabase = createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, rooms(name), profiles(email)')
    .eq('id', bookingId)
    .single()

  if (!booking) return { email: 0, whatsapp: 0 }

  // Vérifier si l'utilisateur veut des notifications de changement
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('notify_changes')
    .eq('user_id', booking.user_id)
    .eq('room_id', booking.room_id)
    .single()

  if (!sub || !sub.notify_changes) {
    console.log(`User ${booking.user_id} has disabled change notifications`)
    return { email: 0, whatsapp: 0 }
  }

  const roomName = booking.rooms?.name || 'Salle'
  let customMessage = ''

  switch (changeType) {
    case 'time':
      customMessage = `🔄 La réservation pour "${roomName}" a changé : ${oldData?.start_time} → ${booking.start_time}`
      break
    case 'room':
      customMessage = `🔄 La salle a changé : ${oldData?.room_name} → ${roomName}`
      break
    case 'cancel':
      customMessage = `❌ La réservation pour "${roomName}" a été annulée`
      break
  }

  let emailCount = 0
  let whatsappCount = 0

  if (booking.profiles?.email) {
    const result = await sendEmailNotification(
      booking.user_id,
      roomName,
      'mdi-roompulse@mdi.com',
      'change',
      undefined,
      undefined,
      customMessage
    )
    if (result.success) emailCount++
  }

  const result = await sendWhatsAppNotification(booking.user_id, roomName, 'change', customMessage)
  if (result.success) whatsappCount++

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
        headers: { 'Content-Type': 'application/json' },
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