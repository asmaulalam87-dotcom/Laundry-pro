import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  History, ArrowLeft, RotateCcw, Plus, Pencil, Trash2,
  ChevronDown, ChevronUp, FileText, Clock, User, Diff,
  AlertTriangle, CheckCircle2, Search,
} from 'lucide-react'
import { db } from '@/services/local-db'
import { toast } from 'sonner'

interface AuditEntry {
  id: number
  table_name: string
  record_id: string
  action: string
  old_data: Record<string, any> | null
  new_data: Record<string, any> | null
  user_id?: string
  user_name?: string
  created_at: string
}

// Fields to skip in diff display
const SKIP_FIELDS = new Set(['created_at', 'updated_at', 'id'])

function computeDiff(oldData: Record<string, any> | null, newData: Record<string, any> | null) {
  if (!oldData && !newData) return []
  if (!oldData) return Object.entries(newData!).map(([key, value]) => ({ key, oldVal: undefined, newVal: value, changed: true }))
  if (!newData) return Object.entries(oldData).map(([key, value]) => ({ key, oldVal: value, newVal: undefined, changed: true }))

  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)])
  const diff: { key: string; oldVal: any; newVal: any; changed: boolean }[] = []

  for (const key of allKeys) {
    if (SKIP_FIELDS.has(key)) continue
    const oldVal = oldData[key]
    const newVal = newData[key]
    const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal)
    if (changed) {
      diff.push({ key, oldVal, newVal, changed })
    }
  }
  return diff
}

