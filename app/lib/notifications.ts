// lib/notifications.ts
import { createClient } from '@/lib/supabase/client'
import { sendSMS } from '@/lib/sms/textbelt'
import { getLocalDateString } from '@/lib/dateUtils'

type AnySupabaseClient = ReturnType<typeof createClient>

interface NotificationResult {
  success: boolean
  error?: string
  emailCount?: number
  smsCount?: number
}

const PRIMARY = '#2554E0'

/**
 * Récupère les réservations "confirmed" d'une salle qui sont EN COURS ou À VENIR
 */
// lib/notifications.ts - Version corrigée

export async function getActiveOrUpcomingBookings(
  supabase: AnySupabaseClient,
  roomId: string,
  select: string = 'id, user_id, title, booking_date, start_time, end_time'
): Promise<any[]> {
  const now = new Date()
  const todayStr = getLocalDateString(now)

  // ✅ Supprimer la condition sur 'status' si la colonne n'existe pas
  let query = supabase
    .from('bookings')
    .select(select)
    .eq('room_id', roomId)
    .gte('booking_date', todayStr)

  // Vérifier si la colonne status existe avant de l'utiliser
  const { data: columnExists } = await supabase
    .from('bookings')
    .select('status')
    .limit(1)
    .maybeSingle()

  if (columnExists !== undefined) {
    query = query.eq('status', 'confirmed')
  }

  const { data, error } = await query

  if (error) {
    console.error('❌ Erreur requête bookings:', error)
    return []
  }

  return (data || []).filter((b: any) => {
    if (b.booking_date > todayStr) return true
    const endDateTime = new Date(`${b.booking_date}T${b.end_time}:00`)
    return endDateTime > now
  })
}

function shouldNotify(
  status: 'occupied' | 'free' | 'reminder' | 'change' | 'cancel' | 'out_of_service' | 'back_in_service',
  room: any,
  userPreferences: any
): boolean {
  return true
}

