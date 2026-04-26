/**
 * Auto-Backup Service
 * 
 * Exports all IndexedDB tables to JSON, stores backups in:
 *   1. IndexedDB table "auto_backups" (for restore within app)
 *   2. Optional download as .json file
 * 
 * Scheduler runs inside the app and triggers backup at configured intervals.
 */

import { db } from './local-db'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AutoBackupRecord {
  id?: number            // auto-increment
  timestamp: string      // ISO string
  label: string          // user label or auto-generated
  tables: string[]       // which tables were backed up
  recordCounts: Record<string, number>
  totalRecords: number
  sizeKB: number         // approximate size
  data: string           // JSON stringified backup data
}

export interface BackupConfig {
  enabled: boolean
  intervalMinutes: number   // 5, 10, 15, 30, 60, 120, 360, 720, 1440
  maxBackups: number        // keep last N backups (oldest auto-deleted)
  autoDownload: boolean     // also download file on each backup
  lastBackupAt: string | null
  nextBackupAt: string | null
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: false,
  intervalMinutes: 60,
  maxBackups: 10,
  autoDownload: false,
  lastBackupAt: null,
  nextBackupAt: null,
}

const BACKUP_TABLES = [
  'recipes',
  'recipe_steps',
  'recipe_step_chemicals',
  'recipe_templates',
  'chemicals',
  'processes',
  'process_chemicals',
  'costing_records',
  'dropdown_options',
  'users',
  'app_settings',
  'templates',
]

// ── Config helpers (localStorage) ──────────────────────────────────────────────

