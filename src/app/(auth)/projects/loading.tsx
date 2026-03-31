import { Skeleton } from '@/components/ui/skeleton'

export default function ProjectsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* フィルタバー */}
      <div className="flex gap-2 flex-wrap">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>

      {/* テーブル */}
      <div className="rounded-md border">
        <div className="border-b p-3 flex gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border-b last:border-0 p-3 flex gap-4">
            {[...Array(6)].map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
