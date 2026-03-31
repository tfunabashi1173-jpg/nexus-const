import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />

      {/* KPI + 稼働現場 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between py-2 border-b last:border-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 社員別ランキング */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-5 w-28" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
          </Card>
        ))}
      </div>

      {/* 得意先・支払先 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-5 w-28" /></CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
