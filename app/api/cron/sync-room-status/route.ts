// app/api/cron/sync-room-status/route.ts
//
// Synchronise le statut "occupée" des salles avec les réservations
// planifiées via le calendrier — jusqu'ici, seule "l'occupation directe"
// (bouton sur la liste des salles) mettait à jour `rooms.is_occupied`.
// Une réservation faite à l'avance ne mettait jamais la salle "occupée"
// au moment venu, et elle ne redevenait jamais "libre" à la fin non plus.
//
// Appelée par le même cron GitHub Actions que les rappels de réservation.

import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

function getCasablancaParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    timeStr: `${get('hour')}:${get('minute')}:${get('second')}`,
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

  // 1. Réservations actives MAINTENANT (aujourd'hui, en cours) → occuper la salle
  const { data: activeBookings, error: activeError } = await supabase
    .from('bookings')
    .select('room_id, user_id, end_time, title')
    .eq('booking_date', todayStr)
    .eq('status', 'confirmed')
    .lte('start_time', nowTime)
    .gt('end_time', nowTime)

  if (activeError) {
    console.error('❌ Erreur récupération réservations actives (sync-room-status):', activeError)
    return NextResponse.json({ error: activeError.message }, { status: 500 })
  }

  let occupied = 0
  for (const booking of activeBookings || []) {
    const occupiedUntil = new Date(`${todayStr}T${booking.end_time}`)
    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        is_occupied: true,
        occupied_by: booking.user_id,
        occupied_until: occupiedUntil.toISOString(),
        current_people: 1
      })
      .eq('id', booking.room_id)
      .eq('is_occupied', false) // ne touche pas une salle déjà occupée (évite d'écraser une occupation directe en cours)

    if (!updateError) occupied++
  }

  // 2. Salles occupées dont l'heure de fin (`occupied_until`) est dépassée → libérer
  const { data: staleRooms, error: staleError } = await supabase
    .from('rooms')
    .select('id')
    .eq('is_occupied', true)
    .lt('occupied_until', now.toISOString())

  if (staleError) {
    console.error('❌ Erreur récupération salles à libérer (sync-room-status):', staleError)
    return NextResponse.json({ error: staleError.message }, { status: 500 })
  }

  let freed = 0
  for (const room of staleRooms || []) {
    const { error: freeError } = await supabase
      .from('rooms')
      .update({ is_occupied: false, occupied_by: null, occupied_until: null, current_people: 0 })
      .eq('id', room.id)

    if (!freeError) freed++
  }

  return NextResponse.json({ success: true, occupied, freed })
}