import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function RevenueLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader>
            <CardContent><Skeleton className="h-7 w-24" /></CardContent>
          </Card>
        ))}
      </div>

      {/* テーブル */}
      <div className="rounded-md border">
        <div className="border-b p-3 flex gap-4">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border-b last:border-0 p-3 flex gap-4">
            {[...Array(7)].map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
