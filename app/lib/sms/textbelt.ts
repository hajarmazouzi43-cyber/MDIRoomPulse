// app/lib/sms/textbelt.ts
const TEXTBELT_URL = process.env.TEXTBELT_URL || 'http://localhost:9000'

interface TextBeltResponse {
  success: boolean
  error?: string
  quotaRemaining?: number
}

export async function sendSMS(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Formatage du numéro de téléphone pour le Maroc
    const formattedPhone = formatPhoneNumber(phone)
    
    console.log(`📱 Envoi SMS à ${formattedPhone}: ${message}`)
    
    const response = await fetch(`${TEXTBELT_URL}/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: TextBeltResponse = await response.json()
    
    if (data.success) {
      console.log('✅ SMS envoyé avec succès')
      return { success: true }
    } else {
      console.error('❌ Erreur TextBelt:', data.error)
      return { success: false, error: data.error || 'Erreur inconnue' }
    }
  } catch (error) {
    console.error('❌ Erreur TextBelt:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur technique' 
    }
  }
}

function formatPhoneNumber(phone: string): string {
  // Supprimer les espaces, tirets, etc.
  let cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // Si le numéro commence par 0, ajouter +212 (Maroc)
  if (cleaned.startsWith('0')) {
    cleaned = '+212' + cleaned.substring(1)
  }
  
  // Si le numéro ne commence pas par +, ajouter +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned
  }
  
  return cleaned
}