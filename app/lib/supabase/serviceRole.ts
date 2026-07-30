// lib/supabase/serviceRole.ts
//
// Client Supabase à utiliser UNIQUEMENT côté serveur (jamais dans un composant
// 'use client', jamais exposé au navigateur). Contrairement au client standard
// (@/lib/supabase/client), celui-ci utilise la clé service_role qui contourne
// les policies RLS — nécessaire pour les routes API déclenchées côté serveur
// (comme /api/notify-sms) qui n'ont pas de session utilisateur/cookies pour
// s'authentifier auprès de Supabase.
//
// Récupérez la clé dans Supabase Dashboard → Project Settings → API →
// "service_role" (secret), et ajoutez-la dans .env.local :
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...
// ⚠️ Ne JAMAIS préfixer cette variable par NEXT_PUBLIC_ — elle donnerait un
// accès total à la base de données à quiconque inspecte le code client.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local — requis pour les notifications déclenchées côté serveur. Voir Supabase Dashboard → Settings → API.'
    )
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
