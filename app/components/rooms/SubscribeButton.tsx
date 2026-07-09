'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface SubscribeButtonProps {
  roomId: string
  roomName: string
}

export default function SubscribeButton({ roomId, roomName }: SubscribeButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [preferences, setPreferences] = useState({
    notify_free: true,
    notify_reminder: true,
    notify_changes: true,
    email_enabled: true,
    whatsapp_enabled: false
  })
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
        setPreferences({
          notify_free: data.notify_free !== false,
          notify_reminder: data.notify_reminder !== false,
          notify_changes: data.notify_changes !== false,
          email_enabled: data.email_enabled !== false,
          whatsapp_enabled: data.whatsapp_enabled || false
        })
      }
    }

    checkSubscription()
  }, [roomId, supabase])

  const handleSubscribe = async () => {
    if (!userId) {
      toast.error('Please sign in to subscribe')
      return
    }

    setLoading(true)
    try {
      if (isSubscribed) {
        const { error } = await supabase
          .from('subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('room_id', roomId)

        if (error) throw error
        setIsSubscribed(false)
        toast.success(`Unsubscribed from "${roomName}"`)
        setOpen(false)
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            room_id: roomId,
            notify_free: preferences.notify_free,
            notify_reminder: preferences.notify_reminder,
            notify_changes: preferences.notify_changes,
            email_enabled: preferences.email_enabled,
            whatsapp_enabled: preferences.whatsapp_enabled
          })

        if (error) throw error
        setIsSubscribed(true)
        toast.success(`Subscribed to "${roomName}"`)
        setOpen(false)
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred')
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
        {isSubscribed ? '🔔 Manage Preferences' : '🔔 Subscribe'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isSubscribed ? 'Manage Subscription' : 'Subscribe to'} "{roomName}"
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">I want to be notified when:</p>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify_free"
                checked={preferences.notify_free}
                onCheckedChange={(checked) => setPreferences({...preferences, notify_free: !!checked})}
              />
              <Label htmlFor="notify_free">📢 The room becomes available</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify_reminder"
                checked={preferences.notify_reminder}
                onCheckedChange={(checked) => setPreferences({...preferences, notify_reminder: !!checked})}
              />
              <Label htmlFor="notify_reminder">⏰ Reminder 15 min before my booking</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify_changes"
                checked={preferences.notify_changes}
                onCheckedChange={(checked) => setPreferences({...preferences, notify_changes: !!checked})}
              />
              <Label htmlFor="notify_changes">🔄 Time or room change</Label>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-2">Notification methods:</p>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email_enabled"
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) => setPreferences({...preferences, email_enabled: !!checked})}
                />
                <Label htmlFor="email_enabled">📧 Email</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="whatsapp_enabled"
                  checked={preferences.whatsapp_enabled}
                  onCheckedChange={(checked) => setPreferences({...preferences, whatsapp_enabled: !!checked})}
                />
                <Label htmlFor="whatsapp_enabled">💬 WhatsApp</Label>
              </div>
            </div>

            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Loading...' : isSubscribed ? 'Update Preferences' : 'Subscribe'}
            </Button>

            {isSubscribed && (
              <Button
                variant="destructive"
                onClick={async () => {
                  const { error } = await supabase
                    .from('subscriptions')
                    .delete()
                    .eq('user_id', userId)
                    .eq('room_id', roomId)
                  if (error) {
                    toast.error('Error unsubscribing')
                  } else {
                    setIsSubscribed(false)
                    setOpen(false)
                    toast.success(`Unsubscribed from "${roomName}"`)
                  }
                }}
                className="w-full"
              >
                Unsubscribe
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}