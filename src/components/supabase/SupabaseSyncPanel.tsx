import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  loadSupabaseConfig,
  saveSupabaseConfig,
  loadSyncMeta,
  testConnection,
  pushToCloud,
  pullFromCloud,
  fullSync,
  getRemoteCounts,
  getLocalCounts,
  generateSchemaSQL,
  type SupabaseConfig,
  type SyncMeta,
  type SyncResult,
} from '@/services/supabase'
import {
  Cloud,
  CloudOff,
  Upload,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Copy,
  Database,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

export function SupabaseSyncPanel() {
  const [config, setConfig] = useState<SupabaseConfig>(loadSupabaseConfig())
  const [syncMeta, setSyncMeta] = useState<SyncMeta>(loadSyncMeta())
  const [testing, setTesting] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({})
  const [remoteCounts, setRemoteCounts] = useState<Record<string, number>>({})
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [showSchema, setShowSchema] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [pullMode, setPullMode] = useState<'merge' | 'replace'>('merge')

  const refreshCounts = useCallback(async () => {
    const [local, remote] = await Promise.all([getLocalCounts(), getRemoteCounts()])
    setLocalCounts(local)
    setRemoteCounts(remote)
  }, [])

  useEffect(() => {
    refreshCounts()
  }, [refreshCounts])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleSaveConfig = () => {
    saveSupabaseConfig(config)
    toast.success('Supabase configuration saved')
    setSyncMeta(loadSyncMeta())
  }

  const handleTestConnection = async () => {
    setTesting(true)
    const result = await testConnection()
    setTesting(false)

    if (result.success) {
      toast.success(result.error ? result.error : 'Connection successful!')
      setSyncMeta(loadSyncMeta())
      refreshCounts()
    } else {
      toast.error(result.error || 'Connection failed')
      setSyncMeta(loadSyncMeta())
    }
  }

  const handlePush = async () => {
    if (!confirm('Push all local data to Supabase? This will upsert (create or update) records in the cloud.')) return
    setPushing(true)
    try {
      const result = await pushToCloud()
      setLastResult(result)
      setShowResult(true)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      setSyncMeta(loadSyncMeta())
      refreshCounts()
    } catch (err: any) {
      toast.error('Push failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setPushing(false)
    }
  }

  const handlePull = async () => {
    const modeLabel = pullMode === 'replace' ? 'REPLACE all local data' : 'merge (update existing + add new)'
    if (!confirm(`Pull from Supabase? Mode: ${modeLabel}. Continue?`)) return
    setPulling(true)
    try {
      const result = await pullFromCloud(undefined, pullMode)
      setLastResult(result)
      setShowResult(true)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      setSyncMeta(loadSyncMeta())
      refreshCounts()
    } catch (err: any) {
      toast.error('Pull failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setPulling(false)
    }
  }

  const handleFullSync = async () => {
    if (!confirm('Full bidirectional sync? This will push local → cloud AND pull cloud → local for all tables.')) return
    setSyncing(true)
    try {
      const result = await fullSync()
      setLastResult(result)
      setShowResult(true)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      setSyncMeta(loadSyncMeta())
      refreshCounts()
    } catch (err: any) {
      toast.error('Sync failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setSyncing(false)
    }
  }

  const handleCopySchema = () => {
    navigator.clipboard.writeText(generateSchemaSQL())
    toast.success('SQL schema copied to clipboard! Paste it in Supabase SQL Editor.')
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const isConfigured = !!(config.url && config.anonKey)
  const isConnected = syncMeta.connected

  const TABLE_LABELS: Record<string, string> = {
    recipes: 'Recipes',
    recipe_steps: 'Recipe Steps',
    recipe_step_chemicals: 'Step Chemicals',
    chemicals: 'Chemicals',
    processes: 'Processes',
    process_chemicals: 'Process Chemicals',
    costing_records: 'Costing Records',
    dropdown_options: 'Dropdown Options',
    users: 'Users',
    app_settings: 'App Settings',
    recipe_templates: 'Recipe Templates',
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleString()
  }

  return (
    <div className="space-y-4">
      {/* ── Connection Configuration ────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            {isConnected ? (
              <Cloud className="w-5 h-5 text-emerald-400" />
            ) : (
              <CloudOff className="w-5 h-5 text-muted-foreground" />
            )}
            Supabase Cloud Sync
          </h3>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-muted text-muted-foreground border border-border'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-gray-400'}`} />
            {isConnected ? 'Connected' : 'Not Connected'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Project URL</label>
            <input
              type="text"
              placeholder="https://xxxx.supabase.co"
              value={config.url}
              onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Anon / Public Key</label>
            <input
              type="password"
              placeholder="eyJh..."
              value={config.anonKey}
              onChange={e => setConfig(prev => ({ ...prev, anonKey: e.target.value }))}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveConfig}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold"
          >
            Save Configuration
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testing || !isConfigured}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Test Connection
          </button>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-muted hover:bg-muted/70 border border-border rounded-lg text-sm flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Dashboard
          </a>
        </div>
      </div>

      {/* ── Sync Status ─────────────────────────────────────────────────── */}
      {isConnected && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-indigo-400" />
            Sync Status
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Last Push</div>
              <div className="text-sm font-semibold mt-1">{formatTime(syncMeta.lastPushAt)}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Last Pull</div>
              <div className="text-sm font-semibold mt-1">{formatTime(syncMeta.lastPullAt)}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="text-sm font-semibold mt-1 flex items-center justify-center gap-1">
                {syncMeta.lastSyncStatus === 'success' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                {syncMeta.lastSyncStatus === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                {syncMeta.lastSyncStatus === 'idle' && <CloudOff className="w-3.5 h-3.5 text-muted-foreground" />}
                {syncMeta.lastSyncStatus === 'success' ? 'OK' : syncMeta.lastSyncStatus === 'error' ? 'Error' : 'Idle'}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Error</div>
              <div className="text-sm font-semibold mt-1 truncate" title={syncMeta.lastError || ''}>
                {syncMeta.lastError || 'None'}
              </div>
            </div>
          </div>

          {/* Sync actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <button
              onClick={handlePush}
              disabled={pushing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Push to Cloud
            </button>
            <button
              onClick={handlePull}
              disabled={pulling}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              {pulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Pull from Cloud
            </button>
            <button
              onClick={handleFullSync}
              disabled={syncing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpDown className="w-4 h-4" />}
              Full Sync
            </button>

            {/* Pull mode toggle */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Pull mode:</span>
              <button
                onClick={() => setPullMode('merge')}
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  pullMode === 'merge' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                Merge
              </button>
              <button
                onClick={() => setPullMode('replace')}
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  pullMode === 'replace' ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Record Count Comparison ─────────────────────────────────────── */}
      {isConnected && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              Record Count Comparison
            </h3>
            <button
              onClick={refreshCounts}
              className="px-3 py-1 bg-muted hover:bg-muted/70 border border-border rounded-lg text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground px-1">
            <span>Table</span>
            <span className="text-center">Local</span>
            <span className="text-center">Cloud</span>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {Object.keys(TABLE_LABELS).map(table => {
              const local = localCounts[table] ?? 0
              const remote = remoteCounts[table] ?? 0
              const diff = local !== remote
              return (
                <div
                  key={table}
                  className={`grid grid-cols-3 gap-2 px-3 py-2 rounded-lg text-sm ${
                    diff ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-muted/30'
                  }`}
                >
                  <span className="font-medium truncate">{TABLE_LABELS[table]}</span>
                  <span className={`text-center ${diff && local > remote ? 'text-blue-400 font-semibold' : ''}`}>
                    {local}
                  </span>
                  <span className={`text-center ${diff && remote > local ? 'text-emerald-400 font-semibold' : ''}`}>
                    {remote}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Last Sync Result ─────────────────────────────────────────────── */}
      {showResult && lastResult && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              {lastResult.success ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              Sync Result
            </h3>
            <button
              onClick={() => setShowResult(false)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Close
            </button>
          </div>
          <p className="text-sm">{lastResult.message}</p>
          <div className="space-y-1">
            {lastResult.tables.map(t => (
              <div key={t.name} className={`flex items-center gap-3 px-3 py-1.5 rounded text-sm ${
                t.error ? 'bg-red-500/5 border border-red-500/20' : 'bg-muted/30'
              }`}>
                <span className="font-medium flex-1">{TABLE_LABELS[t.name] || t.name}</span>
                {t.pushed > 0 && <span className="text-blue-400 text-xs">↑ {t.pushed} pushed</span>}
                {t.pulled > 0 && <span className="text-emerald-400 text-xs">↓ {t.pulled} pulled</span>}
                {t.error && <span className="text-red-400 text-xs truncate max-w-[200px]" title={t.error}>{t.error}</span>}
                {!t.error && t.pushed === 0 && t.pulled === 0 && (
                  <span className="text-muted-foreground text-xs">No changes</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SQL Schema ───────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <button
          onClick={() => setShowSchema(!showSchema)}
          className="w-full flex items-center justify-between font-semibold"
        >
          <span className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-400" />
            Database Schema Setup
          </span>
          {showSchema ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {showSchema && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              If you haven't set up your Supabase database yet, copy this SQL and paste it into the
              Supabase SQL Editor to create all required tables with Row Level Security policies.
            </p>
            <button
              onClick={handleCopySchema}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy SQL Schema to Clipboard
            </button>
            <pre className="bg-gray-950 border border-border rounded-lg p-4 text-xs overflow-x-auto max-h-80 text-gray-300">
              {generateSchemaSQL()}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