function buildEmailHtml(header: string, body: string, status: string, currentPeople?: number, maxPeople?: number) {
  const accent =
    status === 'occupied' ? '#EF4444'
    : status === 'free' || status === 'back_in_service' ? '#10B981'
    : status === 'out_of_service' ? '#F59E0B'
    : PRIMARY

  const icon =
    status === 'occupied' ? '🔴'
    : status === 'free' ? '🟢'
    : status === 'reminder' ? '⏰'
    : status === 'change' ? '🔄'
    : status === 'cancel' ? '❌'
    : status === 'out_of_service' ? '🚫'
    : status === 'back_in_service' ? '✅'
    : '📣'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin:0; padding:0; background-color:#F1F4FA; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F4FA; padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(20,30,60,0.08);">
                <tr>
                  <td style="background-color:${accent}; background-image:linear-gradient(135deg, ${accent}, ${PRIMARY}); padding:36px 32px; text-align:center;">
                    <div style="width:64px; height:64px; line-height:64px; background-color:rgba(255,255,255,0.18); border-radius:50%; margin:0 auto 16px; font-size:30px;">
                      ${icon}
                    </div>
                    <p style="margin:0; color:rgba(255,255,255,0.75); font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase;">
                      MDI RoomPulse
                    </p>
                    <h1 style="margin:6px 0 0; color:#ffffff; font-size:22px; font-weight:700;">
                      ${header}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 20px; color:#1E293B; font-size:16px; line-height:1.6;">
                      ${body}
                    </p>
                    ${currentPeople !== undefined && maxPeople !== undefined ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px; background-color:#F8FAFC; border-radius:10px; width:100%;">
                      <tr>
                        <td style="padding:14px 18px; color:#475569; font-size:14px; font-weight:600;">
                          👥 Occupation actuelle
                        </td>
                        <td style="padding:14px 18px; text-align:right; color:${accent}; font-size:16px; font-weight:700;">
                          ${currentPeople} / ${maxPeople}
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td style="border-radius:10px; background-color:${PRIMARY};">
                          <a href="${appUrl}/rooms" style="display:inline-block; padding:13px 32px; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none;">
                            Voir les salles →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 32px; background-color:#F8FAFC; border-top:1px solid #EEF2F7; text-align:center;">
                    <p style="margin:0; color:#94A3B8; font-size:12px; line-height:1.6;">
                      Vous recevez ce message via MDI RoomPulse.<br />
                      <a href="${appUrl}/profile" style="color:${PRIMARY}; text-decoration:none;">Gérer mes notifications</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}

export async function sendEmailNotification(
  userId: string,
  roomName: string,
  roomEmail: string,
  status: 'occupied' | 'free' | 'reminder' | 'change' | 'cancel' | 'out_of_service' | 'back_in_service',
  currentPeople?: number,
  maxPeople?: number,
  customMessage?: string,
  client?: AnySupabaseClient
): Promise<NotificationResult> {
  const supabase = client || createClient()

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email, email_consent_granted')
      .eq('id', userId)
      .single()

    if (error || !profile?.email || !profile.email_consent_granted) {
      return { success: false, error: 'User has not given email consent' }
    }

    let subject = ''
    let header = ''
    let body = ''

    switch (status) {
      case 'occupied':
        subject = `🔴 ${roomName} est occupée`
        header = 'Salle occupée'
        body = `La salle <strong>${roomName}</strong> est actuellement occupée.`
        break
      case 'free':
        subject = `🟢 ${roomName} est maintenant disponible`
        header = 'Salle disponible'
        body = `La salle <strong>${roomName}</strong> est maintenant disponible !`
        break
      case 'reminder':
        subject = `⏰ Rappel: ${roomName} dans 15 minutes`
        header = 'Rappel de réservation'
        body = customMessage || `Votre réservation pour <strong>${roomName}</strong> commence dans 15 minutes.`
        break
      case 'change':
        subject = `🔄 Changement de réservation: ${roomName}`
        header = 'Réservation modifiée'
        body = customMessage || `La réservation pour <strong>${roomName}</strong> a été modifiée.`
        break
      case 'cancel':
        subject = `❌ Réservation annulée: ${roomName}`
        header = 'Réservation annulée'
        body = customMessage || `La réservation pour <strong>${roomName}</strong> a été annulée.`
        break
      case 'out_of_service':
        subject = `🚫 ${roomName} est hors service`
        header = 'Salle hors service'
        body = customMessage || `La salle <strong>${roomName}</strong> est temporairement hors service.`
        break
      case 'back_in_service':
        subject = `✅ ${roomName} est de nouveau disponible`
        header = 'Salle de nouveau disponible'
        body = `La salle <strong>${roomName}</strong> est de nouveau disponible !`
        break
      default:
        subject = `Notification: ${roomName}`
        header = 'Notification'
        body = `Mise à jour concernant <strong>${roomName}</strong>.`
    }

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: roomEmail || undefined,
        to: profile.email,
        subject,
        html: buildEmailHtml(header, body, status, currentPeople, maxPeople),
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
      status: result.simulated ? 'simulated' : 'sent',
    })

    console.log(result.simulated ? `⏭️ Email simulé pour ${profile.email}` : `✅ Email sent to ${profile.email}`)
    return { success: true }
  } catch (error: any) {
    console.error('❌ Email error:', error)
    return { success: false, error: error.message }
  }
}

