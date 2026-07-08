'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Toaster } from 'sonner'
import { toast } from 'sonner'
import { requestNotificationPermission } from '@/lib/push'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // ✅ Dark Mode
  useEffect(() => {
    const isDark = localStorage.getItem('darkMode') === 'true'
    setDarkMode(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    localStorage.setItem('darkMode', String(newMode))
    document.documentElement.classList.toggle('dark', newMode)
  }

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
        <header className="border-b bg-white dark:bg-[#0f172a] dark:border-[#334155] shadow-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-8">
              <Link href="/dashboard">
                <h1 className="text-2xl font-bold text-[#0056B3] dark:text-[#00A3E0]">
                  MDI RoomPulse
                </h1>
              </Link>
              <nav className="hidden md:flex gap-4">
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
                  <Button variant="ghost" size="sm">Status</Button>
                </Link>
                <Link href="/history">
                  <Button variant="ghost" size="sm">History</Button>
                </Link>
                <Link href="/admin">
                  <Button variant="ghost" size="sm">Admin</Button>
                </Link>
                <Link href="/analytics">
                  <Button variant="ghost" size="sm">Analytics</Button>
                </Link>
                <Link href="/calendar">
                  <Button variant="ghost" size="sm">Calendar</Button>
                </Link>
                <Link href="/ai-assistant">
                  <Button variant="ghost" size="sm">AI</Button>
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              {/* ✅ Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleDarkMode}
                className="text-xl"
              >
                {darkMode ? '☀️' : '🌙'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const granted = await requestNotificationPermission()
                  toast.success(granted ? 'Notifications enabled' : 'Notifications blocked')
                }}
              >
                🔔
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:inline">
                {user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-gray-50 dark:bg-[#0f172a]">
          {children}
        </main>

        <footer className="border-t bg-white dark:bg-[#0f172a] dark:border-[#334155] py-4">
          <div className="container mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
            © 2026 MDI RoomPulse - ENSA Berrechid
          </div>
        </footer>
      </div>
      <Toaster position="bottom-right" />
    </>
  )
}