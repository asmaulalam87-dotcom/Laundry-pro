import Dexie, { type Table } from 'dexie'
import type { Recipe, RecipeStep, RecipeStepChemical, RecipeTemplate, Chemical, Process, CostingRecord, DropdownOption } from '@/types'

export class RecipeDatabase extends Dexie {
  recipes!: Table<Recipe>
  recipe_steps!: Table<RecipeStep>
  recipe_step_chemicals!: Table<RecipeStepChemical>
  recipe_templates!: Table<RecipeTemplate>
  chemicals!: Table<Chemical>
  processes!: Table<Process>
  process_chemicals!: Table<any>
  costing_records!: Table<CostingRecord>
  dropdown_options!: Table<DropdownOption>
  users!: Table<any>
  app_settings!: Table<any>
  templates!: Table<any>
  auto_backups!: Table<any>
  audit_log!: Table<any>

  constructor() {
    super('RecipeSystemDB')

    // v1 → original schema
    this.version(1).stores({
      recipes: 'id, recipe_no, customer_name, factory_name, wash_type, status, created_at',
      recipe_steps: 'id, recipe_id, step_order, process_name',
      recipe_step_chemicals: 'id, recipe_step_id, chemical_name',
      recipe_templates: 'id, name, wash_type',
      chemicals: 'id, name, category, current_stock',
      processes: 'id, name, category',
      process_chemicals: 'id, process_id, chemical_id, chemical_name',
      costing_records: 'id, recipe_id, customer_name',
      dropdown_options: 'id, category, value',
    })

    // v2 → keep existing + add users/app_settings/templates
    this.version(2).stores({
      recipes: 'id, recipe_no, customer_name, factory_name, wash_type, status, created_at',
      recipe_steps: 'id, recipe_id, step_order, process_name',
      recipe_step_chemicals: 'id, recipe_step_id, chemical_name',
      recipe_templates: 'id, name, wash_type',
      chemicals: 'id, name, category, current_stock',
      processes: 'id, name, category',
      process_chemicals: 'id, process_id, chemical_id, chemical_name',
      costing_records: 'id, recipe_id, customer_name',
      dropdown_options: 'id, category, value',
      users: 'id, username, role, status',
      app_settings: 'id',
      templates: 'id, name',
    })

    // v3 → migrate dropdown_options to auto-increment primary key ++id
    this.version(3).stores({
      recipes: 'id, recipe_no, customer_name, factory_name, wash_type, status, created_at',
      recipe_steps: 'id, recipe_id, step_order, process_name',
      recipe_step_chemicals: 'id, recipe_step_id, chemical_name',
      recipe_templates: 'id, name, wash_type',
      chemicals: 'id, name, category, current_stock',
      processes: 'id, name, category',
      process_chemicals: 'id, process_id, chemical_id, chemical_name',
      costing_records: 'id, recipe_id, customer_name',
      // ++id = auto-increment integer primary key (like Backup-14 IndexedDB)
      dropdown_options: '++id, category, value',
      users: 'id, username, role, status',
      app_settings: 'id',
      templates: 'id, name',
    }).upgrade(tx => {
      // Clear any old dropdown_options rows that had string ids (incompatible with ++id)
      return tx.table('dropdown_options').clear()
    })

    // v4 → add auto_backups table for scheduled backup storage
    this.version(4).stores({
      recipes: 'id, recipe_no, customer_name, factory_name, wash_type, status, created_at',
      recipe_steps: 'id, recipe_id, step_order, process_name',
      recipe_step_chemicals: 'id, recipe_step_id, chemical_name',
      recipe_templates: 'id, name, wash_type',
      chemicals: 'id, name, category, current_stock',
      processes: 'id, name, category',
      process_chemicals: 'id, process_id, chemical_id, chemical_name',
      costing_records: 'id, recipe_id, customer_name',
      dropdown_options: '++id, category, value',
      users: 'id, username, role, status',
      app_settings: 'id',
      templates: 'id, name',
      auto_backups: '++id, timestamp, label',
    })

    // v5 → add audit_log table for version history tracking
    this.version(5).stores({
      recipes: 'id, recipe_no, customer_name, factory_name, wash_type, status, created_at',
      recipe_steps: 'id, recipe_id, step_order, process_name',
      recipe_step_chemicals: 'id, recipe_step_id, chemical_name',
      recipe_templates: 'id, name, wash_type',
      chemicals: 'id, name, category, current_stock',
      processes: 'id, name, category',
      process_chemicals: 'id, process_id, chemical_id, chemical_name',
      costing_records: 'id, recipe_id, customer_name',
      dropdown_options: '++id, category, value',
      users: 'id, username, role, status',
      app_settings: 'id',
      templates: 'id, name',
      auto_backups: '++id, timestamp, label',
      audit_log: '++id, table_name, record_id, action, created_at',
    })
  }
}

