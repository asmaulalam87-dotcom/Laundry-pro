import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useUIStore } from '@/stores/ui-store'
import { toast } from 'sonner'
import { seedDemoData, clearAllData } from '@/services/seed-data'
import {
  loadBackupConfig,
  saveBackupConfig,
  createBackup,
  listBackups,
  getBackup,
  restoreFromBackup,
  deleteBackup,
  downloadBackup,
  importBackupFromFile,
  startBackupScheduler,
  stopBackupScheduler,
  getBackupStatus,
  type BackupConfig,
  type AutoBackupRecord,
} from '@/services/auto-backup'
import { SupabaseSyncPanel } from '@/components/supabase/SupabaseSyncPanel'

// ── Signature config types ────────────────────────────────────────────────────
interface SignatureSlot {
  label: string
  name: string
}
type ReportSigConfig = Record<string, SignatureSlot[]>

const REPORT_SIG_KEYS = [
  { key: 'laundry_recipe', label: 'Laundry Recipe Sheet' },
  { key: 'laundry_recipe_simple', label: 'Simple Recipe Sheet' },
  { key: 'washing_cost', label: 'Washing Cost Sheet' },
  { key: 'technical_spec', label: 'Technical Spec Sheet' },
]

const DEFAULT_SIG_CONFIG: ReportSigConfig = {
  laundry_recipe: [
    { label: 'Prepared By', name: '' },
    { label: 'Checked By', name: '' },
    { label: 'Approved By', name: '' },
  ],
  laundry_recipe_simple: [
    { label: 'Prepared By', name: '' },
    { label: 'Checked By', name: '' },
    { label: 'Approved By', name: '' },
  ],
  washing_cost: [
    { label: 'Prepared By', name: '' },
    { label: 'Approved By', name: '' },
    { label: 'Head of Factory', name: '' },
    { label: 'Received By', name: '' },
  ],
  technical_spec: [
    { label: 'Prepared By', name: '' },
    { label: 'Checked By', name: '' },
    { label: 'Approved By', name: '' },
  ],
}

function loadSigConfig(): ReportSigConfig {
  try {
    const raw = localStorage.getItem('report_signature_config')
    if (raw) return JSON.parse(raw)
  } catch {}
  return DEFAULT_SIG_CONFIG
}

