'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboard, 
  Building2, 
  Map, 
  History, 
  User, 
  Shield, 
  BarChart3, 
  Calendar, 
  Bot,
  LogOut,
  Moon,
  Sun,
  
} from 'lucide-react'

interface SidebarProps {
  darkMode: boolean
  toggleDarkMode: () => void
  handleSignOut: () => void
  isAdmin: boolean
}

export default function Sidebar({ darkMode, toggleDarkMode, handleSignOut, isAdmin }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { name: 'Rooms', icon: Building2, href: '/rooms' },
    { name: 'Floor Plan', icon: Map, href: '/floor-plan' },
    { name: 'History', icon: History, href: '/history' },
    { name: 'Calendar', icon: Calendar, href: '/calendar' },
    { name: 'AI Assistant', icon: Bot, href: '/ai-assistant' },
    { name: 'Analytics', icon: BarChart3, href: '/analytics' },
    
        // ✅ Admin seulement
    ...(isAdmin ? [
      { name: 'Admin', icon: Shield, href: '/admin' },
    ] : []),
    { name: 'Profile', icon: User, href: '/profile' },
  ]

  return (
    <aside className={`
      fixed left-0 top-0 z-50 h-screen 
      bg-white dark:bg-[#0f172a] 
      border-r border-gray-200 dark:border-[#334155]
      transition-all duration-300
      ${collapsed ? 'w-16' : 'w-64'}
    `}>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-[#334155]">
        {!collapsed && (
          <Link href="/dashboard" className="text-xl font-bold text-[#0056B3] dark:text-[#00A3E0]">
            MDI RoomPulse
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-500 dark:text-gray-400"
        >
          {collapsed ? '→' : '←'}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const Icon = item.icon
          
          return (
            <Link key={item.href} href={item.href}>
              <div className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-200 cursor-pointer
                ${isActive 
                  ? 'bg-[#0056B3] text-white dark:bg-[#0056B3]' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1e293b]'
                }
              `}>
                <Icon size={20} />
                {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-[#334155] p-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDarkMode}
          className="w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1e293b]"
        >
          {darkMode ? <Sun size={20} className="mr-3" /> : <Moon size={20} className="mr-3" />}
          {!collapsed && (darkMode ? 'Light Mode' : 'Dark Mode')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          <LogOut size={20} className="mr-3" />
          {!collapsed && 'Sign Out'}
        </Button>
      </div>
    </aside>
  )
}