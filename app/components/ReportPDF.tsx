'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import jsPDF from 'jspdf'

interface ReportPDFProps {
  rooms: any[]
  history: any[]
  stats: {
    totalRooms: number
    occupiedRooms: number
    freeRooms: number
    totalUsers: number
    totalSubscriptions: number
    totalHistory: number
  }
}

export default function ReportPDF({ rooms, history, stats }: ReportPDFProps) {
  const generatePDF = () => {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      
      // Title
      doc.setFontSize(20)
      doc.setTextColor('#0056B3')
      doc.text('MDI RoomPulse', pageWidth / 2, 20, { align: 'center' })
      
      doc.setFontSize(12)
      doc.setTextColor('#666')
      doc.text('Room Usage Report', pageWidth / 2, 30, { align: 'center' })
      
      // Stats
      doc.setFontSize(14)
      doc.setTextColor('#0056B3')
      doc.text('General Statistics', 20, 45)
      
      doc.setFontSize(10)
      doc.setTextColor('#333')
      doc.text(`Total Rooms: ${stats.totalRooms}`, 20, 55)
      doc.text(`Free Rooms: ${stats.freeRooms}`, 20, 62)
      doc.text(`Occupied Rooms: ${stats.occupiedRooms}`, 20, 69)
      doc.text(`Total Users: ${stats.totalUsers}`, 20, 76)
      doc.text(`Total History: ${stats.totalHistory}`, 20, 83)
      
      // Rooms List
      doc.setFontSize(14)
      doc.setTextColor('#0056B3')
      doc.text('Room List', 20, 98)
      
      let y = 108
      rooms.slice(0, 15).forEach((room, index) => {
        if (y > 270) {
          doc.addPage()
          y = 20
        }
        doc.setFontSize(9)
        doc.setTextColor('#333')
        doc.text(
          `${index + 1}. ${room.name} - ${room.is_occupied ? '🔴 Occupied' : '🟢 Free'} - ${room.current_people || 0}/${room.max_people || room.capacity || 1} people`,
          20,
          y
        )
        y += 8
      })
      
      // Footer
      doc.setFontSize(8)
      doc.setTextColor('#999')
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, 285, { align: 'center' })
      doc.text('© 2026 MDI RoomPulse - ENSA Berrechid', pageWidth / 2, 290, { align: 'center' })
      
      doc.save(`report-${new Date().toISOString().split('T')[0]}.pdf`)
      toast.success('PDF downloaded successfully!')
    } catch (error) {
      console.error('PDF Error:', error)
      toast.error('Error generating PDF')
    }
  }

  return (
    <Button onClick={generatePDF} className="bg-blue-600 hover:bg-blue-700">
      📄 Generate PDF
    </Button>
  )
}