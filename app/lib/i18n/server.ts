// app/lib/i18n/server.ts
import { cookies } from 'next/headers'
import { translations } from './translations'

export type Language = 'fr' | 'en'

// ✅ Récupérer la langue depuis les cookies (Server Component)
export async function getServerLanguage(): Promise<Language> {
  const cookieStore = await cookies()
  return (cookieStore.get('roompulse-language')?.value as Language) || 'fr'
}

// ✅ Récupérer les traductions pour une clé donnée (Server Component)
export function getTranslation(lang: string, key: string): string {
  const keys = key.split('.')
  let value: any = translations[lang as 'fr' | 'en']
  for (const k of keys) {
    if (value && value[k] !== undefined) {
      value = value[k]
    } else {
      return key
    }
  }
  return typeof value === 'string' ? value : key
}

// ✅ Récupérer toutes les traductions pour une langue (Server Component)
export function getTranslations(lang: string) {
  return translations[lang as 'fr' | 'en'] || translations.fr
}