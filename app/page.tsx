import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#0056B3]">MDI RoomPulse</h1>
          <div className="space-x-4">
            <Link href="/login">
              <Button variant="outline">Sign In</Button>
            </Link>
            <Link href="/login?signup=true">
              <Button>Create Account</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
        <h2 className="text-4xl md:text-6xl font-bold mb-6">
          Manage your meeting rooms in <span className="text-[#0056B3]">real time</span>
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mb-10">
          Visualize room availability, receive notifications, and optimize the use of your meeting spaces.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/login">
            <Button size="lg" className="text-lg px-8 bg-[#0056B3] hover:bg-[#00449E]">
              Get Started
            </Button>
          </Link>
          <Link href="/rooms">
            <Button size="lg" variant="outline" className="text-lg px-8">
              View Rooms
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 w-full max-w-3xl">
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="text-3xl font-bold text-[#0056B3]">⚡</div>
            <h3 className="font-semibold mt-2">Real-time</h3>
            <p className="text-sm text-gray-600">Instant updates</p>
          </div>
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="text-3xl font-bold text-[#0056B3]">📧</div>
            <h3 className="font-semibold mt-2">Notifications</h3>
            <p className="text-sm text-gray-600">Email & WhatsApp alerts</p>
          </div>
          <div className="bg-gray-50 p-6 rounded-lg">
            <div className="text-3xl font-bold text-[#0056B3]">📊</div>
            <h3 className="font-semibold mt-2">Dashboard</h3>
            <p className="text-sm text-gray-600">Statistics & reports</p>
          </div>
        </div>
      </main>

      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          © 2026 MDI RoomPulse - ENSA Berrechid
        </div>
      </footer>
    </div>
  )
}