export const db = new RecipeDatabase()

// ── Hard-reset safety ─────────────────────────────────────────────────────────
// If IndexedDB schema is corrupted or stale, we detect it and nuke + reload.
// You can also force a reset by typing in browser console:
//   localStorage.setItem('force_db_reset','1'); location.reload()
;(async () => {
  // Check for manual force-reset flag
  if (localStorage.getItem('force_db_reset') === '1') {
    localStorage.removeItem('force_db_reset')
    console.warn('[DB] Force reset requested, deleting database…')
    try { await db.delete() } catch {}
    window.location.reload()
    return
  }

  // Auto-detect version mismatch
  try {
    await db.recipes.count()   // trivial read — forces DB open
  } catch (err: any) {
    if (err?.name === 'VersionError' || err?.name === 'DatabaseClosedError' || err?.message?.includes('version')) {
      console.warn('[DB] Schema mismatch, deleting and reloading…', err?.message)
      try { await db.delete() } catch {}
      window.location.reload()
    } else {
      console.error('[DB] Unexpected error:', err)
    }
  }
})()

// ── Helpers ──────────────────────────────────────────────────────────────────

export const LocalDB = {
  async getAll<T>(tableName: string): Promise<T[]> {
    return await (db as any)[tableName].toArray()
  },

  async getById<T>(tableName: string, id: any): Promise<T | undefined> {
    return await (db as any)[tableName].get(id)
  },

  async getByIndex<T>(tableName: string, indexName: string, value: any): Promise<T[]> {
    return await (db as any)[tableName].where(indexName).equals(value).toArray()
  },

  /**
   * Add a record. For tables with auto-increment keys (e.g. dropdown_options)
   * do NOT include `id` in the object — Dexie will assign it automatically.
   * Returns the new key.
   */
  async add<T>(tableName: string, data: T): Promise<any> {
    return await (db as any)[tableName].add(data)
  },

  /**
   * Put (upsert) — inserts or replaces by primary key.
   * Use this for records that always carry their own id.
   */
  async put<T>(tableName: string, data: T): Promise<any> {
    return await (db as any)[tableName].put(data)
  },

  /**
   * Update an existing record by its primary key.
   * id can be string or number.
   */
  async update<T>(tableName: string, data: T & { id: any }): Promise<number> {
    return await (db as any)[tableName].update(data.id, data)
  },

  async delete(tableName: string, id: any): Promise<void> {
    await (db as any)[tableName].delete(id)
  },

  async clear(tableName: string): Promise<void> {
    await (db as any)[tableName].clear()
  },

  async bulkAdd<T>(tableName: string, data: T[]): Promise<any[]> {
    return await (db as any)[tableName].bulkAdd(data)
  },

  async bulkPut<T>(tableName: string, data: T[]): Promise<any[]> {
    return await (db as any)[tableName].bulkPut(data)
  },

  async bulkDelete(tableName: string, ids: any[]): Promise<void> {
    await (db as any)[tableName].bulkDelete(ids)
  },

  async count(tableName: string): Promise<number> {
    return await (db as any)[tableName].count()
  },
}