export function loadBackupConfig(): BackupConfig {
  try {
    const raw = localStorage.getItem('auto_backup_config')
    if (raw) return { ...DEFAULT_BACKUP_CONFIG, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_BACKUP_CONFIG }
}

export function saveBackupConfig(config: BackupConfig): void {
  localStorage.setItem('auto_backup_config', JSON.stringify(config))
}

// ── Core backup functions ──────────────────────────────────────────────────────

/**
 * Export all data from IndexedDB tables into a JSON structure.
 */
export async function exportAllData(): Promise<{
  data: Record<string, any[]>
  recordCounts: Record<string, number>
  totalRecords: number
}> {
  const data: Record<string, any[]> = {}
  const recordCounts: Record<string, number> = {}
  let totalRecords = 0

  for (const table of BACKUP_TABLES) {
    try {
      const rows = await (db as any)[table].toArray()
      data[table] = rows
      recordCounts[table] = rows.length
      totalRecords += rows.length
    } catch {
      data[table] = []
      recordCounts[table] = 0
    }
  }

  return { data, recordCounts, totalRecords }
}

/**
 * Create a full backup and store it in the auto_backups IndexedDB table.
 * Returns the backup record (without the full data blob for display).
 */
export async function createBackup(label?: string): Promise<AutoBackupRecord> {
  const { data, recordCounts, totalRecords } = await exportAllData()
  const jsonStr = JSON.stringify(data, null, 0) // compact — no pretty-print
  const sizeKB = Math.round(new Blob([jsonStr]).size / 1024)

  const backup: AutoBackupRecord = {
    timestamp: new Date().toISOString(),
    label: label || `Auto-backup ${new Date().toLocaleString()}`,
    tables: BACKUP_TABLES,
    recordCounts,
    totalRecords,
    sizeKB,
    data: jsonStr,
  }

  // Store in IndexedDB auto_backups table (Dexie dynamic table)
  const backupId = await (db as any).table('auto_backups').add(backup)
  backup.id = backupId

  // Enforce max backups — delete oldest auto-backups exceeding the limit
  await pruneOldBackups()

  // Update config with last backup time
  const config = loadBackupConfig()
  config.lastBackupAt = backup.timestamp
  config.nextBackupAt = new Date(Date.now() + config.intervalMinutes * 60000).toISOString()
  saveBackupConfig(config)

  return backup
}

/**
 * Prune old backups to stay within the maxBackups limit.
 */
async function pruneOldBackups(): Promise<void> {
  const config = loadBackupConfig()
  try {
    const all = await (db as any).table('auto_backups').orderBy('id').toArray()
    if (all.length > config.maxBackups) {
      const toDelete = all.slice(0, all.length - config.maxBackups).map((b: any) => b.id)
      await (db as any).table('auto_backups').bulkDelete(toDelete)
    }
  } catch {}
}

/**
 * Get all stored backup records (metadata only, no data blob for performance).
 */
export async function listBackups(): Promise<Omit<AutoBackupRecord, 'data'>[]> {
  try {
    const all = await (db as any).table('auto_backups').orderBy('id').reverse().toArray()
    return all.map((b: any) => {
      const { data, ...meta } = b
      return meta
    })
  } catch {
    return []
  }
}

/**
 * Get a specific backup by ID (including the full data blob for restore).
 */
export async function getBackup(id: number): Promise<AutoBackupRecord | null> {
  try {
    const record = await (db as any).table('auto_backups').get(id)
    return record || null
  } catch {
    return null
  }
}

/**
 * Restore data from a backup record.
 * Clears existing data and replaces with backup data.
 */
export async function restoreFromBackup(backupId: number): Promise<{
  success: boolean
  message: string
  restoredCounts: Record<string, number>
}> {
  const backup = await getBackup(backupId)
  if (!backup || !backup.data) {
    return { success: false, message: 'Backup not found or has no data', restoredCounts: {} }
  }

  try {
    const data: Record<string, any[]> = JSON.parse(backup.data)
    const restoredCounts: Record<string, number> = {}

    for (const table of BACKUP_TABLES) {
      if (!data[table]) continue
      try {
        // Clear existing data
        await (db as any)[table].clear()
        // Insert backup data
        if (data[table].length > 0) {
          // For auto-increment tables (dropdown_options), strip the id field
          if (table === 'dropdown_options') {
            const cleaned = data[table].map((row: any) => {
              const { id, ...rest } = row
              return rest
            })
            await (db as any)[table].bulkAdd(cleaned)
          } else {
            await (db as any)[table].bulkPut(data[table])
          }
        }
        restoredCounts[table] = data[table].length
      } catch (err: any) {
        console.warn(`[Restore] Error restoring ${table}:`, err?.message)
        restoredCounts[table] = -1 // flag as error
      }
    }

    return {
      success: true,
      message: `Restored ${Object.values(restoredCounts).filter(v => v >= 0).reduce((a, b) => a + b, 0)} records from backup dated ${new Date(backup.timestamp).toLocaleString()}`,
      restoredCounts,
    }
  } catch (err: any) {
    return { success: false, message: `Restore failed: ${err?.message}`, restoredCounts: {} }
  }
}

/**
 * Delete a specific backup by ID.
 */
export async function deleteBackup(id: number): Promise<void> {
  await (db as any).table('auto_backups').delete(id)
}

/**
 * Download a backup as a JSON file.
 */
export function downloadBackup(backup: AutoBackupRecord): void {
  const filename = `laundry-pro-backup-${backup.timestamp.replace(/[:.]/g, '-')}.json`
  const blob = new Blob([backup.data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Import a backup from a JSON file.
 */
export function importBackupFromFile(file: File): Promise<AutoBackupRecord> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const jsonStr = e.target?.result as string
        const data = JSON.parse(jsonStr)
        const recordCounts: Record<string, number> = {}
        let totalRecords = 0
        for (const [table, rows] of Object.entries(data)) {
          recordCounts[table] = Array.isArray(rows) ? rows.length : 0
          totalRecords += recordCounts[table]
        }
        const sizeKB = Math.round(new Blob([jsonStr]).size / 1024)
        const backup: AutoBackupRecord = {
          timestamp: new Date().toISOString(),
          label: `Imported: ${file.name}`,
          tables: Object.keys(data),
          recordCounts,
          totalRecords,
          sizeKB,
          data: jsonStr,
        }
        const id = await (db as any).table('auto_backups').add(backup)
        backup.id = id
        resolve(backup)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

// ── Scheduler ──────────────────────────────────────────────────────────────────

let schedulerTimer: ReturnType<typeof setInterval> | null = null

/**
 * Start the auto-backup scheduler. Call once on app load.
 */
export function startBackupScheduler(): void {
  stopBackupScheduler()

  const config = loadBackupConfig()
  if (!config.enabled) return

  // Calculate when the next backup should run
  const runBackup = async () => {
    try {
      const cfg = loadBackupConfig()
      if (!cfg.enabled) {
        stopBackupScheduler()
        return
      }

      console.log('[AutoBackup] Running scheduled backup...')
      const backup = await createBackup()
      console.log(`[AutoBackup] Backup created: ${backup.totalRecords} records, ${backup.sizeKB}KB`)

      // Auto-download if configured
      if (cfg.autoDownload) {
        downloadBackup(backup)
      }
    } catch (err) {
      console.error('[AutoBackup] Failed:', err)
    }
  }

  // Check if we need to run immediately (missed backup)
  if (config.nextBackupAt) {
    const nextTime = new Date(config.nextBackupAt).getTime()
    const now = Date.now()
    if (nextTime <= now) {
      // Missed backup — run immediately
      runBackup()
    }
  }

  // Set interval (check every minute if it's time to backup)
  schedulerTimer = setInterval(() => {
    const cfg = loadBackupConfig()
    if (!cfg.enabled) {
      stopBackupScheduler()
      return
    }

    if (cfg.nextBackupAt) {
      const nextTime = new Date(cfg.nextBackupAt).getTime()
      if (Date.now() >= nextTime) {
        runBackup()
      }
    } else {
      // No next backup scheduled — schedule one now
      runBackup()
    }
  }, 60000) // check every minute

  console.log(`[AutoBackup] Scheduler started — interval: ${config.intervalMinutes}min`)
}

/**
 * Stop the auto-backup scheduler.
 */
export function stopBackupScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
    console.log('[AutoBackup] Scheduler stopped')
  }
}

/**
 * Get scheduler status info.
 */
export function getBackupStatus(): {
  enabled: boolean
  lastBackupAt: string | null
  nextBackupAt: string | null
  minutesUntilNext: number | null
} {
  const config = loadBackupConfig()
  let minutesUntilNext: number | null = null

  if (config.enabled && config.nextBackupAt) {
    minutesUntilNext = Math.max(0, Math.round((new Date(config.nextBackupAt).getTime() - Date.now()) / 60000))
  }

  return {
    enabled: config.enabled,
    lastBackupAt: config.lastBackupAt,
    nextBackupAt: config.nextBackupAt,
    minutesUntilNext,
  }
}
