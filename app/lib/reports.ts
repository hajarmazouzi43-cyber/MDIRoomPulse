import { createClient } from './supabase/client'

export async function generateReport() {
  const supabase = createClient()
  
  const { data: rooms } = await supabase.from('rooms').select('*')
  const { data: history } = await supabase
    .from('room_history')
    .select('*')
    .gte('changed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  const total = rooms?.length || 0
  const occupied = rooms?.filter(r => r.is_occupied).length || 0
  const events = history?.length || 0

  return `
📊 MDI RoomPulse - Weekly Report

📈 Summary:
- Total Rooms: ${total}
- Occupied: ${occupied}
- Free: ${total - occupied}
- Events: ${events}

📋 Room Details:
${rooms?.map(r => `- ${r.name}: ${r.is_occupied ? 'Occupied' : 'Free'} (${r.current_people || 0}/${r.max_people || r.capacity || 1})`).join('\n')}

Generated: ${new Date().toLocaleString()}
  `
}