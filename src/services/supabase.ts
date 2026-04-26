/**
 * Supabase Integration Service
 * 
 * Dynamically creates a Supabase client from user-configured credentials.
 * Supports full bidirectional sync between local IndexedDB and Supabase cloud.
 * 
 * Setup:
 * 1. Go to https://supabase.com/ → Create a project
 * 2. Go to Project Settings → API → Copy URL and anon/public key
 * 3. Run the SQL schema (from database_setup.sql) in the SQL Editor
 * 4. Enter URL + Key in Settings → Supabase Configuration
 * 5. Click "Test Connection" then "Push to Cloud" or "Pull from Cloud"
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { db } from '@/services/local-db'

// ── Config ──────────────────────────────────────────────────────────────────────

const SUPABASE_URL_KEY = 'supabase_url'
const SUPABASE_ANON_KEY_KEY = 'supabase_anon_key'
const SUPABASE_SYNC_META_KEY = 'supabase_sync_meta'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export interface SyncMeta {
  lastPushAt: string | null
  lastPullAt: string | null
  lastSyncStatus: 'idle' | 'success' | 'error'
  lastError: string | null
  connected: boolean
}

export interface SyncResult {
  success: boolean
  tables: { name: string; pushed: number; pulled: number; error?: string }[]
  message: string
}

export function loadSupabaseConfig(): SupabaseConfig {
  const url = localStorage.getItem(SUPABASE_URL_KEY) || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const anonKey = localStorage.getItem(SUPABASE_ANON_KEY_KEY) || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  return { url, anonKey }
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(SUPABASE_URL_KEY, config.url)
  localStorage.setItem(SUPABASE_ANON_KEY_KEY, config.anonKey)
  // Reinitialize client with new credentials
  initializeClient()
}

export function loadSyncMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(SUPABASE_SYNC_META_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { lastPushAt: null, lastPullAt: null, lastSyncStatus: 'idle', lastError: null, connected: false }
}

export function saveSyncMeta(meta: Partial<SyncMeta>): void {
  const current = loadSyncMeta()
  localStorage.setItem(SUPABASE_SYNC_META_KEY, JSON.stringify({ ...current, ...meta }))
}

// ── Dynamic Client ──────────────────────────────────────────────────────────────

let client: SupabaseClient | null = null

function initializeClient(): SupabaseClient | null {
  const config = loadSupabaseConfig()
  if (!config.url || !config.anonKey) {
    client = null
    return null
  }

  try {
    client = createClient(config.url, config.anonKey, {
      auth: { persistSession: false },
    })
    return client
  } catch (err) {
    console.error('[Supabase] Client init failed:', err)
    client = null
    return null
  }
}

function getClient(): SupabaseClient | null {
  if (!client) initializeClient()
  return client
}

// Initialize on module load
initializeClient()

// ── Connection Test ──────────────────────────────────────────────────────────────

export async function testConnection(): Promise<{ success: boolean; error?: string; projectUrl?: string }> {
  const sb = getClient()
  if (!sb) {
    return { success: false, error: 'Supabase not configured. Enter URL and Anon Key first.' }
  }

  try {
    // Try a lightweight call — get session or a simple select
    const { error } = await sb.from('recipes').select('id', { count: 'exact', head: true })
    if (error) {
      // If table doesn't exist, it's still a valid connection
      if (error.code === '42P01') {
        saveSyncMeta({ connected: true })
        return {
          success: true,
          projectUrl: loadSupabaseConfig().url,
          error: 'Connected, but "recipes" table not found. Run the SQL schema first.',
        }
      }
      throw new Error(error.message)
    }

    saveSyncMeta({ connected: true, lastSyncStatus: 'success', lastError: null })
    return { success: true, projectUrl: loadSupabaseConfig().url }
  } catch (err: any) {
    saveSyncMeta({ connected: false, lastSyncStatus: 'error', lastError: err?.message })
    return { success: false, error: err?.message || 'Connection failed' }
  }
}

// ── Table definitions for sync ──────────────────────────────────────────────────

const SYNC_TABLES = [
  { local: 'recipes', remote: 'recipes', idField: 'id' },
  { local: 'recipe_steps', remote: 'recipe_steps', idField: 'id' },
  { local: 'recipe_step_chemicals', remote: 'recipe_step_chemicals', idField: 'id' },
  { local: 'chemicals', remote: 'chemicals', idField: 'id' },
  { local: 'processes', remote: 'processes', idField: 'id' },
  { local: 'process_chemicals', remote: 'process_chemicals', idField: 'id' },
  { local: 'costing_records', remote: 'costing_records', idField: 'id' },
  { local: 'dropdown_options', remote: 'dropdown_options', idField: 'id' },
  { local: 'users', remote: 'users', idField: 'id' },
  { local: 'app_settings', remote: 'app_settings', idField: 'id' },
  { local: 'recipe_templates', remote: 'recipe_templates', idField: 'id' },
] as const

// ── Additional cloud-only tables (synced if they exist in local DB) ─────────
const EXTENDED_SYNC_TABLES = [
  { local: 'auto_backups', remote: 'auto_backups', idField: 'id' },
] as const

function getAllSyncTables() {
  return [...SYNC_TABLES, ...EXTENDED_SYNC_TABLES]
}

// ── Push: Local → Cloud ─────────────────────────────────────────────────────────

export async function pushToCloud(tables?: string[]): Promise<SyncResult> {
  const sb = getClient()
  if (!sb) {
    return { success: false, tables: [], message: 'Supabase not configured' }
  }

  const results: SyncResult['tables'] = []
  const allTables = getAllSyncTables()
  const tablesToSync = tables
    ? allTables.filter(t => tables.includes(t.local))
    : allTables

  for (const table of tablesToSync) {
    try {
      // Read all local data
      const localData = await (db as any)[table.local].toArray()

      if (localData.length === 0) {
        results.push({ name: table.local, pushed: 0, pulled: 0 })
        continue
      }

      // Clean up data for Supabase (remove undefined values, handle dates)
      const cleanedData = localData.map((row: any) => {
        const clean: Record<string, any> = {}
        for (const [key, value] of Object.entries(row)) {
          if (value !== undefined) {
            // Convert Date objects to ISO strings
            if (value instanceof Date) {
              clean[key] = value.toISOString()
            } else {
              clean[key] = value
            }
          }
        }
        return clean
      })

      // Upsert to Supabase
      const { error } = await sb
        .from(table.remote)
        .upsert(cleanedData, { onConflict: table.idField })

      if (error) {
        console.warn(`[Push] ${table.local}:`, error.message)
        results.push({ name: table.local, pushed: 0, pulled: 0, error: error.message })
      } else {
        results.push({ name: table.local, pushed: cleanedData.length, pulled: 0 })
      }
    } catch (err: any) {
      results.push({ name: table.local, pushed: 0, pulled: 0, error: err?.message || 'Failed' })
    }
  }

  const totalPushed = results.reduce((sum, r) => sum + r.pushed, 0)
  const hasErrors = results.some(r => r.error)

  saveSyncMeta({
    lastPushAt: new Date().toISOString(),
    lastSyncStatus: hasErrors ? 'error' : 'success',
    lastError: hasErrors ? 'Some tables failed' : null,
  })

  return {
    success: !hasErrors,
    tables: results,
    message: hasErrors
      ? `Pushed ${totalPushed} records with some errors`
      : `Successfully pushed ${totalPushed} records to cloud`,
  }
}

// ── Pull: Cloud → Local ─────────────────────────────────────────────────────────

export async function pullFromCloud(tables?: string[], mode: 'merge' | 'replace' = 'merge'): Promise<SyncResult> {
  const sb = getClient()
  if (!sb) {
    return { success: false, tables: [], message: 'Supabase not configured' }
  }

  const results: SyncResult['tables'] = []
  const allTables = getAllSyncTables()
  const tablesToSync = tables
    ? allTables.filter(t => tables.includes(t.local))
    : allTables

  for (const table of tablesToSync) {
    try {
      // Fetch all from Supabase
      const { data, error } = await sb
        .from(table.remote)
        .select('*')

      if (error) {
        // Table may not exist — skip gracefully
        if (error.code === '42P01') {
          results.push({ name: table.local, pushed: 0, pulled: 0, error: 'Table not found in cloud' })
          continue
        }
        throw new Error(error.message)
      }

      const remoteData = data || []
      if (remoteData.length === 0) {
        results.push({ name: table.local, pushed: 0, pulled: 0 })
        continue
      }

      if (mode === 'replace') {
        // Clear local table first, then insert
        await (db as any)[table.local].clear()
        await (db as any)[table.local].bulkAdd(remoteData)
      } else {
        // Merge: upsert (update existing, add new)
        await (db as any)[table.local].bulkPut(remoteData)
      }

      results.push({ name: table.local, pushed: 0, pulled: remoteData.length })
    } catch (err: any) {
      results.push({ name: table.local, pushed: 0, pulled: 0, error: err?.message || 'Failed' })
    }
  }

  const totalPulled = results.reduce((sum, r) => sum + r.pulled, 0)
  const hasErrors = results.some(r => r.error)

  saveSyncMeta({
    lastPullAt: new Date().toISOString(),
    lastSyncStatus: hasErrors ? 'error' : 'success',
    lastError: hasErrors ? 'Some tables failed' : null,
  })

  return {
    success: !hasErrors,
    tables: results,
    message: hasErrors
      ? `Pulled ${totalPulled} records with some errors`
      : `Successfully pulled ${totalPulled} records from cloud`,
  }
}

// ── Full Sync (bidirectional) ────────────────────────────────────────────────────

export async function fullSync(): Promise<SyncResult> {
  const sb = getClient()
  if (!sb) {
    return { success: false, tables: [], message: 'Supabase not configured' }
  }

  const results: SyncResult['tables'] = []

  for (const table of SYNC_TABLES) {
    try {
      // Get local data
      const localData = await (db as any)[table.local].toArray()
      // Get remote data
      const { data: remoteData, error } = await sb.from(table.remote).select('*')

      if (error) {
        if (error.code === '42P01') {
          results.push({ name: table.local, pushed: 0, pulled: 0, error: 'Table not found' })
          continue
        }
        throw new Error(error.message)
      }

      const remote = remoteData || []
      let pushed = 0
      let pulled = 0

      // Push: upsert local → cloud
      if (localData.length > 0) {
        const cleaned = localData.map((row: any) => {
          const clean: Record<string, any> = {}
          for (const [key, value] of Object.entries(row)) {
            if (value !== undefined) {
              clean[key] = value instanceof Date ? value.toISOString() : value
            }
          }
          return clean
        })

        const { error: pushErr } = await sb.from(table.remote).upsert(cleaned, { onConflict: table.idField })
        if (!pushErr) pushed = cleaned.length
      }

      // Pull: upsert cloud → local
      if (remote.length > 0) {
        await (db as any)[table.local].bulkPut(remote)
        pulled = remote.length
      }

      results.push({ name: table.local, pushed, pulled })
    } catch (err: any) {
      results.push({ name: table.local, pushed: 0, pulled: 0, error: err?.message || 'Failed' })
    }
  }

  const totalPushed = results.reduce((sum, r) => sum + r.pushed, 0)
  const totalPulled = results.reduce((sum, r) => sum + r.pulled, 0)
  const hasErrors = results.some(r => r.error)

  saveSyncMeta({
    lastPushAt: new Date().toISOString(),
    lastPullAt: new Date().toISOString(),
    lastSyncStatus: hasErrors ? 'error' : 'success',
    lastError: hasErrors ? 'Some tables failed' : null,
  })

  return {
    success: !hasErrors,
    tables: results,
    message: `Sync complete: ${totalPushed} pushed, ${totalPulled} pulled`,
  }
}

// ── Get remote record counts ────────────────────────────────────────────────────

export async function getRemoteCounts(): Promise<Record<string, number>> {
  const sb = getClient()
  if (!sb) return {}

  const counts: Record<string, number> = {}
  for (const table of SYNC_TABLES) {
    try {
      const { count, error } = await sb
        .from(table.remote)
        .select('*', { count: 'exact', head: true })
      counts[table.local] = error ? 0 : (count || 0)
    } catch {
      counts[table.local] = 0
    }
  }
  return counts
}

// ── Get local record counts ─────────────────────────────────────────────────────

export async function getLocalCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const table of SYNC_TABLES) {
    try {
      counts[table.local] = await (db as any)[table.local].count()
    } catch {
      counts[table.local] = 0
    }
  }
  return counts
}

// ── Generate SQL schema for Supabase ────────────────────────────────────────────

export function generateSchemaSQL(): string {
  return `-- ============================================================================
-- LAUNDRY PRO — Complete Supabase Database Schema (Updated)
-- ============================================================================
-- 
-- HOW TO USE:
-- 1. Go to https://supabase.com/dashboard
-- 2. Create a new project (or open existing)
-- 3. Go to SQL Editor → New Query
-- 4. Paste this entire file and click "Run"
-- 5. Go to Project Settings → API → Copy URL and anon/public key
-- 6. Enter those credentials in the app Settings → Supabase Cloud Sync
--
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Recipes ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  recipe_no TEXT,
  customer_name TEXT,
  factory_name TEXT,
  style TEXT,
  color TEXT,
  wash_type TEXT,
  status TEXT DEFAULT 'draft',
  recipe_ref TEXT,
  final_wash TEXT,
  po TEXT,
  ob_no TEXT,
  garment_qty INTEGER,
  remarks TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recipe Steps ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_steps (
  id TEXT PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  step_order INTEGER,
  process_name TEXT,
  temperature NUMERIC,
  time_minutes NUMERIC,
  non_op_time NUMERIC,
  ph_range TEXT,
  default_ph TEXT,
  default_rpm TEXT,
  default_temperature TEXT,
  default_time TEXT,
  liquor_ratio TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recipe Step Chemicals ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_step_chemicals (
  id TEXT PRIMARY KEY,
  recipe_step_id TEXT REFERENCES recipe_steps(id) ON DELETE CASCADE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  chemical_id TEXT,
  chemical_name TEXT,
  dosage TEXT,
  unit TEXT,
  cost_per_unit REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Chemicals ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chemicals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  supplier TEXT,
  current_stock REAL DEFAULT 0,
  min_stock REAL DEFAULT 0,
  unit TEXT,
  cost_per_unit REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  remarks TEXT,
  hazard_class TEXT,
  storage_condition TEXT,
  shelf_life TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Processes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  default_rpm TEXT,
  default_ph TEXT,
  default_temperature TEXT,
  default_time TEXT,
  default_liquor_ratio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Process Chemicals ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_chemicals (
  id TEXT PRIMARY KEY,
  process_id TEXT REFERENCES processes(id) ON DELETE CASCADE,
  chemical_id TEXT,
  chemical_name TEXT,
  dosage TEXT,
  unit TEXT,
  step_order INTEGER
);

-- ── Costing Records ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS costing_records (
  id TEXT PRIMARY KEY,
  recipe_id TEXT,
  recipe_no TEXT,
  customer_name TEXT,
  style TEXT,
  wash_type TEXT,
  total_chemical_cost REAL DEFAULT 0,
  total_utility_cost REAL DEFAULT 0,
  total_labor_cost REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  cost_per_pcs REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Dropdown Options ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dropdown_options (
  id INTEGER PRIMARY KEY,
  category TEXT,
  value TEXT,
  label TEXT
);

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  designation TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── App Settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  key TEXT,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recipe Templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  wash_type TEXT,
  description TEXT,
  steps JSONB DEFAULT '[]',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Production Schedule ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_schedule (
  id TEXT PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id),
  recipe_no TEXT,
  customer_name TEXT,
  style TEXT,
  wash_type TEXT,
  machine TEXT,
  date DATE,
  time_slot TEXT,
  status TEXT DEFAULT 'queued',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Shop Floor Jobs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_floor_jobs (
  id TEXT PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id),
  recipe_no TEXT,
  customer_name TEXT,
  style TEXT,
  color TEXT,
  wash_type TEXT,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  current_process TEXT,
  status TEXT DEFAULT 'waiting',
  machine TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT,
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Wash Requisitions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wash_requisitions (
  id TEXT PRIMARY KEY,
  requisition_no TEXT,
  recipe_id TEXT REFERENCES recipes(id),
  customer_name TEXT,
  style TEXT,
  color TEXT,
  wash_type TEXT,
  garment_qty INTEGER,
  factory_name TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  requested_by TEXT,
  approved_by TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  remarks TEXT
);

-- ── Chat Messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  channel TEXT DEFAULT 'general',
  user_id TEXT,
  user_name TEXT,
  message TEXT,
  type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Approval Workflow ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id),
  recipe_no TEXT,
  requested_by TEXT,
  requested_by_name TEXT,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_by_name TEXT,
  comments TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- ── Audit Log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  table_name TEXT,
  record_id TEXT,
  action TEXT,
  old_data JSONB,
  new_data JSONB,
  user_id TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auto Backups ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_backups (
  id TEXT PRIMARY KEY,
  timestamp TEXT,
  label TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (for performance)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_recipes_customer ON recipes(customer_name);
CREATE INDEX IF NOT EXISTS idx_recipes_style ON recipes(style);
CREATE INDEX IF NOT EXISTS idx_recipes_wash_type ON recipes(wash_type);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipes_factory ON recipes(factory_name);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_step_chem_step_id ON recipe_step_chemicals(recipe_step_id);
CREATE INDEX IF NOT EXISTS idx_recipe_step_chem_recipe_id ON recipe_step_chemicals(recipe_id);

CREATE INDEX IF NOT EXISTS idx_chemicals_name ON chemicals(name);
CREATE INDEX IF NOT EXISTS idx_chemicals_category ON chemicals(category);
CREATE INDEX IF NOT EXISTS idx_chemicals_supplier ON chemicals(supplier);

CREATE INDEX IF NOT EXISTS idx_processes_name ON processes(name);
CREATE INDEX IF NOT EXISTS idx_processes_category ON processes(category);

CREATE INDEX IF NOT EXISTS idx_costing_recipe_id ON costing_records(recipe_id);
CREATE INDEX IF NOT EXISTS idx_costing_customer ON costing_records(customer_name);
CREATE INDEX IF NOT EXISTS idx_costing_status ON costing_records(status);

CREATE INDEX IF NOT EXISTS idx_dropdown_category ON dropdown_options(category);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_production_date ON production_schedule(date);
CREATE INDEX IF NOT EXISTS idx_production_machine ON production_schedule(machine);
CREATE INDEX IF NOT EXISTS idx_production_status ON production_schedule(status);

CREATE INDEX IF NOT EXISTS idx_shopfloor_status ON shop_floor_jobs(status);
CREATE INDEX IF NOT EXISTS idx_shopfloor_machine ON shop_floor_jobs(machine);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

CREATE INDEX IF NOT EXISTS idx_wash_req_status ON wash_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_wash_req_customer ON wash_requisitions(customer_name);

CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_templates_wash_type ON recipe_templates(wash_type);

CREATE INDEX IF NOT EXISTS idx_auto_backups_timestamp ON auto_backups(timestamp);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- IMPORTANT: For development/demo, we allow full anon access.
-- In production, configure proper RLS policies based on your auth setup.

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_step_chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE costing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropdown_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_floor_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE wash_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_backups ENABLE ROW LEVEL SECURITY;

-- Development: Allow full anon access (remove these in production!)
CREATE POLICY "Allow anon full access" ON recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON recipe_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON recipe_step_chemicals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON chemicals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON processes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON process_chemicals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON costing_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON dropdown_options FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON recipe_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON production_schedule FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON shop_floor_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON wash_requisitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON approval_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON auto_backups FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_chemicals_updated_at BEFORE UPDATE ON chemicals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_processes_updated_at BEFORE UPDATE ON processes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_costing_updated_at BEFORE UPDATE ON costing_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_production_updated_at BEFORE UPDATE ON production_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_shopfloor_updated_at BEFORE UPDATE ON shop_floor_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_wash_req_updated_at BEFORE UPDATE ON wash_requisitions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_templates_updated_at BEFORE UPDATE ON recipe_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- TRIGGER: Audit log for recipe changes
-- ============================================================================

CREATE OR REPLACE FUNCTION log_recipe_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, user_name)
    VALUES ('recipes', NEW.id, 'INSERT', to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_name)
    VALUES ('recipes', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, user_name)
    VALUES ('recipes', OLD.id, 'DELETE', to_jsonb(OLD), OLD.created_by);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipe_audit AFTER INSERT OR UPDATE OR DELETE ON recipes
  FOR EACH ROW EXECUTE FUNCTION log_recipe_change();

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW recipe_summary AS
SELECT
  r.id,
  r.recipe_no,
  r.customer_name,
  r.style,
  r.color,
  r.wash_type,
  r.factory_name,
  r.status,
  COUNT(DISTINCT rs.id) AS step_count,
  COUNT(DISTINCT rsc.id) AS chemical_count,
  COALESCE(SUM(CAST(NULLIF(rsc.dosage, '') AS NUMERIC) * rsc.cost_per_unit), 0) AS total_chemical_cost,
  r.created_at
FROM recipes r
LEFT JOIN recipe_steps rs ON rs.recipe_id = r.id
LEFT JOIN recipe_step_chemicals rsc ON rsc.recipe_step_id = rs.id
GROUP BY r.id, r.recipe_no, r.customer_name, r.style, r.color, r.wash_type, r.factory_name, r.status, r.created_at;

CREATE OR REPLACE VIEW chemical_stock_status AS
SELECT
  c.id,
  c.name,
  c.category,
  c.current_stock,
  c.min_stock,
  c.unit,
  c.supplier,
  CASE
    WHEN c.current_stock <= 0 THEN 'out_of_stock'
    WHEN c.current_stock <= c.min_stock THEN 'low_stock'
    ELSE 'ok'
  END AS stock_status
FROM chemicals c;

CREATE OR REPLACE VIEW monthly_recipe_count AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS recipe_count,
  COUNT(DISTINCT customer_name) AS customer_count
FROM recipes
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- ============================================================================
-- DONE!
-- ============================================================================
`
}

// ── Legacy auth helpers (kept for backward compat) ──────────────────────────────

export const authApi = {
  async login(email: string, password: string) {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    return { data, error }
  },

  async register(email: string, password: string, name: string) {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name } },
    })
    return { data, error }
  },

  async logout() {
    const sb = getClient()
    if (!sb) return { error: null }
    const { error } = await sb.auth.signOut()
    return { error }
  },

  async getSession() {
    const sb = getClient()
    if (!sb) return { session: null, error: null }
    const { data: { session }, error } = await sb.auth.getSession()
    return { session, error }
  },

  async getUser() {
    const sb = getClient()
    if (!sb) return { user: null, error: null }
    const { data: { user }, error } = await sb.auth.getUser()
    return { user, error }
  },
}

// ── Legacy API helpers (kept for backward compat) ──────────────────────────────

export const recipesApi = {
  async getAll() {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    return sb.from('recipes').select('*').order('created_at', { ascending: false })
  },
  async getById(id: string) {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    return sb.from('recipes').select('*').eq('id', id).single()
  },
  async create(recipe: any) {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    return sb.from('recipes').insert(recipe).select()
  },
  async update(id: string, recipe: any) {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    return sb.from('recipes').update(recipe).eq('id', id).select()
  },
  async delete(id: string) {
    const sb = getClient()
    if (!sb) return { error: { message: 'Not configured' } }
    return sb.from('recipes').delete().eq('id', id)
  },
}

export const chemicalsApi = {
  async getAll() {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    return sb.from('chemicals').select('*').order('name')
  },
  async create(chemical: any) {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    return sb.from('chemicals').insert(chemical).select()
  },
  async update(id: string, chemical: any) {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    return sb.from('chemicals').update(chemical).eq('id', id).select()
  },
}

export const processesApi = {
  async getAll() {
    const sb = getClient()
    if (!sb) return { data: null, error: { message: 'Not configured' } }
    return sb.from('processes').select('*').order('name')
  },
}

const DEFAULT_SUPABASE_URL = 'https://qznbcexaxjkjwclpwtgz.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bmJjZXhheGprandjbHB3dGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODYzMTIsImV4cCI6MjA5MjM2MjMxMn0.bPcSVbUgZvMv-h8wdK5KKBD7gnemuevQaRp_1uc7qUQ'

function getDefaultUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL || localStorage.getItem(SUPABASE_URL_KEY) || DEFAULT_SUPABASE_URL
}

function getDefaultAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem(SUPABASE_ANON_KEY_KEY) || DEFAULT_SUPABASE_ANON_KEY
}

// Backward compat — export a supabase client getter
export function getSupabaseClient(): SupabaseClient | null {
  return getClient()
}

// Default export for simple import
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const sb = getClient()
    if (!sb) return undefined
    return (sb as any)[prop]
  },
})
