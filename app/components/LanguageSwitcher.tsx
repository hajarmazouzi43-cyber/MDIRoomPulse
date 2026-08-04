// app/components/LanguageSwitcher.tsx
'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="inline-flex items-center rounded-full border border-[#DAD7E3] bg-white p-0.5 text-xs font-medium">
      <button
        onClick={() => setLanguage('fr')}
        className={`px-2.5 py-1 rounded-full transition-colors ${
          language === 'fr' ? 'bg-[#7C5CFC] text-white' : 'text-[#6B6B7A] hover:text-[#1A1A2E]'
        }`}
        aria-pressed={language === 'fr'}
      >
        FR
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded-full transition-colors ${
          language === 'en' ? 'bg-[#7C5CFC] text-white' : 'text-[#6B6B7A] hover:text-[#1A1A2E]'
        }`}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
    </div>
  )
}