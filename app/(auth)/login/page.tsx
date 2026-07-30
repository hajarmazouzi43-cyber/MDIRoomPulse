'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const isSignUpFromUrl = searchParams.get('signup') === 'true'
  const signUpMode = isSignUpFromUrl || isSignUp

  // ✅ Fonction pour notifier l'admin d'une nouvelle inscription
  const notifyAdminOfNewUser = async (userEmail: string, userId: string) => {
    try {
      // Récupérer l'email de l'admin
      const { data: admins } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', 'admin')

      if (!admins || admins.length === 0) {
        console.log('Aucun admin trouvé pour la notification')
        return
      }

      const adminEmails = admins.map(a => a.email).filter(Boolean)

      if (adminEmails.length === 0) return

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

      for (const adminEmail of adminEmails) {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: adminEmail,
            subject: '🆕 Nouvel utilisateur en attente de vérification',
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #7C5CFC; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { padding: 30px; background: #f9fafb; border-radius: 0 0 8px 8px; }
                    .button { background: #7C5CFC; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
                    .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>🆕 Nouvel utilisateur</h1>
                    </div>
                    <div class="content">
                      <p>Bonjour Admin,</p>
                      <p>Un nouvel utilisateur vient de créer un compte sur <strong>MDI RoomPulse</strong>.</p>
                      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <p style="margin: 0;"><strong>📧 Email :</strong> ${userEmail}</p>
                        <p style="margin: 5px 0 0;"><strong>🆔 ID :</strong> ${userId.slice(0, 8)}...</p>
                      </div>
                      <p>Veuillez vérifier ce compte pour lui permettre d'accéder à l'application.</p>
                      <p style="text-align: center; margin: 30px 0;">
                        <a href="${appUrl}/admin" class="button">
                          👑 Vérifier les utilisateurs
                        </a>
                      </p>
                    </div>
                    <div class="footer">
                      <p>MDI RoomPulse - Gestion des salles</p>
                    </div>
                  </div>
                </body>
              </html>
            `
          })
        })
      }

      console.log(`✅ Notification envoyée aux admins pour ${userEmail}`)
    } catch (error) {
      console.error('❌ Erreur lors de la notification de l\'admin:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (signUpMode) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/consent`,
          },
        })
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error('Cet email est déjà utilisé. Veuillez vous connecter.')
            setIsSignUp(false)
            setLoading(false)
            return
          }
          throw error
        }
        
        if (data.user) {
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: data.user.email,
              role: 'user',
              is_verified: false,
              email_consent_granted: false,
              whatsapp_consent_granted: false
            })

          // ✅ NOTIFIER L'ADMIN (avec vérification que l'email existe)
          if (data.user.email) {
            await notifyAdminOfNewUser(data.user.email, data.user.id)
          }
        }
        
        toast.success('✅ Compte créé ! Un email a été envoyé à l\'administrateur pour validation.')
        router.push('/login?waiting=true')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Email ou mot de passe incorrect.')
          } else {
            toast.error(error.message)
          }
          setLoading(false)
          return
        }

        let role = 'user'
        let isVerified = false
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, is_verified')
            .eq('id', data.user.id)
            .single()
          
          role = profile?.role || 'user'
          isVerified = profile?.is_verified || false
          
          if (!profile) {
            await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: data.user.email,
                role: 'user',
                is_verified: false
              })
          }
        }

        if (role !== 'admin' && !isVerified) {
          toast.error('⏳ Votre compte est en attente de vérification. Contactez l\'administrateur.')
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        if (role === 'admin') {
          toast.success('👑 Bienvenue Admin ! Vous avez accès à tout.')
        } else {
          toast.success('Bienvenue !')
        }

        router.push('/dashboard')
      }
    } catch (error: any) {
      toast.error(error.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-[#0056B3]">MDI RoomPulse</CardTitle>
        <CardDescription>
          {signUpMode ? 'Créer un compte' : 'Connectez-vous à votre espace'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              placeholder="vous@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
            />
            {signUpMode && (
              <p className="text-xs text-gray-500">Minimum 6 caractères</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-[#0056B3] hover:bg-[#00449E]"
            disabled={loading}
          >
            {loading ? 'Chargement...' : signUpMode ? 'Créer un compte' : 'Se connecter'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm"
            onClick={() => setIsSignUp(!signUpMode)}
            disabled={loading}
          >
            {signUpMode ? 'Déjà un compte ? Se connecter' : "Pas encore de compte ? S'inscrire"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={<div>Chargement...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}