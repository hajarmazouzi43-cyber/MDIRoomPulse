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
      // ✅ Format portrait (par défaut)
      const doc = new jsPDF('p', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      let y = 15

      // Helper pour dessiner un tableau
      const drawTable = (headers: string[], data: any[][], startY: number) => {
        const colWidth = (pageWidth - 30) / headers.length
        let currentY = startY

        // En-têtes
        doc.setFillColor('#0056B3')
        doc.rect(15, currentY, pageWidth - 30, 8, 'F')
        doc.setTextColor('#FFFFFF')
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        
        headers.forEach((header, i) => {
          const x = 15 + i * colWidth
          doc.text(header, x + 1, currentY + 5.5)
        })

        currentY += 8
        doc.setFont('helvetica', 'normal')

        // Lignes de données
        data.forEach((row, rowIndex) => {
          // Vérifier si on doit ajouter une page
          if (currentY > pageHeight - 20) {
            doc.addPage()
            currentY = 15
            // Re-dessiner l'en-tête sur la nouvelle page
            doc.setFillColor('#0056B3')
            doc.rect(15, currentY, pageWidth - 30, 8, 'F')
            doc.setTextColor('#FFFFFF')
            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            headers.forEach((header, i) => {
              const x = 15 + i * colWidth
              doc.text(header, x + 1, currentY + 5.5)
            })
            currentY += 8
            doc.setFont('helvetica', 'normal')
          }

          const isEven = rowIndex % 2 === 0
          doc.setFillColor(isEven ? '#F5F5F5' : '#FFFFFF')
          doc.rect(15, currentY, pageWidth - 30, 7, 'F')

          row.forEach((cell, cellIndex) => {
            const x = 15 + cellIndex * colWidth
            doc.setTextColor('#333')
            doc.setFontSize(8)
            // Tronquer les textes trop longs
            const cellText = String(cell)
            const maxChars = Math.floor((colWidth - 2) / 1.5)
            const displayText = cellText.length > maxChars ? cellText.slice(0, maxChars - 3) + '...' : cellText
            doc.text(displayText, x + 1, currentY + 5)
          })

          currentY += 7
        })

        return currentY + 5
      }

      // ==================== HEADER ====================
      doc.setFontSize(22)
      doc.setTextColor('#0056B3')
      doc.text('MDI RoomPulse', pageWidth / 2, y, { align: 'center' })
      y += 8

      doc.setFontSize(13)
      doc.setTextColor('#666')
      doc.text('Room Usage Report', pageWidth / 2, y, { align: 'center' })
      y += 12

      doc.setDrawColor('#0056B3')
      doc.setLineWidth(0.5)
      doc.line(15, y, pageWidth - 15, y)
      y += 8

      // ==================== STATS ====================
      doc.setFontSize(14)
      doc.setTextColor('#0056B3')
      doc.text('General Statistics', 15, y)
      y += 8

      const statsData = [
        ['Total Rooms', stats.totalRooms],
        ['Free Rooms', stats.freeRooms],
        ['Occupied Rooms', stats.occupiedRooms],
        ['Total Users', stats.totalUsers],
        ['Total Subscriptions', stats.totalSubscriptions],
        ['Total History', stats.totalHistory],
      ]

      y = drawTable(['Statistic', 'Value'], statsData, y)
      y += 8

      // ==================== ROOMS ====================
      // Vérifier la place avant la prochaine section
      if (y > pageHeight - 50) {
        doc.addPage()
        y = 15
      }

      doc.setFontSize(14)
      doc.setTextColor('#0056B3')
      doc.text('Rooms List', 15, y)
      y += 8

      const roomData = rooms.map((room: any) => [
        room.name || 'Unknown',
        room.is_occupied ? 'Occupied' : 'Free',
        `${room.current_people || 0}/${room.max_people || room.capacity || 1}`,
        room.location || 'N/A',
        room.is_confidential ? 'Yes' : 'No',
      ])

      y = drawTable(['Room', 'Status', 'People', 'Location', 'Confidential'], roomData, y)
      y += 8

      // ==================== HISTORY ====================
      if (y > pageHeight - 50) {
        doc.addPage()
        y = 15
      }

      doc.setFontSize(14)
      doc.setTextColor('#0056B3')
      doc.text('Recent Activity', 15, y)
      y += 8

      const historyData = history.slice(0, 15).map((item: any) => [
        item.rooms?.name || 'Unknown',
        item.is_occupied ? 'Occupied' : 'Free',
        new Date(item.changed_at).toLocaleString(),
        item.profiles?.email || 'System',
      ])

      y = drawTable(['Room', 'Status', 'Date', 'User'], historyData, y)

      // ==================== FOOTER ====================
      if (y > pageHeight - 15) {
        doc.addPage()
        y = 15
      }

      doc.setDrawColor('#0056B3')
      doc.setLineWidth(0.3)
      doc.line(15, y + 5, pageWidth - 15, y + 5)

      doc.setFontSize(8)
      doc.setTextColor('#999')
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, y + 13, { align: 'center' })
      doc.text('© 2026 MDI RoomPulse', pageWidth / 2, y + 18, { align: 'center' })

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