// app/lib/dateUtils.ts
//
// `date.toISOString().split('T')[0]` convertit d'abord en UTC avant
// d'extraire la date — ce qui peut donner la veille (ou le lendemain)
// selon le fuseau horaire et l'heure du test. Cette fonction construit
// la chaîne "YYYY-MM-DD" à partir des composants LOCAUX de la date
// (année/mois/jour tels qu'affichés à l'utilisateur), sans jamais passer
// par une conversion UTC.
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}