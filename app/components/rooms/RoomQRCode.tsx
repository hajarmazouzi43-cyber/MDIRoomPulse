'use client'

import QRCode from 'qrcode.react'

export default function RoomQRCode({ roomId, roomName }: { roomId: string, roomName: string }) {
  const url = `${window.location.origin}/rooms/${roomId}`

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow">
      <QRCode value={url} size={120} />
      <p className="text-xs text-gray-500 mt-2">Scan to view {roomName}</p>
    </div>
  )
}