export async function sendSMSNotification(
  userId: string,
  roomName: string,
  status: 'occupied' | 'free' | 'reminder' | 'change' | 'cancel' | 'out_of_service' | 'back_in_service',
  customMessage?: string,
  client?: AnySupabaseClient
): Promise<NotificationResult> {
  const supabase = client || createClient()

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, sms_consent_granted')
      .eq('id', userId)
      .single()

    if (!profile?.phone || !profile.sms_consent_granted) {
      return { success: false, error: 'User has not given SMS consent' }
    }

    const statusEmoji = status === 'occupied' ? '🔴' : status === 'free' ? '🟢' : status === 'reminder' ? '⏰' : status === 'change' ? '🔄' : status === 'cancel' ? '❌' : status === 'out_of_service' ? '🚫' : '✅'

    const message = customMessage || `${statusEmoji} RoomPulse: "${roomName}" - ${getStatusText(status)}`

    const result = await sendSMS(profile.phone, message)

    if (!result.success) {
      throw new Error(result.error || 'Failed to send SMS')
    }

    await supabase.from('notification_logs').insert({
      user_id: userId,
      room_id: null,
      type: 'sms',
      status: 'sent',
    })

    console.log(`✅ SMS sent to ${profile.phone}`)
    return { success: true }
  } catch (error: any) {
    console.error('❌ SMS error:', error)
    return { success: false, error: error.message }
  }
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    occupied: 'est occupée',
    free: 'est disponible',
    reminder: 'rappel dans 15 min',
    change: 'a été modifiée',
    cancel: 'a été annulée',
    out_of_service: 'est hors service',
    back_in_service: 'est de nouveau disponible'
  }
  return map[status] || status
}

export async function notifyRoomStatusChange(
  roomId: string,
  status: 'occupied' | 'free' | 'out_of_service' | 'back_in_service',
  client?: AnySupabaseClient
) {
  console.log('notifyRoomStatusChange called for room:', roomId, 'status:', status)

  const supabase = client || createClient()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('name, room_email, current_people, max_people, is_occupied')
    .eq('id', roomId)
    .single()

  if (!room) {
    console.error('Room not found:', roomId)
    return { email: 0, sms: 0 }
  }

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('user_id, email_enabled, sms_enabled, notify_free, notify_reminder, notify_changes')
    .eq('room_id', roomId)

  if (!subscriptions || subscriptions.length === 0) {
    console.log(`No subscribers for room: ${room.name}`)
    return { email: 0, sms: 0 }
  }

  const activeBookings = await getActiveOrUpcomingBookings(supabase, roomId, 'user_id')
  const usersWithBooking = new Set(activeBookings.map((b) => b.user_id))

  let emailCount = 0
  let smsCount = 0

  for (const sub of subscriptions) {
    const hasBooking = usersWithBooking.has(sub.user_id)

    const shouldSend = shouldNotify(status, { was_occupied: room.is_occupied }, {
      ...sub,
      has_booking: hasBooking
    })

    if (!shouldSend) {
      console.log(`Skip notification for user ${sub.user_id} (not useful)`)
      continue
    }

    let customMessage = ''

    if (status === 'out_of_service' && hasBooking) {
      customMessage = `🚫 ${room.name} est hors service. Votre réservation est annulée.`
    }
    if (status === 'back_in_service' && hasBooking) {
      customMessage = `✅ ${room.name} est de nouveau disponible. Vous pouvez réserver.`
    }

    if (sub.email_enabled) {
      const result = await sendEmailNotification(
        sub.user_id,
        room.name,
        room.room_email || undefined,
        status,
        room.current_people,
        room.max_people,
        customMessage,
        supabase
      )
      if (result.success) emailCount++
    }

    if (sub.sms_enabled) {
      const result = await sendSMSNotification(sub.user_id, room.name, status, customMessage, supabase)
      if (result.success) smsCount++
    }
  }

  console.log(`✅ Notified ${emailCount} by email, ${smsCount} by SMS`)
  return { email: emailCount, sms: smsCount }
}

