'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ConsentPage() {
  const [emailConsent, setEmailConsent] = useState(false)
  const [whatsappConsent, setWhatsappConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('email_consent_granted, whatsapp_consent_granted, phone')
        .eq('id', user.id)
        .single()

      if (profile) {
        setEmailConsent(profile.email_consent_granted || false)
        setWhatsappConsent(profile.whatsapp_consent_granted || false)
        setPhoneNumber(profile.phone || '')
      }
    }
    checkUser()
  }, [router, supabase])

  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return 'unknown'
    }
  }

  const handleSubmit = async () => {
    if (!emailConsent && !whatsappConsent) {
      toast.warning('Please grant at least one consent to continue')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          email_consent_granted: emailConsent,
          whatsapp_consent_granted: whatsappConsent,
          consent_granted_at: new Date().toISOString(),
          consent_updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      const ip = await getClientIP()
      const userAgent = navigator.userAgent

      if (emailConsent) {
        await supabase
          .from('consent_history')
          .insert({
            user_id: user.id,
            consent_type: 'email',
            granted: true,
            ip_address: ip,
            user_agent: userAgent
          })
      }

      if (whatsappConsent) {
        await supabase
          .from('consent_history')
          .insert({
            user_id: user.id,
            consent_type: 'whatsapp',
            granted: true,
            ip_address: ip,
            user_agent: userAgent
          })
      }

      toast.success('Thank you! Your preferences have been saved.')
      router.push('/dashboard')
    } catch (error: any) {
      toast.error(error.message || 'Error saving preferences')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-[#0056B3] text-center">
             Notification Preferences
          </CardTitle>
          <CardDescription className="text-center">
            Please grant consent to receive notifications
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-800">Why we need your consent?</h3>
            <p className="text-sm text-blue-700 mt-1">
              MDI RoomPulse sends notifications when rooms become available.
              We respect your privacy and will only send notifications you explicitly agree to receive.
            </p>
          </div>

          {phoneNumber && (
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <p className="text-sm text-green-700">
                 WhatsApp number saved: <strong>{phoneNumber}</strong>
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id="email-consent"
                checked={emailConsent}
                onCheckedChange={(checked) => setEmailConsent(!!checked)}
                className="mt-1"
              />
              <div>
                <Label htmlFor="email-consent" className="font-semibold">
                   Email Notifications
                </Label>
                <p className="text-sm text-gray-500">
                  Receive notifications by email when rooms become available
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  We'll only send you relevant room availability updates
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
              <Checkbox
                id="whatsapp-consent"
                checked={whatsappConsent}
                onCheckedChange={(checked) => setWhatsappConsent(!!checked)}
                className="mt-1"
              />
              <div>
                <Label htmlFor="whatsapp-consent" className="font-semibold">
                  💬 WhatsApp Notifications
                </Label>
                <p className="text-sm text-gray-500">
                  Receive notifications by WhatsApp when rooms become available
                </p>
                {!phoneNumber && (
                  <p className="text-xs text-red-500 mt-1">
                     You haven't added a WhatsApp number yet. You can add it in your profile.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border text-sm text-gray-600">
            <p className="font-medium"> What you agree to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Receive notifications about room availability</li>
              <li>Receive alerts when all rooms are occupied</li>
              <li>Custom notifications for subscribed rooms</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              You can change these preferences anytime in your Profile settings.
              We never share your data with third parties.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={loading || (!emailConsent && !whatsappConsent)}
            className="w-full bg-[#0056B3] hover:bg-[#00449E]"
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </Button>
          {!emailConsent && !whatsappConsent && (
            <p className="text-xs text-red-500 text-center">
              You must grant at least one consent to continue
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}