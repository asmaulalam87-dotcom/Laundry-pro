import { useState, useEffect } from 'react'
import { useSyncStore } from '@/stores/sync-store'

/**
 * Hook to track online/offline status.
 * Updates Zustand sync store and returns current status.
 */
export function useNetworkStatus() {
  const { isOnline, setOnline, pendingCount, lastSyncAt } = useSyncStore()

  useEffect(() => {
    const goOnline = () => { setOnline(true) }
    const goOffline = () => { setOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    setOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [setOnline])

  return { isOnline, pendingCount, lastSyncAt }
}

/**
 * Hook to handle PWA install prompt.
 * Returns { canInstall, promptInstall } — call promptInstall() to show the native install dialog.
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setCanInstall(false)
    return result.outcome === 'accepted'
  }

  return { canInstall, promptInstall }
}
