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
      const doc = new jsPDF('l', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 20

      // Helper pour dessiner un tableau simple
      const drawTable = (headers: string[], data: any[][], startY: number, colors?: any) => {
        const colWidth = (pageWidth - 40) / headers.length
        let currentY = startY

        // En-têtes
        doc.setFillColor('#0056B3')
        doc.rect(20, currentY, pageWidth - 40, 8, 'F')
        doc.setTextColor('#FFFFFF')
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        
        headers.forEach((header, i) => {
          const x = 20 + i * colWidth
          doc.text(header, x + 2, currentY + 5.5)
        })

        currentY += 8
        doc.setFont('helvetica', 'normal')

        // Lignes de données
        data.forEach((row, rowIndex) => {
          const isEven = rowIndex % 2 === 0
          doc.setFillColor(isEven ? '#F5F5F5' : '#FFFFFF')
          doc.rect(20, currentY, pageWidth - 40, 7, 'F')

          row.forEach((cell, cellIndex) => {
            const x = 20 + cellIndex * colWidth
            doc.setTextColor('#333')
            doc.setFontSize(9)
            doc.text(String(cell), x + 2, currentY + 5)
          })

          currentY += 7
        })

        return currentY + 5
      }

      // ==================== HEADER ====================
      doc.setFontSize(24)
      doc.setTextColor('#0056B3')
      doc.text('MDI RoomPulse', pageWidth / 2, y, { align: 'center' })
      y += 10

      doc.setFontSize(14)
      doc.setTextColor('#666')
      doc.text('Room Usage Report', pageWidth / 2, y, { align: 'center' })
      y += 15

      doc.setDrawColor('#0056B3')
      doc.setLineWidth(0.5)
      doc.line(20, y, pageWidth - 20, y)
      y += 10

      // ==================== STATS ====================
      doc.setFontSize(16)
      doc.setTextColor('#0056B3')
      doc.text('General Statistics', 20, y)
      y += 10

      const statsData = [
        ['Total Rooms', stats.totalRooms],
        ['Free Rooms', stats.freeRooms],
        ['Occupied Rooms', stats.occupiedRooms],
        ['Total Users', stats.totalUsers],
        ['Total Subscriptions', stats.totalSubscriptions],
        ['Total History', stats.totalHistory],
      ]

      y = drawTable(['Statistic', 'Value'], statsData, y)
      y += 10

      // ==================== ROOMS ====================
      doc.setFontSize(16)
      doc.setTextColor('#0056B3')
      doc.text('Rooms List', 20, y)
      y += 10

      const roomData = rooms.slice(0, 15).map((room: any) => [
        room.name || 'Unknown',
        room.is_occupied ? 'Occupied' : 'Free',
        `${room.current_people || 0}/${room.max_people || room.capacity || 1}`,
        room.location || 'N/A',
        room.is_confidential ? 'Yes' : 'No',
      ])

      y = drawTable(['Room', 'Status', 'People', 'Location', 'Confidential'], roomData, y)
      y += 10

      // ==================== HISTORY ====================
      doc.setFontSize(16)
      doc.setTextColor('#0056B3')
      doc.text('Recent Activity', 20, y)
      y += 10

      const historyData = history.slice(0, 10).map((item: any) => [
        item.rooms?.name || 'Unknown',
        item.is_occupied ? 'Occupied' : 'Free',
        new Date(item.changed_at).toLocaleString(),
        item.profiles?.email || 'System',
      ])

      y = drawTable(['Room', 'Status', 'Date', 'User'], historyData, y)

      // ==================== FOOTER ====================
      doc.setDrawColor('#0056B3')
      doc.setLineWidth(0.3)
      doc.line(20, y + 10, pageWidth - 20, y + 10)

      doc.setFontSize(8)
      doc.setTextColor('#999')
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, y + 18, { align: 'center' })
      doc.text('© 2026 MDI RoomPulse - ENSA Berrechid', pageWidth / 2, y + 23, { align: 'center' })

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