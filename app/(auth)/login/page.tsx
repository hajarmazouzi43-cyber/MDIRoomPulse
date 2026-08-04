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

 // app/(auth)/login/page.tsx - Version corrigée

// app/(auth)/login/page.tsx - Version corrigée

const notifyAdminOfNewUser = async (userEmail: string, userId: string) => {
  try {
    // On délègue tout au serveur (route /api/notify-new-signup), qui utilise
    // la clé service_role. Fait côté navigateur, ce code était bloqué
    // silencieusement par les policies RLS : juste après l'inscription,
    // tant que l'email n'est pas confirmé, l'utilisateur n'a pas encore de
    // session active, donc aucune requête authentifiée (comme lire la liste
    // des admins) ne passait.
    const response = await fetch('/api/notify-new-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, userId })
    })
    const result = await response.json()
    if (!response.ok) {
      console.error('❌ Erreur notification admin:', result.error)
    } else {
      console.log(`📧 ${result.notified}/${result.totalAdmins} admin(s) notifié(s)`)
    }
  } catch (error) {
    console.error('❌ Erreur notification admin:', error)
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
          // ✅ Création du profil + notification admin, tout côté serveur
          // (contourne le problème de session absente juste après signUp)
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
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl text-[#0056B3]">MDI RoomPulse</CardTitle>
        <CardDescription className="mt-1">
          {signUpMode ? 'Créer un compte' : 'Connectez-vous à votre espace'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              placeholder="vous@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
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
              className="h-11"
            />
            {signUpMode && (
              <p className="text-xs text-gray-500 pt-0.5">Minimum 6 caractères</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-6">
          <Button
            type="submit"
            className="w-full h-11 bg-[#0056B3] hover:bg-[#00449E]"
            disabled={loading}
          >
            {loading ? 'Chargement...' : signUpMode ? 'Créer un compte' : 'Se connecter'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm h-9"
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