'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface OccupancyChartProps {
  data: {
    name: string
    current_people: number
    max_people: number
  }[]
}

export default function OccupancyChart({ data }: OccupancyChartProps) {
  // Filtrer pour n'afficher que les salles avec max_people > 0
  const chartData = data
    .filter(room => room.max_people > 0)
    .map(room => ({
      name: room.name.length > 15 ? room.name.slice(0, 12) + '...' : room.name,
      occupied: room.current_people || 0,
      available: (room.max_people || 0) - (room.current_people || 0),
      max_people: room.max_people
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        No rooms with capacity data
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" />
        <YAxis 
          dataKey="name" 
          type="category" 
          width={100}
          tick={{ fontSize: 12 }}
        />
        <Tooltip 
          formatter={(value: number, name: string) => {
            if (name === 'occupied') return [`${value} people`, 'Occupied']
            if (name === 'available') return [`${value} people`, 'Available']
            return [value, name]
          }}
        />
        <Bar 
          dataKey="occupied" 
          stackId="a" 
          fill="#EF4444" 
          name="Occupied"
          radius={[0, 4, 4, 0]}
        />
        <Bar 
          dataKey="available" 
          stackId="a" 
          fill="#10B981" 
          name="Available"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}