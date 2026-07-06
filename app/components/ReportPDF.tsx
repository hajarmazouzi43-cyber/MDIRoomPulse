'use client'

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Register font
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2' }
  ]
})

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0056B3',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0056B3',
    marginBottom: 10,
    borderBottom: '1px solid #eee',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: '1px solid #f0f0f0',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    fontWeight: 'bold',
  },
  cell: {
    fontSize: 11,
    paddingHorizontal: 4,
  },
  cellHeader: {
    fontSize: 11,
    paddingHorizontal: 4,
    fontWeight: 'bold',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0056B3',
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  footer: {
    marginTop: 30,
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  }
})

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
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>MDI RoomPulse</Text>
        <Text style={styles.subtitle}>Room Usage Report</Text>

        <Text style={styles.sectionTitle}>📊 General Statistics</Text>
        <View style={styles.stats}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalRooms}</Text>
            <Text style={styles.statLabel}>Total Rooms</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.freeRooms}</Text>
            <Text style={styles.statLabel}>Free Rooms</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.occupiedRooms}</Text>
            <Text style={styles.statLabel}>Occupied Rooms</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>📋 Room List</Text>
        <View style={styles.rowHeader}>
          <Text style={[styles.cellHeader, { width: '30%' }]}>Name</Text>
          <Text style={[styles.cellHeader, { width: '20%' }]}>Status</Text>
          <Text style={[styles.cellHeader, { width: '25%' }]}>People</Text>
          <Text style={[styles.cellHeader, { width: '25%' }]}>Location</Text>
        </View>

        {rooms.map((room, index) => (
          <View key={index} style={styles.row}>
            <Text style={[styles.cell, { width: '30%' }]}>{room.name}</Text>
            <Text style={[styles.cell, { width: '20%' }]}>
              {room.is_occupied ? '🔴 Occupied' : '🟢 Free'}
            </Text>
            <Text style={[styles.cell, { width: '25%' }]}>
              {room.current_people || 0}/{room.max_people || room.capacity || 1}
            </Text>
            <Text style={[styles.cell, { width: '25%' }]}>{room.location || 'N/A'}</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>📈 Recent Activity</Text>
        {history.slice(0, 10).map((item, index) => (
          <View key={index} style={styles.row}>
            <Text style={[styles.cell, { width: '35%' }]}>
              {item.rooms?.name || 'Unknown'}
            </Text>
            <Text style={[styles.cell, { width: '25%' }]}>
              {item.is_occupied ? 'Occupied' : 'Free'}
            </Text>
            <Text style={[styles.cell, { width: '40%' }]}>
              {new Date(item.changed_at).toLocaleString('en-US')}
            </Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Report generated on {new Date().toLocaleString('en-US')}
        </Text>
        <Text style={styles.footer}>© 2026 MDI RoomPulse - ENSA Berrechid</Text>
      </Page>
    </Document>
  )
}