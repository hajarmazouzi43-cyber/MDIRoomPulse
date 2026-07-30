// components/SubscribeButton.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Phone, Mail, Bell, Clock, RefreshCw, Sparkles } from 'lucide-react'

interface SubscribeButtonProps {
  roomId: string
  roomName: string
}

export default function SubscribeButton({ roomId, roomName }: SubscribeButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [hasPhone, setHasPhone] = useState(false)
  const [preferences, setPreferences] = useState({
    notify_free: true,
    notify_reminder: true,
    notify_changes: true,
    email_enabled: true,
    sms_enabled: false
  })
  const supabase = createClient()

  useEffect(() => {
    async function checkSubscription() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      setUserId(user.id)

      // Récupérer le profil pour le numéro de téléphone
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, sms_consent_granted')
        .eq('id', user.id)
        .single()

      if (profile?.phone) {
        setPhone(profile.phone)
        setHasPhone(true)
        setPreferences(prev => ({
          ...prev,
          sms_enabled: profile.sms_consent_granted || false
        }))
      }

      // Récupérer l'abonnement
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('room_id', roomId)
        .single()

      if (data) {
        setIsSubscribed(true)
        setPreferences({
          notify_free: data.notify_free !== false,
          notify_reminder: data.notify_reminder !== false,
          notify_changes: data.notify_changes !== false,
          email_enabled: data.email_enabled !== false,
          sms_enabled: data.sms_enabled || false
        })
      }
    }

    checkSubscription()
  }, [roomId, supabase])

  const handleSubscribe = async () => {
    if (!userId) {
      toast.error('Veuillez vous connecter pour vous abonner')
      return
    }

    // Vérifier si SMS activé mais pas de numéro
    if (preferences.sms_enabled && !hasPhone) {
      toast.error('Veuillez ajouter un numéro de téléphone dans votre profil')
      return
    }

    setLoading(true)
    try {
      // Mettre à jour le profil avec le numéro de téléphone
      if (phone && hasPhone) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ 
            phone: phone,
            sms_consent_granted: preferences.sms_enabled
          })
          .eq('id', userId)

        if (profileError) throw profileError
      }

      if (isSubscribed) {
        // Mettre à jour l'abonnement existant
        const { error } = await supabase
          .from('subscriptions')
          .update({
            notify_free: preferences.notify_free,
            notify_reminder: preferences.notify_reminder,
            notify_changes: preferences.notify_changes,
            email_enabled: preferences.email_enabled,
            sms_enabled: preferences.sms_enabled
          })
          .eq('user_id', userId)
          .eq('room_id', roomId)

        if (error) throw error
        toast.success(`✅ Préférences mises à jour pour "${roomName}"`)
        setOpen(false)
      } else {
        // Créer un nouvel abonnement
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            room_id: roomId,
            notify_free: preferences.notify_free,
            notify_reminder: preferences.notify_reminder,
            notify_changes: preferences.notify_changes,
            email_enabled: preferences.email_enabled,
            sms_enabled: preferences.sms_enabled
          })

        if (error) throw error
        setIsSubscribed(true)
        toast.success(`✅ Abonné à "${roomName}"`)
        setOpen(false)

        // Envoyer un SMS de confirmation si activé
        if (preferences.sms_enabled && phone) {
          try {
            await fetch('/api/notify-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                roomId, 
                status: 'free',
                test: true
              }),
            })
          } catch (error) {
            console.error('Erreur SMS de confirmation:', error)
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    if (!userId) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', roomId)

      if (error) throw error
      setIsSubscribed(false)
      setOpen(false)
      toast.success(`✅ Désabonné de "${roomName}"`)
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du désabonnement')
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
        {isSubscribed ? '🔔 Gérer l\'abonnement' : '🔔 S\'abonner'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isSubscribed ? 'Gérer l\'abonnement' : `S'abonner à "${roomName}"`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">Je souhaite être notifié quand :</p>
            
            {/* Types de notifications */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify_free"
                checked={preferences.notify_free}
                onCheckedChange={(checked) => setPreferences({...preferences, notify_free: !!checked})}
              />
              <Label htmlFor="notify_free" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-green-500" />
                La salle devient disponible
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify_reminder"
                checked={preferences.notify_reminder}
                onCheckedChange={(checked) => setPreferences({...preferences, notify_reminder: !!checked})}
              />
              <Label htmlFor="notify_reminder" className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Rappel 15 min avant ma réservation
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify_changes"
                checked={preferences.notify_changes}
                onCheckedChange={(checked) => setPreferences({...preferences, notify_changes: !!checked})}
              />
              <Label htmlFor="notify_changes" className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-orange-500" />
                Changement d'horaire ou de salle
              </Label>
            </div>

            {/* Méthodes de notification */}
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-2">Méthodes de notification :</p>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email_enabled"
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) => setPreferences({...preferences, email_enabled: !!checked})}
                />
                <Label htmlFor="email_enabled" className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" />
                  Email
                </Label>
              </div>

              <div className="flex items-center space-x-2 mt-2">
                <Checkbox
                  id="sms_enabled"
                  checked={preferences.sms_enabled}
                  onCheckedChange={(checked) => setPreferences({...preferences, sms_enabled: !!checked})}
                />
                <Label htmlFor="sms_enabled" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-green-500" />
                  SMS
                </Label>
              </div>

              {/* Champ numéro de téléphone */}
              {preferences.sms_enabled && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <Label htmlFor="phone" className="text-sm">
                    Numéro de téléphone (format international)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+212 6XX XX XX XX"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      setHasPhone(true)
                    }}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Exemple: +212 612345678
                  </p>
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="space-y-2">
              <Button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full bg-[#0056B3] hover:bg-[#00449E]"
              >
                {loading ? 'Chargement...' : isSubscribed ? 'Mettre à jour' : "S'abonner"}
              </Button>

              {isSubscribed && (
                <Button
                  variant="destructive"
                  onClick={handleUnsubscribe}
                  disabled={loading}
                  className="w-full"
                >
                  Se désabonner
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}