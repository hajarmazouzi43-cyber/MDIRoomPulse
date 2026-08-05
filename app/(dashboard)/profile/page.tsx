'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Mail, MessageCircle, ShieldCheck, User, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function ProfilePage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [emailConsent, setEmailConsent] = useState(false)
  const [whatsappConsent, setWhatsappConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isVerified, setIsVerified] = useState(false)
  const supabase = createClient()
  const { t } = useLanguage()

  // ✅ Fonction helper pour les traductions avec variables (si besoin)
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
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, email_consent_granted, whatsapp_consent_granted, is_verified')
          .eq('id', user.id)
          .single()

        if (profile) {
          setPhoneNumber(profile.phone || '')
          setEmailConsent(profile.email_consent_granted || false)
          setWhatsappConsent(profile.whatsapp_consent_granted || false)
          setIsVerified(profile.is_verified || false)
        }
      }
    }
    loadProfile()
  }, [supabase])

  const formatPhoneNumber = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('0')) {
      cleaned = '212' + cleaned.slice(1)
    }
    if (!cleaned.startsWith('212')) {
      cleaned = '212' + cleaned
    }
    return '+' + cleaned
  }

  const handleSave = async () => {
    if (!user) return

    setLoading(true)
    try {
      const formattedPhone = phoneNumber ? formatPhoneNumber(phoneNumber) : null

      const { error } = await supabase
        .from('profiles')
        .update({
          phone: formattedPhone,
          email_consent_granted: emailConsent,
          whatsapp_consent_granted: whatsappConsent,
          consent_updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success(t('profile.saveSuccess'))
    } catch (error: any) {
      toast.error(error.message || t('profile.saveError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full py-8 px-4 bg-[#F5F7FA] min-h-full">
      <div className="max-w-md mx-auto space-y-6">
        <Card className="border-[#E7E5EC] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-[#1A1A2E]">
              <span className="flex items-center gap-2">
                <User className="w-5 h-5 text-[#7C5CFC]" />
                {t('profile.title')}
              </span>
              {isVerified ? (
                <span className="text-xs bg-green-50 text-green-600 px-3 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> {t('profile.verified')}
                </span>
              ) : (
                <span className="text-xs bg-amber-50 text-amber-600 px-3 py-1 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {t('profile.pendingVerification')}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isVerified && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {t('profile.accountPending')}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[#6B6B7A]">{t('profile.email')}</Label>
              <p className="text-sm font-medium text-[#1A1A2E]">{user?.email}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[#6B6B7A]">{t('profile.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={t('profile.phonePlaceholder')}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="border-[#DAD7E3] focus-visible:ring-[#7C5CFC]"
              />
              <p className="text-xs text-[#6B6B7A]">
                {t('profile.phoneFormat')}
              </p>
            </div>

            <div className="border-t border-[#E7E5EC] pt-4">
              <h3 className="font-semibold mb-3 text-[#1A1A2E]">{t('profile.notificationPreferences')}</h3>

              <div className="flex items-start space-x-3 p-3 bg-[#F5F7FA] border border-[#E7E5EC] rounded-lg">
                <Checkbox
                  id="email-consent"
                  checked={emailConsent}
                  onCheckedChange={(checked) => setEmailConsent(!!checked)}
                  className="mt-1 data-[state=checked]:bg-[#14B8A6] data-[state=checked]:border-[#14B8A6]"
                />
                <div>
                  <Label htmlFor="email-consent" className="font-medium text-[#1A1A2E] flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[#14B8A6]" />
                    {t('profile.emailNotifications')}
                  </Label>
                  <p className="text-xs text-[#6B6B7A] mt-0.5">
                    {t('profile.emailDesc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-[#F5F7FA] border border-[#E7E5EC] rounded-lg mt-2">
                <Checkbox
                  id="whatsapp-consent"
                  checked={whatsappConsent}
                  onCheckedChange={(checked) => setWhatsappConsent(!!checked)}
                  className="mt-1 data-[state=checked]:bg-[#7C5CFC] data-[state=checked]:border-[#7C5CFC]"
                />
                <div>
                  <Label htmlFor="whatsapp-consent" className="font-medium text-[#1A1A2E] flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-[#7C5CFC]" />
                    {t('profile.whatsappNotifications')}
                  </Label>
                  <p className="text-xs text-[#6B6B7A] mt-0.5">
                    {t('profile.whatsappDesc')}
                  </p>
                  {whatsappConsent && !phoneNumber && (
                    <p className="text-xs text-[#E2624F] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {t('profile.addPhone')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-[#7C5CFC] hover:bg-[#6242D6]"
            >
              {loading ? t('profile.saving') : t('profile.save')}
            </Button>
          </CardContent>
        </Card>

        <div className="p-4 bg-[#F3F0FF] rounded-lg border border-[#DDD5FA]">
          <h3 className="font-semibold text-[#5B3FD6] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            {t('profile.privacy')}
          </h3>
          <p className="text-sm text-[#5B3FD6]/80 mt-1">
            {t('profile.privacyDesc')}
          </p>
          <p className="text-xs text-[#5B3FD6]/70 mt-2">
            {t('profile.consentHistory')}
          </p>
        </div>
      </div>
    </div>
  )
}