'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

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
      const doc = new jsPDF('l', 'mm', 'a4') // Paysage
      const pageWidth = doc.internal.pageSize.getWidth()

      // ==================== HEADER ====================
      // Logo / Titre
      doc.setFontSize(24)
      doc.setTextColor('#0056B3') // Bleu MDI
      doc.text('MDI RoomPulse', pageWidth / 2, 20, { align: 'center' })

      doc.setFontSize(14)
      doc.setTextColor('#666')
      doc.text('Room Usage Report', pageWidth / 2, 30, { align: 'center' })

      doc.setDrawColor('#0056B3')
      doc.setLineWidth(0.5)
      doc.line(20, 35, pageWidth - 20, 35)

      // ==================== STATS ====================
      doc.setFontSize(16)
      doc.setTextColor('#0056B3')
      doc.text('📊 General Statistics', 20, 48)

      const statsData = [
        ['Total Rooms', stats.totalRooms],
        ['Free Rooms', stats.freeRooms],
        ['Occupied Rooms', stats.occupiedRooms],
        ['Total Users', stats.totalUsers],
        ['Total Subscriptions', stats.totalSubscriptions],
        ['Total History', stats.totalHistory],
      ]

      doc.autoTable({
        startY: 55,
        head: [['Statistic', 'Value']],
        body: statsData,
        theme: 'striped',
        headStyles: { 
          fillColor: '#0056B3', 
          textColor: '#FFFFFF',
          fontSize: 12,
          halign: 'center',
        },
        styles: { 
          fontSize: 11,
          cellPadding: 6,
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' },
        },
      })

      // ==================== ROOMS TABLE ====================
      const finalY = (doc as any).lastAutoTable?.finalY || 100
      doc.setFontSize(16)
      doc.setTextColor('#0056B3')
      doc.text('🏢 Rooms List', 20, finalY + 15)

      const roomData = rooms.map((room: any) => [
        room.name || 'Unknown',
        room.is_occupied ? 'Occupied' : 'Free',
        `${room.current_people || 0}/${room.max_people || room.capacity || 1}`,
        room.location || 'N/A',
        room.is_confidential ? 'Yes' : 'No',
      ])

      doc.autoTable({
        startY: finalY + 22,
        head: [['Room', 'Status', 'People', 'Location', 'Confidential']],
        body: roomData,
        theme: 'striped',
        headStyles: { 
          fillColor: '#0056B3', 
          textColor: '#FFFFFF',
          fontSize: 11,
          halign: 'center',
        },
        styles: { 
          fontSize: 10,
          cellPadding: 4,
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 30, halign: 'center' },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 25, halign: 'center' },
        },
        didDrawCell: (data: any) => {
          // Couleurs pour le statut
          if (data.column.index === 1 && data.cell.raw === 'Occupied') {
            data.cell.styles.fillColor = '#EF4444'
            data.cell.styles.textColor = '#FFFFFF'
          } else if (data.column.index === 1 && data.cell.raw === 'Free') {
            data.cell.styles.fillColor = '#10B981'
            data.cell.styles.textColor = '#FFFFFF'
          }
        },
      })

      // ==================== HISTORY TABLE ====================
      const finalY2 = (doc as any).lastAutoTable?.finalY || 200
      doc.setFontSize(16)
      doc.setTextColor('#0056B3')
      doc.text('📋 Recent Activity', 20, finalY2 + 15)

      const historyData = history.slice(0, 15).map((item: any) => [
        item.rooms?.name || 'Unknown',
        item.is_occupied ? 'Occupied' : 'Free',
        new Date(item.changed_at).toLocaleString(),
        item.profiles?.email || 'System',
      ])

      doc.autoTable({
        startY: finalY2 + 22,
        head: [['Room', 'Status', 'Date', 'User']],
        body: historyData,
        theme: 'striped',
        headStyles: { 
          fillColor: '#0056B3', 
          textColor: '#FFFFFF',
          fontSize: 11,
          halign: 'center',
        },
        styles: { 
          fontSize: 9,
          cellPadding: 4,
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 'auto' },
        },
        didDrawCell: (data: any) => {
          if (data.column.index === 1 && data.cell.raw === 'Occupied') {
            data.cell.styles.fillColor = '#EF4444'
            data.cell.styles.textColor = '#FFFFFF'
          } else if (data.column.index === 1 && data.cell.raw === 'Free') {
            data.cell.styles.fillColor = '#10B981'
            data.cell.styles.textColor = '#FFFFFF'
          }
        },
      })

      // ==================== FOOTER ====================
      const finalY3 = (doc as any).lastAutoTable?.finalY || 270
      doc.setDrawColor('#0056B3')
      doc.setLineWidth(0.3)
      doc.line(20, finalY3 + 10, pageWidth - 20, finalY3 + 10)

      doc.setFontSize(8)
      doc.setTextColor('#999')
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, finalY3 + 18, { align: 'center' })
      doc.text('© 2026 MDI RoomPulse - ENSA Berrechid', pageWidth / 2, finalY3 + 23, { align: 'center' })

      // ==================== SAUVEGARDE ====================
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