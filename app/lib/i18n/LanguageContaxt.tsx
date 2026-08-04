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

// Va chercher une valeur imbriquée dans le dictionnaire à partir d'une clé
// pointée, ex: "home.hero.title" -> translations.fr.home.hero.title
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj)
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr')
  const [hydrated, setHydrated] = useState(false)

  // Lit la préférence sauvegardée une fois le composant monté côté client
  // (on ne peut pas lire localStorage pendant le rendu serveur).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null
    if (saved === 'fr' || saved === 'en') {
      setLanguageState(saved)
    }
    setHydrated(true)
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
  }

  const t = (key: string): string => {
    const value = getNestedValue(translations[language], key)
    if (value === undefined) {
      // Repli sur le français si une clé manque dans une langue, puis sur
      // la clé elle-même — pour ne jamais rien afficher de vide/cassé.
      const fallback = getNestedValue(translations.fr, key)
      if (fallback !== undefined) return fallback as string
      console.warn(`[i18n] Clé de traduction manquante: "${key}"`)
      return key
    }
    return value as string
  }

  // On évite un flash de contenu mal traduit avant l'hydratation, en gardant
  // le rendu identique (français par défaut) tant qu'on n'a pas confirmé la
  // préférence sauvegardée — ceci reste cohérent avec le rendu serveur.
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