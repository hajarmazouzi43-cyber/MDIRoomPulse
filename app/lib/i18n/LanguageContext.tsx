// app/lib/i18n/LanguageContext.tsx
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { translations, Language } from './translations'

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

const STORAGE_KEY = 'roompulse-language'

function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj)
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null
    if (saved === 'fr' || saved === 'en') {
      setLanguageState(saved)
      // ✅ Synchroniser avec les cookies pour les Server Components
      document.cookie = `roompulse-language=${saved}; path=/; max-age=31536000`
    }
    setHydrated(true)
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
    // ✅ Mettre à jour les cookies pour les Server Components
    document.cookie = `roompulse-language=${lang}; path=/; max-age=31536000`
  }

  const t = (key: string): string => {
    const value = getNestedValue(translations[language], key)
    if (value === undefined) {
      const fallback = getNestedValue(translations.fr, key)
      if (fallback !== undefined) return fallback as string
      console.warn(`[i18n] Clé de traduction manquante: "${key}"`)
      return key
    }
    return value as string
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage doit être utilisé à l\'intérieur de <LanguageProvider>')
  }
  return context
}

// ❌ SUPPRIMER getServerLanguage() d'ici car c'est un Client Component
// export async function getServerLanguage() { ... }  ← SUPPRIMER