/**
 * Audit Logger — records changes to IndexedDB tables for version history tracking.
 * Call logAudit() after any create/update/delete operation on important tables.
 */
import { db } from '@/services/local-db'
import { useAuthStore } from '@/stores/auth-store'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE'

interface AuditParams {
  table_name: string
  record_id: string
  action: AuditAction
  old_data?: Record<string, any> | null
  new_data?: Record<string, any> | null
}

export async function logAudit({ table_name, record_id, action, old_data, new_data }: AuditParams): Promise<void> {
  try {
    const user = useAuthStore.getState().user
    await db.audit_log.add({
      table_name,
      record_id,
      action,
      old_data: old_data || null,
      new_data: new_data || null,
      user_id: user?.id || null,
      user_name: user?.name || 'Unknown',
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    // Audit logging should never block the main operation
    console.warn('[AuditLog] Failed to write audit entry:', err)
  }
}

/**
 * Convenience: wrap a DB put() with automatic audit logging.
 * Captures the "before" state before writing.
 */
export async function auditedPut(
  tableName: string,
  newData: Record<string, any> & { id: string },
  action: AuditAction = 'UPDATE'
): Promise<any> {
  const recordId = newData.id

  // Get old data for diff
  let oldData: Record<string, any> | null = null
  try {
    oldData = await (db as any)[tableName]?.get(recordId) || null
  } catch {}

  // Perform the write
  const result = await (db as any)[tableName].put(newData)

  // Log the audit entry
  await logAudit({
    table_name: tableName,
    record_id: recordId,
    action: oldData ? action : 'INSERT',
    old_data: oldData,
    new_data: newData,
  })

  return result
}

/**
 * Convenience: wrap a DB delete() with automatic audit logging.
 * Captures the "before" state before deleting.
 */
export async function auditedDelete(tableName: string, recordId: string): Promise<void> {
  let oldData: Record<string, any> | null = null
  try {
    oldData = await (db as any)[tableName]?.get(recordId) || null
  } catch {}

  await (db as any)[tableName].delete(recordId)

  await logAudit({
    table_name: tableName,
    record_id: recordId,
    action: 'DELETE',
    old_data: oldData,
    new_data: null,
  })
}
