import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ✅ Code secret admin
const ADMIN_SECRET_CODE = 'ADMINatrsd2647'

export async function DELETE(request: Request) {
  try {
    const { code } = await request.json()

    // 1. Vérifier le code secret
    if (!code || code !== ADMIN_SECRET_CODE) {
      console.log('Invalid admin code attempted')
      return NextResponse.json({ error: 'Invalid admin code' }, { status: 403 })
    }

    const supabase = await createClient()
    
    // 2. Vérifier l'authentification
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Supprimer l'historique
    const { error: deleteError } = await supabase
      .from('room_history')
      .delete()
      .not('id', 'is', null)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'History cleared successfully by admin' 
    })
  } catch (error: any) {
    console.error('Error clearing history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to clear history' },
      { status: 500 }
    )
  }
}