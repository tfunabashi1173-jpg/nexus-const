import { getSession } from '@/lib/auth'
import { AppSidebar } from '@/components/layout/AppSidebar'
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
      <AppSidebar user={user} />
      <main className="flex-1 ml-56 overflow-auto bg-muted/30">
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
