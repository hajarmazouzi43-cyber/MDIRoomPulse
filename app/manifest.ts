import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MDI RoomPulse',
    short_name: 'RoomPulse',
    description: 'Système intelligent de gestion des salles de réunion',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0056B3',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}