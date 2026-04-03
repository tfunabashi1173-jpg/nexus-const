import { getSession } from '@/lib/auth'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { redirect } from 'next/navigation'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <OfflineBanner />
      <AppSidebar user={user} />
      <main className="flex-1 ml-0 md:ml-56 overflow-auto bg-slate-50 pt-14 md:pt-0">
        <div className="p-6 max-w-screen-2xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
