'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { 
  LayoutDashboard, 
  Building2, 
  Map, 
  History, 
  User, 
  Shield, 
  BarChart3, 
  Bot,
  LogOut,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface SidebarProps {
  darkMode: boolean
  toggleDarkMode: () => void
  handleSignOut: () => void
  isAdmin: boolean
  onToggle?: (collapsed: boolean) => void
}

export default function Sidebar({ 
  darkMode, 
  toggleDarkMode, 
  handleSignOut, 
  isAdmin,
  onToggle 
}: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)
  const { t } = useLanguage()

  const toggleCollapse = () => {
    const newState = !collapsed
    setCollapsed(newState)
    if (onToggle) {
      onToggle(newState)
    }
  }

  const navItems = [
    { name: t('nav.dashboard'), icon: LayoutDashboard, href: '/dashboard' },
    { name: t('nav.rooms'), icon: Building2, href: '/rooms' },
    { name: t('nav.floorPlan'), icon: Map, href: '/floor-plan' },
    { name: t('nav.history'), icon: History, href: '/history' },
    { name: t('nav.aiAssistant'), icon: Bot, href: '/ai-assistant' },
    { name: t('nav.analytics'), icon: BarChart3, href: '/analytics' },
    ...(isAdmin ? [
      { name: t('nav.admin'), icon: Shield, href: '/admin' },
    ] : []),
    { name: t('nav.profile'), icon: User, href: '/profile' },
  ]

  return (
    <aside className={`
      fixed left-0 top-0 z-50 h-screen 
      bg-white dark:bg-[#0f172a] 
      border-r border-gray-200 dark:border-[#334155]
      transition-all duration-300 ease-in-out
      ${collapsed ? 'w-16' : 'w-64'}
    `}>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-3 border-b border-gray-200 dark:border-[#334155]">
        {!collapsed && (
          <Link href="/dashboard" className="text-lg font-bold text-[#0056B3] dark:text-[#00A3E0] truncate">
            {t('nav.appName')}
          </Link>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1e293b]"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
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
                ${collapsed ? 'justify-center' : ''}
              `}>
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span className="text-sm font-medium truncate">{item.name}</span>}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-[#334155] p-2 space-y-2">
        <LanguageSwitcher
          collapsed={collapsed}
          className="w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1e293b]"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDarkMode}
          className={`w-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1e293b] ${collapsed ? 'justify-center' : 'justify-start'}`}
        >
          {darkMode ? <Sun size={20} className="shrink-0" /> : <Moon size={20} className="shrink-0" />}
          {!collapsed && <span className="ml-3 text-sm">{darkMode ? t('nav.lightMode') : t('nav.darkMode')}</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className={`w-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 ${collapsed ? 'justify-center' : 'justify-start'}`}
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span className="ml-3 text-sm">{t('nav.signOut')}</span>}
        </Button>
      </div>
    </aside>
  )
}