export async function notifyBookingReminder(bookingId: string, client?: AnySupabaseClient) {
  const supabase = client || createClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, rooms(name), profiles(email, phone, sms_consent_granted)')
    .eq('id', bookingId)
    .single()

  if (error || !booking) {
    console.error('Booking not found:', bookingId)
    return { email: 0, sms: 0 }
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('notify_reminder')
    .eq('user_id', booking.user_id)
    .eq('room_id', booking.room_id)
    .maybeSingle()

  // Par défaut, un utilisateur qui réserve une salle veut être rappelé,
  // même s'il n'a pas explicitement "suivi" (subscribe) cette salle —
  // ne pas bloquer le rappel juste parce qu'aucune ligne `subscriptions`
  // n'existe pour ce couple utilisateur/salle.
  const reminderEnabled = sub ? sub.notify_reminder !== false : true

  if (!reminderEnabled) {
    console.log(`User ${booking.user_id} has disabled reminders`)
    return { email: 0, sms: 0 }
  }

  const roomName = booking.rooms?.name || 'Salle'
  const customMessage = `⏰ RoomPulse: Votre réservation pour "${roomName}" (${booking.start_time}) commence bientôt !`

  let emailCount = 0
  let smsCount = 0

  if (booking.profiles?.email) {
    const result = await sendEmailNotification(
      booking.user_id, roomName, undefined as any, 'reminder', undefined, undefined, customMessage, supabase
    )
    if (result.success) emailCount++
  }

  if (booking.profiles?.phone && booking.profiles?.sms_consent_granted) {
    const result = await sendSMSNotification(booking.user_id, roomName, 'reminder', customMessage, supabase)
    if (result.success) smsCount++
  }

  return { email: emailCount, sms: smsCount }
}

export async function notifyBookingChange(
  bookingId: string,
  changeType: 'time' | 'room' | 'cancel',
  oldData?: any,
  client?: AnySupabaseClient
) {
  const supabase = client || createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('*, rooms(name), profiles(email, phone, sms_consent_granted)')
    .eq('id', bookingId)
    .single()

  if (!booking) return { email: 0, sms: 0 }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('notify_changes')
    .eq('user_id', booking.user_id)
    .eq('room_id', booking.room_id)
    .single()

  if (!sub || !sub.notify_changes) {
    console.log(`User ${booking.user_id} has disabled change notifications`)
    return { email: 0, sms: 0 }
  }

  const roomName = booking.rooms?.name || 'Salle'
  let customMessage = ''

  switch (changeType) {
    case 'time':
      customMessage = `🔄 RoomPulse: ${roomName} - Nouvel horaire: ${booking.start_time}`
      break
    case 'room':
      customMessage = `🔄 RoomPulse: Salle changée: ${oldData?.room_name} → ${roomName}`
      break
    case 'cancel':
      customMessage = `❌ RoomPulse: ${roomName} - Réservation annulée`
      break
  }

  let emailCount = 0
  let smsCount = 0

  if (booking.profiles?.email) {
    const result = await sendEmailNotification(
      booking.user_id, roomName, undefined as any, 'change', undefined, undefined, customMessage, supabase
    )
    if (result.success) emailCount++
  }

  if (booking.profiles?.phone && booking.profiles?.sms_consent_granted) {
    const result = await sendSMSNotification(booking.user_id, roomName, 'change', customMessage, supabase)
    if (result.success) smsCount++
  }

  return { email: emailCount, sms: smsCount }
}

export async function notifyRoomOutOfService(roomId: string, reason: string, client?: AnySupabaseClient) {
  const supabase = client || createClient()

  const activeBookings = await getActiveOrUpcomingBookings(supabase, roomId)

  if (activeBookings.length === 0) {
    console.log('No active bookings for this room')
    return { email: 0, sms: 0 }
  }

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('name')
    .eq('id', roomId)
    .single()

  if (roomError) {
    console.error('❌ Erreur requête rooms (notifyRoomOutOfService):', roomError)
  }

  const now = new Date()
  let emailCount = 0
  let smsCount = 0

  for (const booking of activeBookings) {
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('email_enabled, sms_enabled')
      .eq('user_id', booking.user_id)
      .eq('room_id', roomId)
      .maybeSingle()

    if (subError) {
      console.error('❌ Erreur requête subscriptions (notifyRoomOutOfService):', subError)
    }

    const startDateTime = new Date(`${booking.booking_date}T${booking.start_time}:00`)
    const wasInProgress = startDateTime <= now

    const customMessage = wasInProgress
      ? `🚫 ${room?.name || 'Salle'} vient d'être mise hors service et votre occupation en cours a été interrompue. Raison : ${reason}`
      : `🚫 ${room?.name || 'Salle'} est hors service. Votre réservation du ${booking.booking_date} à ${booking.start_time} est annulée. Raison : ${reason}`

    const emailEnabled = sub ? sub.email_enabled : true
    const smsEnabled = sub ? sub.sms_enabled : false

    if (emailEnabled) {
      const result = await sendEmailNotification(
        booking.user_id,
        room?.name || 'Salle',
        undefined as any,
        'out_of_service',
        undefined,
        undefined,
        customMessage,
        supabase
      )
      if (result.success) emailCount++
      else console.error('❌ Échec envoi email (notifyRoomOutOfService):', result.error)
    }

    if (smsEnabled) {
      const result = await sendSMSNotification(
        booking.user_id,
        room?.name || 'Salle',
        'out_of_service',
        customMessage,
        supabase
      )
      if (result.success) smsCount++
      else console.error('❌ Échec envoi SMS (notifyRoomOutOfService):', result.error)
    }

    const { error: cancelError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)

    if (cancelError) {
      console.error('❌ Erreur annulation réservation (notifyRoomOutOfService):', cancelError)
    }
  }

  return { email: emailCount, sms: smsCount }
}

export async function askWhoIsFree(userId: string, userName: string = 'Quelqu\'un', client?: AnySupabaseClient) {
  const supabase = client || createClient()

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .order('name')

  if (!rooms || rooms.length === 0) {
    return { success: false, error: 'Aucune salle trouvée' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, phone, email_consent_granted, sms_consent_granted')
    .eq('id', userId)
    .single()

  const freeRooms = rooms.filter((r) => !r.is_occupied && r.category !== 'detente' && !r.is_out_of_service)
  const occupiedRooms = rooms.filter((r) => r.is_occupied)
  const lounge = rooms.find((r) => r.category === 'detente')

  let responseMessage = `${userName} a demandé "Qui est libre ?"\n\n`

  if (freeRooms.length > 0) {
    responseMessage += `🏠 SALLES LIBRES (${freeRooms.length}):\n`
    freeRooms.forEach((r) => {
      responseMessage += `  - ${r.name} - ${r.location || 'N/A'}\n`
    })
  } else {
    responseMessage += `❌ Aucune salle libre disponible\n`
  }

  if (occupiedRooms.length > 0) {
    responseMessage += `\n🔴 SALLES OCCUPÉES (${occupiedRooms.length}):\n`
    occupiedRooms.forEach((r) => {
      responseMessage += `  - ${r.name} - ${r.location || 'N/A'}\n`
    })
  }

  if (lounge) {
    responseMessage += `\n🛋️ ESPACE DÉTENTE: Toujours disponible`
  }

  if (profile?.email_consent_granted && profile?.email) {
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: profile.email,
          subject: `📊 Résumé des salles - RoomPulse`,
          html: buildEmailHtml(
            'Résumé des salles',
            `<pre style="white-space:pre-wrap; font-family:inherit; margin:0; font-size:14px; color:#334155;">${responseMessage}</pre>`,
            'default'
          ),
        }),
      })
    } catch (error) {
      console.error('Erreur envoi résumé:', error)
    }
  }

  if (profile?.sms_consent_granted && profile?.phone) {
    const smsMessage = `🔍 RoomPulse: ${freeRooms.length} salles libres, ${occupiedRooms.length} occupées.${freeRooms.length > 0 ? ` Disponibles: ${freeRooms.map((r) => r.name).join(', ')}` : ''}`
    await sendSMS(profile.phone, smsMessage)
  }

  return {
    success: true,
    free: freeRooms.length,
    occupied: occupiedRooms.length,
    total: rooms.length,
    response: responseMessage
  }
}