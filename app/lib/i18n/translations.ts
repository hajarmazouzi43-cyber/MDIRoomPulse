// app/lib/i18n/translations.ts
//
// Dictionnaire de traduction. Organisé par "namespace" (une clé par page ou
// section), pour rester lisible même quand on ajoute beaucoup de pages.
// Utilisation : t('home.hero.badge')

export type Language = 'fr' | 'en'

export const translations = {
  fr: {
    home: {
      nav: {
        login: 'Se connecter',
        signup: 'Créer un compte',
      },
      hero: {
        badge: 'Suivi en temps réel',
        titleLine1: 'Vos salles de réunion,',
        titleLine2: 'visibles en un coup d\u2019œil',
        subtitle: 'Visualisez la disponibilité de chaque salle, recevez une alerte dès qu\u2019un espace se libère, et suivez l\u2019usage réel de vos locaux.',
        ctaPrimary: 'Commencer',
        ctaSecondary: 'Voir les salles',
      },
      blueprint: {
        available: 'disponible',
        occupied: 'occupée',
      },
      features: {
        title: 'Ce que RoomPulse change au quotidien',
        realtime: {
          plaque: 'SALLE A · TEMPS RÉEL',
          title: 'Statut instantané',
          desc: 'Le statut de chaque salle se met à jour à la seconde où elle se libère ou s\u2019occupe.',
        },
        alerts: {
          plaque: 'SALLE B · ALERTES',
          title: 'Notifications ciblées',
          desc: 'Un e-mail ou un SMS part automatiquement aux personnes abonnées à une salle.',
        },
        analytics: {
          plaque: 'SALLE C · STATISTIQUES',
          title: 'Taux d\u2019occupation',
          desc: 'Des tableaux de bord clairs pour repérer les salles sous-utilisées et celles saturées.',
        },
      },
      ctaStrip: {
        title: 'Prêt à voir vos salles autrement ?',
        subtitle: 'Créez un compte en une minute et connectez votre première salle.',
        cta: 'Créer un compte gratuitement',
      },
      footer: {
        text: '© 2026 MDI RoomPulse — ENSA Berrechid',
      },
    },
  },
  en: {
    home: {
      nav: {
        login: 'Log in',
        signup: 'Create account',
      },
      hero: {
        badge: 'Real-time tracking',
        titleLine1: 'Your meeting rooms,',
        titleLine2: 'visible at a glance',
        subtitle: 'See the availability of every room, get alerted the moment a space frees up, and track how your spaces are really used.',
        ctaPrimary: 'Get started',
        ctaSecondary: 'View rooms',
      },
      blueprint: {
        available: 'available',
        occupied: 'occupied',
      },
      features: {
        title: 'What RoomPulse changes every day',
        realtime: {
          plaque: 'ROOM A · REAL-TIME',
          title: 'Instant status',
          desc: 'Each room\u2019s status updates the second it frees up or gets occupied.',
        },
        alerts: {
          plaque: 'ROOM B · ALERTS',
          title: 'Targeted notifications',
          desc: 'An email or SMS goes out automatically to people subscribed to a room.',
        },
        analytics: {
          plaque: 'ROOM C · ANALYTICS',
          title: 'Occupancy rate',
          desc: 'Clear dashboards to spot underused rooms and overbooked ones.',
        },
      },
      ctaStrip: {
        title: 'Ready to see your rooms differently?',
        subtitle: 'Create an account in a minute and connect your first room.',
        cta: 'Create a free account',
      },
      footer: {
        text: '© 2026 MDI RoomPulse — ENSA Berrechid',
      },
    },
  },
} as const