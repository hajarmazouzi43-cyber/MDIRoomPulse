// scripts/set-admin.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Utilisez la clé service_role
)

async function setAdmin() {
  const email = 'votre@email.com' // Remplacez par votre email
  
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('email', email)
    .select()
  
  if (error) {
    console.error('❌ Erreur:', error)
  } else {
    console.log('✅ Admin mis à jour:', data)
  }
}

setAdmin()