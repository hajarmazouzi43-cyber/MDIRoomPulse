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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (signUpMode) {
        // Inscription
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/consent`,
          },
        })
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error('This email is already registered. Please sign in instead.')
            setIsSignUp(false)
            setLoading(false)
            return
          }
          throw error
        }
        
        // Créer un profil avec le rôle 'user' par défaut
        if (data.user) {
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: data.user.email,
              role: 'user',
              email_consent_granted: false,
              whatsapp_consent_granted: false
            })
        }
        
        toast.success('Account created! Please set your notification preferences.')
        router.push('/consent')
      } else {
        // Connexion
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password. Please try again.')
          } else {
            toast.error(error.message)
          }
          setLoading(false)
          return
        }

        // ✅ Vérifier le rôle de l'utilisateur
        let role = 'user'
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single()
          
          role = profile?.role || 'user'
          
          // Si l'utilisateur n'a pas de profil, le créer
          if (!profile) {
            await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: data.user.email,
                role: 'user'
              })
          }
        }

        // Message de bienvenue selon le rôle
        if (role === 'admin') {
          toast.success('👑 Welcome Admin! You have full access.')
        } else {
          toast.success('Welcome back!')
        }

        router.push('/dashboard')
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl text-[#0056B3]">MDI RoomPulse</CardTitle>
        <CardDescription>
          {signUpMode ? 'Create an account' : 'Sign in to your workspace'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
              <p className="text-xs text-gray-500">Minimum 6 characters</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-[#0056B3] hover:bg-[#00449E]"
            disabled={loading}
          >
            {loading ? 'Loading...' : signUpMode ? 'Create Account' : 'Sign In'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm"
            onClick={() => setIsSignUp(!signUpMode)}
            disabled={loading}
          >
            {signUpMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}