export const Settings = () => {
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useUIStore()
  const [seeding, setSeeding] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [companyName, setCompanyName] = useState(localStorage.getItem('company_name') || '')
  const [companyAddress, setCompanyAddress] = useState(localStorage.getItem('company_address') || '')
  const [companyPhone, setCompanyPhone] = useState(localStorage.getItem('company_phone') || '')
  const [sigConfig, setSigConfig] = useState<ReportSigConfig>(loadSigConfig)
  const [sigExpanded, setSigExpanded] = useState<string>('laundry_recipe')

  // ── Backup state ─────────────────────────────────────────────────────────
  const [backupConfig, setBackupConfig] = useState<BackupConfig>(loadBackupConfig)
  const [backups, setBackups] = useState<Omit<AutoBackupRecord, 'data'>[]>([])
  const [backupStatus, setBackupStatus] = useState(getBackupStatus())
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load backups list on mount
  useEffect(() => {
    listBackups().then(setBackups)
    // Refresh backup status every minute
    const interval = setInterval(() => setBackupStatus(getBackupStatus()), 60000)
    return () => clearInterval(interval)
  }, [])

  const handleSaveBackupConfig = () => {
    const cfg = { ...backupConfig }
    if (cfg.enabled) {
      cfg.nextBackupAt = new Date(Date.now() + cfg.intervalMinutes * 60000).toISOString()
    } else {
      cfg.nextBackupAt = null
    }
    saveBackupConfig(cfg)
    setBackupConfig(cfg)
    setBackupStatus(getBackupStatus())
    // Restart scheduler with new config
    if (cfg.enabled) {
      startBackupScheduler()
      toast.success(`Auto-backup enabled — every ${cfg.intervalMinutes} min`)
    } else {
      stopBackupScheduler()
      toast.success('Auto-backup disabled')
    }
  }

  const handleCreateBackupNow = async () => {
    setCreatingBackup(true)
    try {
      const backup = await createBackup('Manual backup')
      toast.success(`Backup created: ${backup.totalRecords} records, ${backup.sizeKB}KB`)
      listBackups().then(setBackups)
      setBackupStatus(getBackupStatus())
    } catch (err: any) {
      toast.error('Backup failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleRestoreBackup = async (id: number) => {
    if (!confirm('Restore this backup? This will REPLACE all current data with the backup data.')) return
    setRestoringBackup(id)
    try {
      const result = await restoreFromBackup(id)
      if (result.success) {
        toast.success(result.message)
        setTimeout(() => window.location.reload(), 1500)
      } else {
        toast.error(result.message)
      }
    } catch (err: any) {
      toast.error('Restore failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setRestoringBackup(null)
    }
  }

  const handleDeleteBackup = async (id: number) => {
    if (!confirm('Delete this backup? This cannot be undone.')) return
    await deleteBackup(id)
    listBackups().then(setBackups)
    toast.success('Backup deleted')
  }

  const handleDownloadBackup = async (id: number) => {
    const backup = await getBackup(id)
    if (backup) downloadBackup(backup)
    else toast.error('Backup not found')
  }

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const backup = await importBackupFromFile(file)
      toast.success(`Imported backup: ${backup.totalRecords} records, ${backup.sizeKB}KB`)
      listBackups().then(setBackups)
    } catch (err: any) {
      toast.error('Import failed: ' + (err?.message || 'Invalid file'))
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSaveCompany = () => {
    localStorage.setItem('company_name', companyName.trim())
    localStorage.setItem('company_address', companyAddress.trim())
    localStorage.setItem('company_phone', companyPhone.trim())
    toast.success('Company profile saved')
  }

  const handleSaveSigConfig = () => {
    localStorage.setItem('report_signature_config', JSON.stringify(sigConfig))
    toast.success('Signature configuration saved for all reports')
  }

  const updateSigSlot = (reportKey: string, slotIdx: number, field: 'label' | 'name', value: string) => {
    setSigConfig(prev => {
      const slots = [...(prev[reportKey] || [])]
      slots[slotIdx] = { ...slots[slotIdx], [field]: value }
      return { ...prev, [reportKey]: slots }
    })
  }

  const addSigSlot = (reportKey: string) => {
    setSigConfig(prev => ({
      ...prev,
      [reportKey]: [...(prev[reportKey] || []), { label: 'New Role', name: '' }],
    }))
  }

  const removeSigSlot = (reportKey: string, slotIdx: number) => {
    setSigConfig(prev => ({
      ...prev,
      [reportKey]: (prev[reportKey] || []).filter((_, i) => i !== slotIdx),
    }))
  }

  const handleClearData = async () => {
    if (confirm('Are you sure? This will delete ALL local recipe, chemical, and costing data.')) {
      setClearing(true)
      try {
        await clearAllData()
        toast.success('All data cleared successfully')
        setTimeout(() => window.location.reload(), 800)
      } catch {
        toast.error('Failed to clear data')
      } finally {
        setClearing(false)
      }
    }
  }

  // ── Hard Reset: completely delete and recreate IndexedDB ──────────────────────
  const handleHardReset = async () => {
    if (!confirm('⚠️ HARD RESET: This will completely delete the database and reload all demo data. Continue?')) return
    setResetting(true)
    try {
      toast.info('Deleting database…')
      // Close any open Dexie connections first
      const { db } = await import('@/services/local-db')
      db.close()
      // Delete the entire IndexedDB database
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('RecipeSystemDB')
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
        req.onblocked = () => {
          // Force resolve even if blocked — the reload will finish cleanup
          resolve()
        }
      })
      toast.success('Database deleted. Reloading with fresh demo data…')
      // Reload — App.tsx will auto-seed on fresh DB
      setTimeout(() => window.location.reload(), 800)
    } catch (err: any) {
      toast.error('Hard reset failed: ' + (err?.message || 'unknown error'))
      setResetting(false)
    }
  }

  const handleLoadDemoData = async () => {
    setSeeding(true)
    try {
      const result = await seedDemoData(true) // force=true to reload fresh
      if (result.success) {
        toast.success(result.message)
        setTimeout(() => window.location.reload(), 1200)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('Failed to load demo data')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings & Admin</h1>
        <p className="text-muted-foreground mt-1">Configure your system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ── Company Profile ─────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 md:col-span-2">
          <h2 className="text-xl font-semibold">🏭 Company Profile</h2>
          <p className="text-xs text-muted-foreground">
            This name appears on all printed reports (Laundry Recipe Sheet, Washing Cost Sheet, etc.)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Company Name</label>
              <input
                type="text"
                placeholder="e.g. ABC Washing Ltd."
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                placeholder="e.g. Dhaka EPZ, Bangladesh"
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone / Email</label>
              <input
                type="text"
                placeholder="e.g. +880-2-xxx / info@company.com"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <button
            onClick={handleSaveCompany}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold"
          >
            💾 Save Company Profile
          </button>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">User Profile</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium capitalize">{user?.role}</span>
            </div>
          </div>
          <button onClick={logout} className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
            Logout
          </button>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">Appearance</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 px-4 py-3 rounded-lg border-2 ${theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border'}`}
            >
              🌙 Dark Mode
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 px-4 py-3 rounded-lg border-2 ${theme === 'light' ? 'border-primary bg-primary/10' : 'border-border'}`}
            >
              ☀️ Light Mode
            </button>
          </div>
        </div>

        {/* ── Supabase Cloud Sync ─────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 md:col-span-2">
          <h2 className="text-xl font-semibold">☁️ Supabase Cloud Sync</h2>
          <p className="text-xs text-muted-foreground">
            Connect to your Supabase project to sync data between local storage and the cloud.
            Push local data up, pull cloud data down, or do a full bidirectional sync.
          </p>
          <SupabaseSyncPanel />
        </div>

        {/* ── Report Signature Configuration ─────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 md:col-span-2">
          <h2 className="text-xl font-semibold">✍️ Report Signatures</h2>
          <p className="text-xs text-muted-foreground">
            Configure signature labels and person names for each report. Names appear printed above the signature line.
          </p>

          {/* Report selector tabs */}
          <div className="flex gap-2 flex-wrap">
            {REPORT_SIG_KEYS.map(r => (
              <button
                key={r.key}
                onClick={() => setSigExpanded(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  sigExpanded === r.key
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Signature slots for selected report */}
          {sigExpanded && sigConfig[sigExpanded] && (
            <div className="space-y-2">
              {sigConfig[sigExpanded].map((slot, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    placeholder="Label (e.g. Prepared By)"
                    value={slot.label}
                    onChange={e => updateSigSlot(sigExpanded, idx, 'label', e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Person name (optional, prints above signature line)"
                    value={slot.name}
                    onChange={e => updateSigSlot(sigExpanded, idx, 'name', e.target.value)}
                    className="flex-[2] px-3 py-1.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => removeSigSlot(sigExpanded, idx)}
                    className="text-red-400 hover:text-red-300 text-sm font-bold px-1"
                    title="Remove this slot"
                  >✕</button>
                </div>
              ))}
              <button
                onClick={() => addSigSlot(sigExpanded)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-1"
              >+ Add Signature Slot</button>
            </div>
          )}

          <button
            onClick={handleSaveSigConfig}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold"
          >
            💾 Save Signature Configuration
          </button>
        </div>

        {/* ── Auto-Backup Configuration ──────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 md:col-span-2">
          <h2 className="text-xl font-semibold">Auto-Backup System</h2>
          <p className="text-xs text-muted-foreground">
            Automatically back up your database at scheduled intervals. Backups are stored locally and can be restored anytime.
          </p>

          {/* Status bar */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
            backupStatus.enabled
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-muted border-border'
          }`}>
            <div className={`w-3 h-3 rounded-full ${backupStatus.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm font-semibold">
              {backupStatus.enabled ? 'Auto-Backup Active' : 'Auto-Backup Off'}
            </span>
            {backupStatus.enabled && backupStatus.minutesUntilNext !== null && (
              <span className="text-xs text-muted-foreground ml-auto">
                Next backup in {backupStatus.minutesUntilNext} min
              </span>
            )}
            {backupStatus.lastBackupAt && (
              <span className="text-xs text-muted-foreground">
                Last: {new Date(backupStatus.lastBackupAt).toLocaleString()}
              </span>
            )}
          </div>

          {/* Config controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Enable Auto-Backup</label>
              <button
                onClick={() => setBackupConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  backupConfig.enabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-muted-foreground border border-border'
                }`
              }
              >
                {backupConfig.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Interval</label>
              <select
                value={backupConfig.intervalMinutes}
                onChange={e => setBackupConfig(prev => ({ ...prev, intervalMinutes: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={5}>Every 5 minutes</option>
                <option value={10}>Every 10 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 1 hour</option>
                <option value={120}>Every 2 hours</option>
                <option value={360}>Every 6 hours</option>
                <option value={720}>Every 12 hours</option>
                <option value={1440}>Every 24 hours</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Backups</label>
              <select
                value={backupConfig.maxBackups}
                onChange={e => setBackupConfig(prev => ({ ...prev, maxBackups: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={5}>Keep last 5</option>
                <option value={10}>Keep last 10</option>
                <option value={20}>Keep last 20</option>
                <option value={50}>Keep last 50</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Auto Download</label>
              <button
                onClick={() => setBackupConfig(prev => ({ ...prev, autoDownload: !prev.autoDownload }))}
                className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                  backupConfig.autoDownload
                    ? 'bg-indigo-600 text-white'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {backupConfig.autoDownload ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSaveBackupConfig}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold"
            >
              Save Backup Settings
            </button>
            <button
              onClick={handleCreateBackupNow}
              disabled={creatingBackup}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
            >
              {creatingBackup ? 'Creating...' : 'Backup Now'}
            </button>
          </div>
        </div>

        {/* ── Backup History & Restore ─────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Backup History</h2>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
              >
                Import Backup File
              </button>
            </div>
          </div>

          {backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No backups yet</p>
              <p className="text-xs mt-1">Enable auto-backup above or click "Backup Now" to create your first backup</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {backups.map((b: any) => (
                <div
                  key={b.id}
                  className="flex items-center gap-4 p-3 bg-muted/50 border border-border rounded-lg hover:border-indigo-500/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{b.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold">
                        {b.totalRecords} records
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-semibold">
                        {b.sizeKB} KB
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(b.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleDownloadBackup(b.id)}
                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleRestoreBackup(b.id)}
                      disabled={restoringBackup === b.id}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-[10px] font-semibold"
                    >
                      {restoringBackup === b.id ? 'Restoring...' : 'Restore'}
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(b.id)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4 md:col-span-2">
          <h2 className="text-xl font-semibold">Data Management</h2>

          {/* ── Hard Reset (PRIMARY FIX) ───────────────────── */}
          <div className="bg-orange-500/10 border border-orange-500/40 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔄</span>
              <div>
                <p className="font-semibold text-sm text-orange-400">Hard Reset Database</p>
                <p className="text-xs text-muted-foreground">
                  Completely deletes &amp; recreates the database, then loads fresh demo data.
                  Use this if data is not loading or the app shows errors.
                </p>
              </div>
            </div>
            <button
              onClick={handleHardReset}
              disabled={resetting}
              className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
            >
              {resetting ? '⏳ Resetting…' : '🔄 Hard Reset + Load Demo Data'}
            </button>
          </div>

          {/* Demo Data Loader */}
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧪</span>
              <div>
                <p className="font-semibold text-sm">Load Demo / Testing Data</p>
                <p className="text-xs text-muted-foreground">Overwrites current data with 6 recipes, 15 chemicals, 12 processes &amp; costings</p>
              </div>
            </div>
            <button
              onClick={handleLoadDemoData}
              disabled={seeding}
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {seeding ? '⏳ Loading Demo Data...' : '🚀 Load Demo Data (Overwrite)'}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="border border-red-500/30 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-red-400">⚠️ Danger Zone</p>
            <button
              onClick={handleClearData}
              disabled={clearing}
              className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg"
            >
              {clearing ? '⏳ Clearing...' : '🗑️ Clear All Local Data'}
            </button>
            <p className="text-xs text-muted-foreground">Permanently deletes all recipes, chemicals, costings, and settings</p>
          </div>
        </div>
      </div>
    </div>
  )
}

