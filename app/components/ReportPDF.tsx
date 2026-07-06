'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function ReportPDF({ rooms, history, stats }: ReportPDFProps) {
  const generatePDF = () => {
    try {
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      
      doc.setFont('helvetica')
      
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
      
      const statsData = [
        ['Total Rooms', stats.totalRooms],
        ['Free Rooms', stats.freeRooms],
        ['Occupied Rooms', stats.occupiedRooms],
        ['Total Users', stats.totalUsers],
        ['Total History', stats.totalHistory],
      ]
      
      doc.autoTable({
        startY: 50,
        head: [['Statistic', 'Value']],
        body: statsData,
        theme: 'striped',
        headStyles: { fillColor: '#0056B3' },
        styles: { fontSize: 10 },
      })
      
      // Rooms Table
      const roomData = rooms.slice(0, 20).map(room => [
        room.name,
        room.is_occupied ? 'Occupied' : 'Free',
        `${room.current_people || 0}/${room.max_people || room.capacity || 1}`
      ])
      
      doc.autoTable({
        startY: (doc as any).lastAutoTable?.finalY + 10 || 100,
        head: [['Room', 'Status', 'People']],
        body: roomData,
        theme: 'striped',
        headStyles: { fillColor: '#0056B3' },
        styles: { fontSize: 9 },
      })
      
      // Footer
      doc.setFontSize(8)
      doc.setTextColor('#999')
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, 285, { align: 'center' })
      doc.text('2026 MDI RoomPulse - ENSA Berrechid', pageWidth / 2, 290, { align: 'center' })
      
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