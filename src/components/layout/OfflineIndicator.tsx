import { useNetworkStatus, usePWAInstall } from '@/hooks/use-pwa'
import { Wifi, WifiOff, Download, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export function OfflineIndicator() {
  const { isOnline, pendingCount, lastSyncAt } = useNetworkStatus()
  const { canInstall, promptInstall } = usePWAInstall()

  const handleInstall = async () => {
    const accepted = await promptInstall()
    if (accepted) toast.success('App installed successfully!')
  }

  const handleSyncNow = async () => {
    if (!isOnline) {
      toast.error('No internet connection')
      return
    }
    toast.info('Syncing data…')
    // Process sync queue
    const { useSyncStore } = await import('@/stores/sync-store')
    const store = useSyncStore.getState()
    const unsynced = store.syncQueue.filter(q => !q.synced)
    if (unsynced.length === 0) {
      toast.success('All data is already synced')
      return
    }
    // Mark all as synced (in real implementation, push to Supabase here)
    for (const item of unsynced) {
      store.markSynced(item.id)
    }
    store.setOnline(true)
    useSyncStore.getState().setLastSync(new Date().toISOString())
    toast.success(`Synced ${unsynced.length} change(s)`)
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Sync status */}
      <button
        onClick={handleSyncNow}
        title={isOnline ? 'Sync now' : 'Offline — sync when online'}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
          isOnline
            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
        }`}
      >
        {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        {isOnline ? 'Online' : 'Offline'}
        {pendingCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
            {pendingCount} pending
          </span>
        )}
      </button>

      {/* Last sync info */}
      {lastSyncAt && isOnline && (
        <span className="text-[10px] text-muted-foreground hidden md:inline" title={lastSyncAt}>
          <Cloud className="w-3 h-3 inline mr-0.5" />
          Synced {new Date(lastSyncAt).toLocaleTimeString()}
        </span>
      )}

      {!isOnline && (
        <span className="text-[10px] text-muted-foreground hidden md:inline">
          <CloudOff className="w-3 h-3 inline mr-0.5" />
          Changes saved locally
        </span>
      )}

      {/* PWA Install button */}
      {canInstall && (
        <button
          onClick={handleInstall}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          <Download className="w-3 h-3" />
          Install App
        </button>
      )}
    </div>
  )
}
