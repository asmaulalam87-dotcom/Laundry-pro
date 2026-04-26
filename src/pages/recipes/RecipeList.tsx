import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Eye, Edit, Trash2, Copy, Search, FileText, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LocalDB } from '@/services/local-db'
import { logAudit } from '@/services/audit-logger'
import type { Recipe } from '@/types'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

type SortField = 'recipe_no' | 'customer_name' | 'factory_name' | 'style' | 'wash_type' | 'status' | 'created_at'
type SortDir = 'asc' | 'desc'

const STATUS_COLORS: Record<string, string> = {
  Draft:     'bg-gray-500/20 text-gray-400',
  Pending:   'bg-yellow-500/20 text-yellow-400',
  Approved:  'bg-blue-500/20 text-blue-400',
  Finalized: 'bg-green-500/20 text-green-400',
}

const TYPE_COLORS: Record<string, string> = {
  Original: 'bg-blue-500/20 text-blue-400',
  Sample:   'bg-yellow-500/20 text-yellow-400',
  Bulk:     'bg-green-500/20 text-green-400',
  Revised:  'bg-purple-500/20 text-purple-400',
}

export const RecipeList = () => {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [filterText, setFilterText] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWashType, setFilterWashType] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  useEffect(() => { loadRecipes() }, [])

  const loadRecipes = async () => {
    setLoading(true)
    try {
      const data = await LocalDB.getAll<Recipe>('recipes')
      setRecipes(data)
    } catch {
      toast.error('Failed to load recipes')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this recipe?')) return
    try {
      const recipeData = await LocalDB.getById<Recipe>('recipes', id)
      await LocalDB.delete('recipes', id)
      await logAudit({ table_name: 'recipes', record_id: id, action: 'DELETE', old_data: recipeData || undefined })
      toast.success('Recipe deleted')
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
      loadRecipes()
    } catch { toast.error('Failed to delete') }
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} selected recipe(s)?`)) return
    try {
      for (const id of selected) await LocalDB.delete('recipes', id)
      toast.success(`Deleted ${selected.size} recipe(s)`)
      setSelected(new Set())
      loadRecipes()
    } catch { toast.error('Failed to delete') }
  }

  const handleView = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/recipes/builder?id=${id}`)
  }

  const handleEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/recipes/builder?id=${id}`)
  }

  const handleClone = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/recipes/builder?cloneId=${id}`)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(r => r.id!)))
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  // Filter
  const filtered = recipes.filter(r => {
    const q = filterText.toLowerCase()
    const matchText = !q ||
      r.recipe_no?.toLowerCase().includes(q) ||
      r.customer_name?.toLowerCase().includes(q) ||
      r.style?.toLowerCase().includes(q) ||
      r.factory_name?.toLowerCase().includes(q) ||
      r.color?.toLowerCase().includes(q)
    const matchStatus = !filterStatus || r.status === filterStatus
    const matchWash = !filterWashType || r.wash_type === filterWashType
    return matchText && matchStatus && matchWash
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let va = (a as any)[sortField] ?? ''
    let vb = (b as any)[sortField] ?? ''
    if (sortField === 'created_at') {
      va = new Date(va).getTime()
      vb = new Date(vb).getTime()
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = {
    total: recipes.length,
    finalized: recipes.filter(r => r.status === 'Finalized' || r.status === 'Approved').length,
    drafts: recipes.filter(r => r.status === 'Draft' || r.status === 'Pending').length,
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 opacity-40" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-indigo-400" />
      : <ChevronDown className="w-3 h-3 text-indigo-400" />
  }

  const Th = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none ${className}`}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon field={field} />
      </div>
    </th>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Recipe List</h1>
          <p className="text-muted-foreground text-sm mt-0.5">View and manage all wash recipes</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 rounded-lg text-sm">
              <Trash2 className="w-4 h-4" /> Delete ({selected.size})
            </button>
          )}
          <button onClick={loadRecipes}
            className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-lg hover:bg-muted/70 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => navigate('/recipes/builder')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold">
            <Plus className="w-4 h-4" /> New Recipe
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Recipes', value: stats.total, color: 'indigo', icon: '📋' },
          { label: 'Finalized / Approved', value: stats.finalized, color: 'green', icon: '✅' },
          { label: 'Draft / Pending', value: stats.drafts, color: 'yellow', icon: '📝' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${s.color}-500/10 flex items-center justify-center text-lg`}>{s.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Search recipe no, customer, style..."
              value={filterText} onChange={e => { setFilterText(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Finalized">Finalized</option>
          </select>
          <select value={filterWashType} onChange={e => { setFilterWashType(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Wash Types</option>
            <option value="Normal Wash">Normal Wash</option>
            <option value="Heavy Wash">Heavy Wash</option>
            <option value="Enzyme Wash">Enzyme Wash</option>
            <option value="Bleach Wash">Bleach Wash</option>
            <option value="Stone Wash">Stone Wash</option>
            <option value="Acid Wash">Acid Wash</option>
            <option value="Denim Wash">Denim Wash</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading recipes...
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No recipes found</p>
            <p className="text-sm mt-1">Try adjusting your filters or create a new recipe.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                    </th>
                    <Th field="recipe_no" label="Recipe No" />
                    <Th field="customer_name" label="Customer" />
                    <Th field="factory_name" label="Factory" />
                    <Th field="style" label="Style" />
                    <Th field="wash_type" label="Wash Type" />
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
                    <Th field="status" label="Status" />
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Batch</th>
                    <Th field="created_at" label="Date" />
                    <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map(recipe => (
                    <tr
                      key={recipe.id}
                      onClick={() => toggleSelect(recipe.id!)}
                      className={`cursor-pointer transition-colors hover:bg-muted/40 ${selected.has(recipe.id!) ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''}`}
                    >
                      <td className="px-3 py-3">
                        <input type="checkbox"
                          checked={selected.has(recipe.id!)}
                          onChange={() => toggleSelect(recipe.id!)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                      </td>
                      <td className="px-3 py-3 font-bold text-indigo-400">{recipe.recipe_no || '—'}</td>
                      <td className="px-3 py-3 font-medium">{recipe.customer_name || '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{recipe.factory_name || '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{recipe.style || '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{recipe.wash_type || '—'}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${TYPE_COLORS[(recipe as any).recipe_type] || 'bg-gray-500/20 text-gray-400'}`}>
                          {(recipe as any).recipe_type || 'Original'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[recipe.status] || 'bg-gray-500/20 text-gray-400'}`}>
                          {recipe.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{recipe.batch_weight ? `${recipe.batch_weight} kg` : '—'}</td>
                      <td className="px-3 py-3 text-muted-foreground text-xs">{recipe.created_at ? formatDate(recipe.created_at) : '—'}</td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button onClick={e => handleView(recipe.id!, e)}
                            title="View"
                            className="p-1.5 rounded bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={e => handleEdit(recipe.id!, e)}
                            title="Edit"
                            className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 transition-colors">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={e => handleClone(recipe.id!, e)}
                            title="Clone"
                            className="p-1.5 rounded bg-purple-500/10 hover:bg-purple-500/30 text-purple-400 transition-colors">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={e => handleDelete(recipe.id!, e)}
                            title="Delete"
                            className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/30 text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
              <div className="text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} recipes
                {selected.size > 0 && <span className="ml-2 text-indigo-400">• {selected.size} selected</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">«</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                  const p = start + i
                  return p <= totalPages ? (
                    <button key={p} onClick={() => setPage(p)}
                      className={`px-3 py-1 rounded border text-sm ${p === page ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-border hover:bg-muted'}`}>
                      {p}
                    </button>
                  ) : null
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="px-2 py-1 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed">»</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
