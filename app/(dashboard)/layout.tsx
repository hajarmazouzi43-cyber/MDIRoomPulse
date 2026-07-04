'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Toaster } from 'sonner'
import { toast } from 'sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Error signing out')
    } else {
      toast.success('Signed out successfully')
      router.push('/login')
    }
  }

  return (
    <>
      <div className="min-h-screen flex flex-col">
        <header className="border-b bg-white shadow-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link href="/dashboard">
                <h1 className="text-2xl font-bold text-[#0056B3]">MDI RoomPulse</h1>
              </Link>
              <nav className="flex flex-wrap gap-2 md:gap-4">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
                <Link href="/rooms">
                  <Button variant="ghost" size="sm">Rooms</Button>
                </Link>
                <Link href="/floor-plan">
                  <Button variant="ghost" size="sm">Floor Plan</Button>
                </Link>
                <Link href="/profile">
                  <Button variant="ghost" size="sm">Profile</Button>
                </Link>
                <Link href="/status">
                    <Button variant="ghost" size="sm">🗣️ Status</Button>
                </Link>
                <Link href="/history">
                    <Button variant="ghost" size="sm">Historique</Button>
                    </Link>
                    <Link href="/admin">
                    <Button variant="ghost" size="sm">Admin</Button>
                    </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden md:inline">
                {user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-gray-50">
          {children}
        </main>

        <footer className="border-t bg-white py-4">
          <div className="container mx-auto px-4 text-center text-sm text-gray-500">
            © 2026 MDI RoomPulse - ENSA Berrechid
          </div>
        </footer>
      </div>
      <Toaster position="bottom-right" />
    </>
  )
}