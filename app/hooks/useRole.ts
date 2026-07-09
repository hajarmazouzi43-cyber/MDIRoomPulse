import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRole() {
  const [role, setRole] = useState<'admin' | 'user' | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setRole(profile?.role || 'user')
      setLoading(false)
    }

    fetchRole()
  }, [])

  return { role, loading, isAdmin: role === 'admin' }
}