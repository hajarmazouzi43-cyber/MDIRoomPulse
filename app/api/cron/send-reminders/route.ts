// app/api/cron/send-reminders/route.ts
//
// Vérifie les réservations qui commencent dans les 5 prochaines minutes et
// envoie un rappel (email + SMS) à leur propriétaire, une seule fois par
// réservation (grâce à la colonne `reminder_sent`).
//
// Cette route est faite pour être appelée régulièrement par un service de
// cron EXTERNE (ex: cron-job.org, gratuit), toutes les 1 à 5 minutes — le
// plan gratuit de Vercel ("Hobby") limite les Cron Jobs internes à 1
// exécution par jour, ce qui est trop rare pour un rappel "5 minutes avant".
//
// Sécurité : protégée par un secret passé en query param, pour éviter que
// n'importe qui puisse déclencher l'envoi de rappels.

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { notifyBookingReminder } from '@/lib/notifications'

// Les serveurs Vercel tournent en UTC, alors que `start_time` est stocké
// tel que saisi par l'utilisateur dans SON fuseau horaire (Maroc,
// Africa/Casablanca). On calcule donc explicitement "maintenant" dans ce
// fuseau précis, peu importe le fuseau du serveur qui exécute ce code —
// sinon la comparaison d'heures est décalée du fuseau du serveur (souvent
// 1h ou plus), et la fenêtre "5 minutes avant" ne correspond jamais à la
// bonne heure réelle.
function getCasablancaParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    timeStr: `${get('hour')}:${get('minute')}`,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const now = new Date()
  const { dateStr: todayStr, timeStr: nowTime } = getCasablancaParts(now)

  const inFifteenMin = new Date(now.getTime() + 15 * 60000)
  const { timeStr: inFifteenMinTime } = getCasablancaParts(inFifteenMin)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, user_id, room_id, title, booking_date, start_time, end_time, rooms(name)')
    .eq('booking_date', todayStr)
    .eq('status', 'confirmed')
    .eq('reminder_sent', false)
    .gte('start_time', nowTime)
    .lte('start_time', inFifteenMinTime)

  if (error) {
    console.error('❌ Erreur récupération réservations (cron reminders):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    // Debug temporaire : affiche les valeurs calculées + les réservations
    // du jour (sans les filtres d'heure), pour voir exactement où ça bloque.
    const { data: todaysBookings } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, status, reminder_sent')
      .eq('booking_date', todayStr)

    return NextResponse.json({
      success: true,
      sent: 0,
      debug: {
        todayStr,
        nowTime,
        inFifteenMinTime,
        todaysBookings
      }
    })
  }

  let sent = 0
  for (const booking of bookings) {
    try {
      const result = await notifyBookingReminder(booking.id, supabase)
      // On ne marque comme "envoyé" que si un email ou un SMS est
      // réellement parti — sinon, un échec silencieux (comme un consentement
      // manquant) serait marqué à tort comme traité, et plus jamais retenté.
      if (result.email > 0 || result.sms > 0) {
        await supabase
          .from('bookings')
          .update({ reminder_sent: true })
          .eq('id', booking.id)
        sent++
        console.log(`✅ Rappel envoyé pour la réservation ${booking.id}`)
      } else {
        console.error(`⚠️ Aucun envoi réel pour la réservation ${booking.id} (email/SMS = 0) — non marqué comme envoyé`)
      }
    } catch (err: any) {
      console.error(`❌ Échec rappel pour la réservation ${booking.id}:`, err.message)
    }
  }

  return NextResponse.json({ success: true, sent, checked: bookings.length })
}