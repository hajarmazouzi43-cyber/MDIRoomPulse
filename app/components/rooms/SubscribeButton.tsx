'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface SubscribeButtonProps {
  roomId: string
  roomName: string
}

export default function SubscribeButton({ roomId, roomName }: SubscribeButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [whatsappEnabled, setWhatsappEnabled] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function checkSubscription() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      setUserId(user.id)

      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('room_id', roomId)
        .single()

      if (data) {
        setIsSubscribed(true)
        setEmailEnabled(data.email_enabled || false)
        setWhatsappEnabled(data.whatsapp_enabled || false)
      }
    }

    checkSubscription()
  }, [roomId])

  const handleSubscribe = async () => {
    if (!userId) {
      toast.error('Connecte-toi pour t\'abonner')
      return
    }

    setLoading(true)
    try {
      // Vérifier si WhatsApp est activé et si le numéro existe
      if (whatsappEnabled) {
        const { data: existingNumber } = await supabase
          .from('whatsapp_numbers')
          .select('phone_number')
          .eq('user_id', userId)
          .single()

        if (!existingNumber && !phoneNumber) {
          toast.error('Veuillez entrer votre numéro WhatsApp')
          setLoading(false)
          return
        }

        // Sauvegarder le numéro
        if (phoneNumber && !existingNumber) {
          await supabase
            .from('whatsapp_numbers')
            .insert({ user_id: userId, phone_number: phoneNumber })
        }
      }

      if (isSubscribed) {
        // Se désabonner
        const { error } = await supabase
          .from('subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('room_id', roomId)

        if (error) throw error
        setIsSubscribed(false)
        toast.success(`Désabonné de "${roomName}"`)
      } else {
        // S'abonner
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            room_id: roomId,
            email_enabled: emailEnabled,
            whatsapp_enabled: whatsappEnabled
          })

        if (error) throw error
        setIsSubscribed(true)
        toast.success(`Abonné à "${roomName}" !`)
      }
      setOpen(false)
    } catch (error: any) {
      toast.error(error.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={`w-full ${isSubscribed ? 'bg-red-500 hover:bg-red-600' : 'bg-[#0056B3] hover:bg-[#00449E]'}`}
      >
        {isSubscribed ? 'Gérer mon abonnement' : ' S\'abonner'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isSubscribed ? 'Gérer l\'abonnement' : 'S\'abonner à'} "{roomName}"
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Email */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="email"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="email"> Notifications par email</Label>
            </div>

            {/* WhatsApp */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="whatsapp"
                checked={whatsappEnabled}
                onChange={(e) => setWhatsappEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <Label htmlFor="whatsapp">💬 Notifications WhatsApp</Label>
            </div>

            {whatsappEnabled && (
              <div>
                <Label htmlFor="phone">Numéro WhatsApp</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+212 6XX XX XX XX"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Format : +212 6XX XX XX XX</p>
              </div>
            )}

            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Chargement...' : isSubscribed ? 'Mettre à jour' : 'S\'abonner'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}