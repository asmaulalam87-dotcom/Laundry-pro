import { useState, useEffect } from 'react'
import { db } from '@/services/local-db'
import { toast } from 'sonner'
import { Monitor, Play, Pause, CheckCircle, AlertTriangle, Thermometer, Clock, FlaskConical, Loader2 } from 'lucide-react'

interface FloorJob {
  id: string
  recipe_id: string
  recipe_no: string
  customer_name: string
  style: string
  color: string
  wash_type: string
  current_step: number
  total_steps: number
  current_process: string
  status: 'waiting' | 'in_progress' | 'completed' | 'issue'
  machine: string
  started_at: string
  steps: any[]
}

const STORAGE_KEY = 'shop_floor_jobs'

function loadJobs(): FloorJob[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveJobs(jobs: FloorJob[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
}

const MACHINES = ['Machine A', 'Machine B', 'Machine C', 'Machine D', 'Machine E', 'Machine F']
const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  waiting: { color: 'bg-blue-500/10 border-blue-500/30 text-blue-400', icon: Clock },
  in_progress: { color: 'bg-amber-500/10 border-amber-500/30 text-amber-400', icon: Play },
  completed: { color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: CheckCircle },
  issue: { color: 'bg-red-500/10 border-red-500/30 text-red-400', icon: AlertTriangle },
}

export const ShopFloor = () => {
  const [jobs, setJobs] = useState<FloorJob[]>(loadJobs())
  const [recipes, setRecipes] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState('')
  const [selectedMachine, setSelectedMachine] = useState(MACHINES[0])

  useEffect(() => {
    db.recipes.toArray().then(setRecipes)
  }, [])

  const handleAddJob = async () => {
    const recipe = recipes.find(r => r.id === selectedRecipe)
    if (!recipe) { toast.error('Select a recipe'); return }

    const steps = await db.recipe_steps
      .where('recipe_id').equals(recipe.id)
      .sortBy('step_order')

    const job: FloorJob = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      recipe_id: recipe.id,
      recipe_no: recipe.recipe_no,
      customer_name: recipe.customer_name,
      style: recipe.style,
      color: recipe.color,
      wash_type: recipe.wash_type,
      current_step: 0,
      total_steps: steps.length,
      current_process: steps[0]?.process_name || 'N/A',
      status: 'waiting',
      machine: selectedMachine,
      started_at: new Date().toISOString(),
      steps,
    }

    const updated = [...jobs, job]
    setJobs(updated)
    saveJobs(updated)
    setShowAdd(false)
    toast.success(`Job ${recipe.recipe_no} added to ${selectedMachine}`)
  }

  const handleStatusChange = (id: string, status: FloorJob['status']) => {
    const updated = jobs.map(j => j.id === id ? { ...j, status } : j)
    setJobs(updated)
    saveJobs(updated)
  }

  const handleAdvanceStep = (id: string) => {
    const updated = jobs.map(j => {
      if (j.id !== id) return j
      const next = j.current_step + 1
      if (next >= j.total_steps) {
        return { ...j, current_step: next, status: 'completed' as const, current_process: 'Done' }
      }
      return {
        ...j,
        current_step: next,
        current_process: j.steps[next]?.process_name || 'N/A',
        status: 'in_progress' as const,
      }
    })
    setJobs(updated)
    saveJobs(updated)
    toast.success('Step advanced')
  }

  const handleRemove = (id: string) => {
    const updated = jobs.filter(j => j.id !== id)
    setJobs(updated)
    saveJobs(updated)
    toast.success('Job removed')
  }

  const waiting = jobs.filter(j => j.status === 'waiting')
  const inProgress = jobs.filter(j => j.status === 'in_progress')
  const completed = jobs.filter(j => j.status === 'completed')
  const issues = jobs.filter(j => j.status === 'issue')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Monitor className="w-8 h-8 text-indigo-400" />
            Shop Floor
          </h1>
          <p className="text-muted-foreground mt-1">Tablet-optimized production tracking & monitoring</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold"
        >
          + Add Job
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Recipe</label>
              <select value={selectedRecipe} onChange={e => setSelectedRecipe(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm">
                <option value="">— Select —</option>
                {recipes.map(r => <option key={r.id} value={r.id}>{r.recipe_no} — {r.customer_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Machine</label>
              <select value={selectedMachine} onChange={e => setSelectedMachine(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm">
                {MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleAddJob} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold">
                Add Job
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Waiting', count: waiting.length, color: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
          { label: 'In Progress', count: inProgress.length, color: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
          { label: 'Completed', count: completed.length, color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
          { label: 'Issues', count: issues.length, color: 'bg-red-500/10 border-red-500/30 text-red-400' },
        ].map(s => (
          <div key={s.label} className={`rounded-lg border p-4 text-center ${s.color}`}>
            <div className="text-3xl font-bold">{s.count}</div>
            <div className="text-xs font-semibold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Machine status grid */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold mb-3">Machine Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {MACHINES.map(machine => {
            const machineJob = jobs.find(j => j.machine === machine && (j.status === 'in_progress' || j.status === 'waiting'))
            return (
              <div key={machine} className={`rounded-lg border p-3 text-center ${machineJob ? STATUS_CONFIG[machineJob.status].color : 'bg-muted/30 border-border'}`}>
                <div className="text-xs font-semibold mb-1">{machine}</div>
                {machineJob ? (
                  <>
                    <div className="text-sm font-bold">{machineJob.recipe_no}</div>
                    <div className="text-[10px] mt-1">{machineJob.current_process}</div>
                    <div className="text-[10px]">Step {machineJob.current_step + 1}/{machineJob.total_steps}</div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">Idle</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Active jobs list */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">All Jobs</h3>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No jobs added yet. Click "+ Add Job" to start.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map(job => {
              const config = STATUS_CONFIG[job.status]
              const Icon = config.icon
              const progress = job.total_steps > 0 ? Math.round(((job.current_step + (job.status === 'completed' ? 1 : 0)) / job.total_steps) * 100) : 0

              return (
                <div key={job.id} className={`rounded-lg border p-4 ${config.color}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${job.status === 'in_progress' ? 'animate-pulse' : ''}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{job.recipe_no}</span>
                          <span className="text-xs">{job.customer_name} · {job.style} · {job.color}</span>
                        </div>
                        <div className="text-xs mt-1">
                          <FlaskConical className="w-3 h-3 inline" /> {job.wash_type} ·
                          <Monitor className="w-3 h-3 inline ml-1" /> {job.machine} ·
                          <span className="ml-1">{job.current_process}</span>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 w-48">
                          <div className="flex items-center justify-between text-[10px] mb-0.5">
                            <span>Step {Math.min(job.current_step + 1, job.total_steps)}/{job.total_steps}</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className="bg-current rounded-full h-1.5 transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {job.status === 'waiting' && (
                        <button onClick={() => handleStatusChange(job.id, 'in_progress')}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold flex items-center gap-1">
                          <Play className="w-3 h-3" /> Start
                        </button>
                      )}
                      {job.status === 'in_progress' && (
                        <button onClick={() => handleAdvanceStep(job.id)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold">
                          Next Step →
                        </button>
                      )}
                      {job.status !== 'issue' && job.status !== 'completed' && (
                        <button onClick={() => handleStatusChange(job.id, 'issue')}
                          className="px-2 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs font-semibold">
                          ⚠ Issue
                        </button>
                      )}
                      {job.status === 'issue' && (
                        <button onClick={() => handleStatusChange(job.id, 'in_progress')}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold">
                          Resume
                        </button>
                      )}
                      <button onClick={() => handleRemove(job.id)} className="p-1 text-red-400 hover:text-red-300">
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
