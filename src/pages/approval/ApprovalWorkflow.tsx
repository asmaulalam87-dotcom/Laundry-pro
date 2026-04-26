import { useState, useEffect } from 'react'
import { db } from '@/services/local-db'
import type { Recipe } from '@/types'
import { useAuthStore } from '@/stores/auth-store'
import { useSyncStore } from '@/stores/sync-store'
import { CheckCircle2, Clock, AlertCircle, ArrowRight, XCircle, Eye, Filter, ChevronDown, Send, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

type ApprovalStatus = 'Draft' | 'Pending' | 'Approved' | 'Finalized' | 'Rejected'

const STATUS_CONFIG: Record<ApprovalStatus, { color: string; bg: string; icon: any; label: string }> = {
  Draft:     { color: '#6b7280', bg: 'bg-gray-500/10',  icon: Clock,        label: 'Draft' },
  Pending:   { color: '#d97706', bg: 'bg-amber-500/10', icon: AlertCircle,  label: 'Pending Review' },
  Approved:  { color: '#16a34a', bg: 'bg-green-500/10', icon: CheckCircle2, label: 'Approved' },
  Finalized: { color: '#4f46e5', bg: 'bg-indigo-500/10',icon: Shield,       label: 'Finalized' },
  Rejected:  { color: '#dc2626', bg: 'bg-red-500/10',   icon: XCircle,      label: 'Rejected' },
}

const VALID_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  Draft:     ['Pending'],
  Pending:   ['Approved', 'Rejected'],
  Approved:  ['Finalized', 'Rejected'],
  Finalized: [],
  Rejected:  ['Draft', 'Pending'],
}

export const ApprovalWorkflow = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { addToQueue } = useSyncStore()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [filter, setFilter] = useState<ApprovalStatus | 'All'>('All')
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [approvalLog, setApprovalLog] = useState<Record<string, any[]>>({})

  useEffect(() => {
    loadRecipes()
    // Load approval log from localStorage
    try {
      const saved = localStorage.getItem('approval_log')
      if (saved) setApprovalLog(JSON.parse(saved))
    } catch {}
  }, [])

  const loadRecipes = async () => {
    setLoading(true)
    try {
      const all = await db.recipes.toArray()
      setRecipes(all.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
    } catch (err) {
      toast.error('Failed to load recipes')
    } finally {
      setLoading(false)
    }
  }

  const filtered = filter === 'All' ? recipes : recipes.filter(r => r.status === filter)

  const statusCounts = {
    All: recipes.length,
    Draft: recipes.filter(r => r.status === 'Draft').length,
    Pending: recipes.filter(r => r.status === 'Pending').length,
    Approved: recipes.filter(r => r.status === 'Approved').length,
    Finalized: recipes.filter(r => r.status === 'Finalized').length,
    Rejected: recipes.filter(r => r.status === 'Rejected').length,
  }

  const transitionRecipe = async (recipe: Recipe, newStatus: ApprovalStatus) => {
    const logEntry = {
      from: recipe.status,
      to: newStatus,
      by: user?.name || 'Unknown',
      comment: comment.trim(),
      timestamp: new Date().toISOString(),
    }

    // Update recipe
    const updated = {
      ...recipe,
      status: newStatus as any,
      updated_at: new Date().toISOString(),
    }

    try {
      await db.recipes.update(recipe.id, updated)

      // Update approval log
      const newLog = { ...approvalLog }
      if (!newLog[recipe.id]) newLog[recipe.id] = []
      newLog[recipe.id] = [...newLog[recipe.id], logEntry]
      setApprovalLog(newLog)
      localStorage.setItem('approval_log', JSON.stringify(newLog))

      // Add to sync queue for online sync
      addToQueue({ table: 'recipes', action: 'update', data: updated })

      toast.success(`${recipe.recipe_no}: ${recipe.status} → ${newStatus}`)
      setComment('')
      setSelectedRecipe(null)
      await loadRecipes()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const getStatusIcon = (status: ApprovalStatus) => {
    const config = STATUS_CONFIG[status]
    const Icon = config.icon
    return <Icon className="w-4 h-4" style={{ color: config.color }} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="w-8 h-8 text-indigo-500" />
          Approval Workflow
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage recipe approval pipeline: Draft → Pending → Approved → Finalized
        </p>
      </div>

      {/* Status pipeline visualization */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {(['Draft', 'Pending', 'Approved', 'Finalized'] as ApprovalStatus[]).map((status, idx, arr) => {
            const config = STATUS_CONFIG[status]
            const count = statusCounts[status]
            return (
              <div key={status} className="flex items-center gap-2">
                <button
                  onClick={() => setFilter(filter === status ? 'All' : status)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-colors ${
                    filter === status
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-border hover:border-indigo-500/30'
                  }`}
                >
                  {getStatusIcon(status)}
                  <span className="font-semibold text-sm">{config.label}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted font-bold">{count}</span>
                </button>
                {idx < arr.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Rejected count */}
      {statusCounts.Rejected > 0 && (
        <button
          onClick={() => setFilter(filter === 'Rejected' ? 'All' : 'Rejected')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            filter === 'Rejected' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-border text-muted-foreground'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          {statusCounts.Rejected} Rejected
        </button>
      )}

      {/* Recipe list */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No recipes with status "{filter}"</p>
          </div>
        )}

        {!loading && filtered.map(recipe => {
          const config = STATUS_CONFIG[recipe.status as ApprovalStatus] || STATUS_CONFIG.Draft
          const transitions = VALID_TRANSITIONS[recipe.status as ApprovalStatus] || []
          const log = approvalLog[recipe.id] || []
          const isSelected = selectedRecipe?.id === recipe.id

          return (
            <div key={recipe.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Recipe header */}
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{recipe.recipe_no}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${config.bg}`} style={{ color: config.color }}>
                      {config.label}
                    </span>
                    {recipe.recipe_stage && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-bold">
                        {recipe.recipe_stage}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {recipe.customer_name} &middot; {recipe.style} &middot; {recipe.wash_type} &middot; {recipe.color}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {recipe.factory_name} &middot; {recipe.recipe_date} &middot; Updated: {new Date(recipe.updated_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/recipes/builder?id=${recipe.id}`)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-lg text-xs font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>

                  {transitions.length > 0 && (
                    <button
                      onClick={() => setSelectedRecipe(isSelected ? null : recipe)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                    >
                      <Send className="w-3.5 h-3.5" /> Action
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Action panel (expanded) */}
              {isSelected && (
                <div className="border-t border-border p-4 bg-muted/30 space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Transition from {recipe.status}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {transitions.map(newStatus => {
                      const nc = STATUS_CONFIG[newStatus]
                      const Icon = nc.icon
                      return (
                        <button
                          key={newStatus}
                          onClick={() => transitionRecipe(recipe, newStatus)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed font-semibold text-sm transition-colors hover:border-solid"
                          style={{ borderColor: nc.color, color: nc.color }}
                        >
                          <Icon className="w-4 h-4" />
                          {newStatus}
                        </button>
                      )
                    })}
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Add comment (optional)…"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {/* Approval log */}
                  {log.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</div>
                      {log.map((entry, idx) => (
                        <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="font-medium">{entry.from}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-medium">{entry.to}</span>
                          <span className="text-muted-foreground">by {entry.by}</span>
                          <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                          {entry.comment && <span className="italic">"{entry.comment}"</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
