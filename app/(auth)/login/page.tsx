'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)  // ✅ Toujours commencer en mode Sign In
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // ✅ On ignore le paramètre signup=true pour éviter de forcer le mode Sign Up
  // const isSignUpFromUrl = searchParams.get('signup') === 'true'
  // const signUpMode = isSignUpFromUrl || isSignUp
  
  // ✅ On utilise seulement l'état local
  const signUpMode = isSignUp

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (signUpMode) {
        // ✅ INSCRIPTION
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/consent`,
          },
        })
        if (error) {
          // ✅ Message clair si l'email existe déjà
          if (error.message.includes('User already registered')) {
            toast.error('This email is already registered. Please sign in instead.')
            setIsSignUp(false)  // ✅ Basculer automatiquement en mode Sign In
            setLoading(false)
            return
          }
          throw error
        }

        if (phoneNumber && data.user) {
          const formattedPhone = formatPhoneNumber(phoneNumber)
          await supabase
            .from('profiles')
            .update({ phone: formattedPhone })
            .eq('id', data.user.id)
        }

        toast.success('Account created! Please check your email to confirm.')
        router.push('/consent')
      } else {
        //  CONNEXION
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

        toast.success('Welcome back!')
        router.push('/dashboard')
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-[#0056B3]">MDI RoomPulse</CardTitle>
          <CardDescription>
            {signUpMode ? 'Create a new account' : 'Sign in to your workspace'}
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

            {signUpMode && (
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500">
                  Format: 06 12 34 56 78 (Moroccan number)
                </p>
                <p className="text-xs text-blue-600">
                  💬 We'll ask for your consent before sending any WhatsApp messages
                </p>
              </div>
            )}

            {!signUpMode && (
              <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
                💬 You'll receive WhatsApp notifications if you have a number saved and gave consent
              </div>
            )}
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
              onClick={() => {
                setIsSignUp(!signUpMode)
                setPhoneNumber('')
              }}
              disabled={loading}
            >
              {signUpMode ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}