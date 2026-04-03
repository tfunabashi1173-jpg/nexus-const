'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    const handleOffline = () => setIsOffline(true)
    const handleOnline  = () => setIsOffline(false)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online',  handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online',  handleOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-sm font-medium flex items-center justify-center gap-2 py-2 md:ml-56" data-no-print>
      <WifiOff className="h-4 w-4" />
      オフラインです。データの更新はできません。
    </div>
  )
}