export const VersionHistory = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const filterRecipeId = searchParams.get('recipe_id')

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterTable, setFilterTable] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState(filterRecipeId || '')

  useEffect(() => { loadEntries() }, [])

  const loadEntries = async () => {
    setLoading(true)
    try {
      const data = await db.audit_log.orderBy('created_at').reverse().toArray()
      setEntries(data)
    } catch (err) {
      console.error('[VersionHistory] Failed to load audit log:', err)
      setEntries([])
    }
    setLoading(false)
  }

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filterAction !== 'all' && e.action !== filterAction) return false
      if (filterTable !== 'all' && e.table_name !== filterTable) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matches =
          (e.record_id?.toLowerCase().includes(q)) ||
          (e.table_name?.toLowerCase().includes(q)) ||
          (e.user_name?.toLowerCase().includes(q)) ||
          (JSON.stringify(e.new_data || e.old_data || {}).toLowerCase().includes(q))
        if (!matches) return false
      }
      return true
    }).slice(0, 100)
  }, [entries, filterAction, filterTable, searchQuery])

  const tableNames = useMemo(() => {
    const set = new Set(entries.map(e => e.table_name).filter(Boolean))
    return Array.from(set).sort()
  }, [entries])

  const handleRestore = async (entry: AuditEntry) => {
    if (!entry.new_data && !entry.old_data) return

    const dataToRestore = entry.old_data || entry.new_data!
    const tableName = entry.table_name
    const recordId = entry.record_id || dataToRestore.id

    if (!confirm(`Restore this ${tableName} record to its previous state?`)) return

    try {
      // Check if record still exists
      const existing = await (db as any)[tableName]?.get(recordId)
      if (existing) {
        await (db as any)[tableName].put({ ...dataToRestore, id: recordId })
      } else {
        await (db as any)[tableName].add({ ...dataToRestore, id: recordId })
      }

      // Log the restore action
      await db.audit_log.add({
        table_name: tableName,
        record_id: recordId,
        action: 'RESTORE',
        old_data: existing || null,
        new_data: dataToRestore,
        user_name: 'Current User',
        created_at: new Date().toISOString(),
      })

      toast.success(`${tableName} record restored successfully`)
      loadEntries()
    } catch (err: any) {
      toast.error(`Restore failed: ${err.message}`)
    }
  }

  const actionConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    INSERT:  { icon: Plus, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Created' },
    UPDATE:  { icon: Pencil, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Updated' },
    DELETE:  { icon: Trash2, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Deleted' },
    RESTORE: { icon: RotateCcw, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Restored' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="w-6 h-6" /> Version History
            </h1>
            <p className="text-sm text-muted-foreground">Track all changes to recipes, chemicals, and other data</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ID, table, user, or content..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-sm"
        >
          <option value="all">All Actions</option>
          <option value="INSERT">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
          <option value="RESTORE">Restored</option>
        </select>
        <select
          value={filterTable}
          onChange={e => setFilterTable(e.target.value)}
          className="px-3 py-2 bg-muted border border-border rounded-lg text-sm"
        >
          <option value="all">All Tables</option>
          {tableNames.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">
          {filteredEntries.length} of {entries.length} entries
        </span>
      </div>

      {/* Entry list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mr-3" />
          Loading audit log...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <History className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-lg font-medium">No version history yet</p>
          <p className="text-sm">Changes to recipes and other data will be tracked here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map(entry => {
            const cfg = actionConfig[entry.action] || actionConfig.UPDATE
            const Icon = cfg.icon
            const isExpanded = expandedId === entry.id
            const diff = (entry.action === 'UPDATE' || entry.action === 'RESTORE')
              ? computeDiff(entry.old_data, entry.new_data)
              : []

            return (
              <div key={entry.id} className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Entry header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{entry.table_name}</span>
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        {entry.record_id?.substring(0, 8)}...
                      </span>
                      {(entry.action === 'UPDATE' || entry.action === 'RESTORE') && diff.length > 0 && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">
                          {diff.length} change{diff.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(entry.created_at).toLocaleString()}</span>
                      {entry.user_name && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {entry.user_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(entry.action === 'UPDATE' || entry.action === 'DELETE') && entry.old_data && (
                      <button
                        onClick={e => { e.stopPropagation(); handleRestore(entry) }}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] bg-amber-500/10 text-amber-400 rounded hover:bg-amber-500/20 transition-colors"
                        title="Restore to this version"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded diff view */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-3">
                    {/* For INSERT: show all new data */}
                    {entry.action === 'INSERT' && entry.new_data && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">New Record Data</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(entry.new_data)
                            .filter(([k]) => !SKIP_FIELDS.has(k))
                            .map(([key, value]) => (
                              <div key={key} className="text-xs">
                                <span className="text-muted-foreground">{key}: </span>
                                <span className="font-medium">{String(value ?? '—')}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* For DELETE: show deleted data */}
                    {entry.action === 'DELETE' && entry.old_data && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-2">Deleted Record Data</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(entry.old_data)
                            .filter(([k]) => !SKIP_FIELDS.has(k))
                            .map(([key, value]) => (
                              <div key={key} className="text-xs">
                                <span className="text-muted-foreground">{key}: </span>
                                <span className="font-medium line-through text-red-400/70">{String(value ?? '—')}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* For UPDATE/RESTORE: show diff */}
                    {(entry.action === 'UPDATE' || entry.action === 'RESTORE') && diff.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          <Diff className="w-3 h-3 inline mr-1" />
                          Changed Fields
                        </p>
                        <div className="space-y-1.5">
                          {diff.map(d => (
                            <div key={d.key} className="flex items-center gap-3 text-xs py-1 px-2 rounded bg-background">
                              <span className="font-mono font-semibold text-indigo-400 min-w-[120px]">{d.key}</span>
                              <div className="flex-1 flex items-center gap-2 min-w-0">
                                <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded line-through truncate max-w-[200px]" title={String(d.oldVal)}>
                                  {String(d.oldVal ?? '—')}
                                </span>
                                <ArrowLeft className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded truncate max-w-[200px]" title={String(d.newVal)}>
                                  {String(d.newVal ?? '—')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {diff.length === 0 && entry.action === 'UPDATE' && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> No visible field changes (metadata only)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
