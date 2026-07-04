import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
  
  const total = rooms?.length || 0
  const free = rooms?.filter(r => r.status === 'free').length || 0
  const occupied = rooms?.filter(r => r.status === 'occupied').length || 0
  const maintenance = rooms?.filter(r => r.status === 'maintenance').length || 0

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-[#0056B3] mb-2">
        Dashboard
      </h1>
      
      <p className="text-gray-600 mb-8">
        Welcome {session?.user?.email} 
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Rooms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              🟢 Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{free}</p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              🔴 Occupied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{occupied}</p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              🟡 Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-500">{maintenance}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}