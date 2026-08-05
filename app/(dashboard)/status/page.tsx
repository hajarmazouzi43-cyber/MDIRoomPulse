'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { askWhoIsFree } from '@/lib/notifications'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function StatusPage() {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()
  const { t } = useLanguage()

  // ✅ Fonction helper pour les traductions avec variables
  const tWithVars = (key: string, vars?: Record<string, string | number>): string => {
    let message = t(key)
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        message = message.replace(new RegExp(`{{${k}}}`, 'g'), String(v))
      }
    }
    return message
  }

  useEffect(() => {
    getUser()
  }, [])

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
  }

  const handleAsk = async () => {
    if (!user) {
      toast.error(t('status.pleaseSignIn'))
      return
    }

    setLoading(true)
    setResponse(null)

    try {
      const result = await askWhoIsFree(user.id, user.email?.split('@')[0] || 'User')
      
      if (result.success) {
        setResponse(result.response || '')
        // ✅ Correction : ajouter des valeurs par défaut pour éviter undefined
        toast.success(tWithVars('status.success', { 
          free: result.free || 0, 
          occupied: result.occupied || 0 
        }))
      } else {
        toast.error(t('status.error'))
      }
    } catch (error) {
      toast.error(t('status.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-[#0056B3] mb-6">
          {t('status.title')}
        </h1>

        <Card className="mb-6">
          <CardContent className="p-6">
            <p className="text-gray-600 mb-4">
              {t('status.description')}
            </p>
            <Button
              onClick={handleAsk}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loading ? t('status.asking') : t('status.askButton')}
            </Button>
          </CardContent>
        </Card>

        {response && (
          <Card className="bg-gray-50 border-2 border-gray-200">
            <CardContent className="p-6">
              <h2 className="font-semibold text-gray-700 mb-3">{t('status.responses')}</h2>
              <pre className="whitespace-pre-wrap text-sm font-mono bg-white p-4 rounded-lg border">
                {response}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}