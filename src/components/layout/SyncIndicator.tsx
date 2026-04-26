import { useState, useEffect, useCallback, useRef } from 'react'
import { useSyncStore } from '@/stores/sync-store'
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff, Check, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error' | 'idle'

export function SyncIndicator() {
  const { isOnline, pendingCount, lastSyncAt, setLastSync, clearQueue } = useSyncStore()
  const [status, setStatus] = useState<SyncStatus>(isOnline ? 'connected' : 'offline')
  const [showTooltip, setShowTooltip] = useState(false)
  const [autoSyncInterval, setAutoSyncInterval] = useState<number | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Check Supabase connectivity
  const checkConnection = useCallback(async () => {
    try {
      const { loadSupabaseConfig, testConnection: testConn } = await import('@/services/supabase')
      const config = loadSupabaseConfig()
      if (!config.url || !config.anonKey) {
        setStatus('idle')
        return false
      }
      const result = await testConn()
      if (!result.success) {
        setStatus('error')
        return false
      }
      setStatus('connected')
      return true
    } catch {
      setStatus('error')
      return false
    }
  }, [])

  // Full sync: push local → cloud, pull cloud → local
  const handleFullSync = useCallback(async () => {
    if (!isOnline) {
      toast.error('No internet connection')
      return
    }

    setStatus('syncing')
    try {
      const { pushToCloud, pullFromCloud, saveSyncMeta } = await import('@/services/supabase')

      const pushResult = await pushToCloud()
      if (!pushResult.success) {
        setStatus('error')
        toast.error(`Push failed: ${pushResult.message}`)
        return
      }

      const pullResult = await pullFromCloud(undefined, 'merge')
      if (!pullResult.success) {
        setStatus('error')
        toast.error(`Pull failed: ${pullResult.message}`)
        return
      }

      const totalPushed = pushResult.tables.reduce((s: number, t: any) => s + t.pushed, 0)
      const totalPulled = pullResult.tables.reduce((s: number, t: any) => s + t.pulled, 0)

      setLastSync(new Date().toISOString())
      clearQueue()
      setStatus('connected')

      saveSyncMeta({
        lastPushAt: new Date().toISOString(),
        lastPullAt: new Date().toISOString(),
        lastSyncStatus: 'success',
        connected: true,
        lastError: null,
      })

      toast.success(`Sync complete: ${totalPushed} pushed, ${totalPulled} pulled`)
    } catch (err: any) {
      setStatus('error')
      toast.error(`Sync failed: ${err.message}`)
    }
  }, [isOnline, setLastSync, clearQueue])

  // Check connection on mount and when online status changes
  useEffect(() => {
    if (isOnline) {
      checkConnection()
    } else {
      setStatus('offline')
    }
  }, [isOnline, checkConnection])

  // Close tooltip on outside click
  useEffect(() => {
    if (!showTooltip) return
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTooltip])

  // ── Status display config ──
  const statusConfig: Record<SyncStatus, { icon: any; color: string; label: string; bg: string }> = {
    connected: { icon: Cloud, color: 'text-emerald-400', label: 'Cloud Connected', bg: 'bg-emerald-500/10 border-emerald-500/30' },
    syncing:   { icon: RefreshCw, color: 'text-blue-400', label: 'Syncing...', bg: 'bg-blue-500/10 border-blue-500/30' },
    offline:   { icon: WifiOff, color: 'text-red-400', label: 'Offline', bg: 'bg-red-500/10 border-red-500/30' },
    error:     { icon: AlertCircle, color: 'text-amber-400', label: 'Sync Error', bg: 'bg-amber-500/10 border-amber-500/30' },
    idle:      { icon: CloudOff, color: 'text-muted-foreground', label: 'Not Configured', bg: 'bg-muted border-border' },
  }

  const cfg = statusConfig[status]
  const Icon = cfg.icon

  return (
    <div className="relative" ref={tooltipRef}>
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${cfg.bg} ${cfg.color}`}
      >
        {status === 'syncing' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Icon className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">{cfg.label}</span>
        {pendingCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
            {pendingCount}
          </span>
        )}
      </button>

      {/* ── Expanded tooltip/panel ── */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-popover border border-border rounded-lg shadow-xl z-[300] overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Supabase Cloud Sync</span>
              <span className={`flex items-center gap-1 text-[11px] ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-emerald-400' : status === 'syncing' ? 'bg-blue-400 animate-pulse' : status === 'offline' ? 'bg-red-400' : status === 'error' ? 'bg-amber-400' : 'bg-muted-foreground'}`} />
                {cfg.label}
              </span>
            </div>
          </div>

          <div className="p-3 space-y-2">
            {/* Last sync time */}
            {lastSyncAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="w-3 h-3 text-emerald-500" />
                Last synced: {new Date(lastSyncAt).toLocaleString()}
              </div>
            )}

            {/* Pending items */}
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertCircle className="w-3 h-3" />
                {pendingCount} pending change(s) to sync
              </div>
            )}

            {/* No pending */}
            {pendingCount === 0 && status === 'connected' && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <Check className="w-3 h-3" />
                All data is up to date
              </div>
            )}

            {/* Online/Offline status */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3 text-red-400" />}
              {isOnline ? 'Internet: Connected' : 'Internet: Disconnected'}
            </div>
          </div>

          <div className="p-3 border-t border-border bg-muted/30 space-y-1.5">
            <button
              onClick={handleFullSync}
              disabled={status === 'syncing' || !isOnline}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'syncing' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...</>
              ) : (
                <><RefreshCw className="w-3.5 h-3.5" /> Sync Now</>
              )}
            </button>
            <button
              onClick={checkConnection}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Test Connection
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
