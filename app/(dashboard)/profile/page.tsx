'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

export default function ProfilePage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [emailConsent, setEmailConsent] = useState(false)
  const [whatsappConsent, setWhatsappConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, email_consent_granted, whatsapp_consent_granted')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setPhoneNumber(profile.phone || '')
          setEmailConsent(profile.email_consent_granted || false)
          setWhatsappConsent(profile.whatsapp_consent_granted || false)
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
      
      toast.success('Profile updated successfully!')
    } catch (error: any) {
      toast.error(error.message || 'Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle> Profile Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="06 12 34 56 78"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Format: 06 12 34 56 78 (Moroccan number)
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Notification Preferences</h3>
              
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <Checkbox
                  id="email-consent"
                  checked={emailConsent}
                  onCheckedChange={(checked) => setEmailConsent(!!checked)}
                  className="mt-1"
                />
                <div>
                  <Label htmlFor="email-consent" className="font-medium">
                     Email Notifications
                  </Label>
                  <p className="text-xs text-gray-500">
                    Receive room availability updates by email
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg mt-2">
                <Checkbox
                  id="whatsapp-consent"
                  checked={whatsappConsent}
                  onCheckedChange={(checked) => setWhatsappConsent(!!checked)}
                  className="mt-1"
                />
                <div>
                  <Label htmlFor="whatsapp-consent" className="font-medium">
                    💬 WhatsApp Notifications
                  </Label>
                  <p className="text-xs text-gray-500">
                    Receive room availability updates on WhatsApp
                  </p>
                  {whatsappConsent && !phoneNumber && (
                    <p className="text-xs text-red-500 mt-1">
                       Please add your WhatsApp number above
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-[#0056B3] hover:bg-[#00449E]"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-blue-800"> Your Privacy</h3>
          <p className="text-sm text-blue-700 mt-1">
            We respect your privacy. You can change your consent preferences anytime.
            We never share your data with third parties.
          </p>
          <p className="text-xs text-blue-600 mt-2">
             Consent history is logged for compliance purposes
          </p>
        </div>
      </div>
    </div>
  )
}