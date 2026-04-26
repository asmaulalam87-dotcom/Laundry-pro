import { useState, useEffect } from 'react'
import { db } from '@/services/local-db'
import { toast } from 'sonner'
import { Calendar, Plus, Trash2, Play, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react'

interface ScheduleEntry {
  id: string
  recipe_id: string
  recipe_no: string
  customer_name: string
  style: string
  wash_type: string
  machine: string
  date: string
  time_slot: string
  status: 'queued' | 'running' | 'completed' | 'delayed'
  notes: string
}

const MACHINES = ['Machine A', 'Machine B', 'Machine C', 'Machine D', 'Machine E', 'Machine F']
const TIME_SLOTS = ['06:00–08:00', '08:00–10:00', '10:00–12:00', '12:00–14:00', '14:00–16:00', '16:00–18:00', '18:00–20:00', '20:00–22:00']
const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  running: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  delayed: 'bg-red-500/10 text-red-400 border-red-500/30',
}
const STATUS_ICONS: Record<string, any> = {
  queued: Clock,
  running: Loader2,
  completed: CheckCircle,
  delayed: AlertCircle,
}

const STORAGE_KEY = 'production_schedule'

function loadSchedule(): ScheduleEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveSchedule(entries: ScheduleEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export const Scheduling = () => {
  const [entries, setEntries] = useState<ScheduleEntry[]>(loadSchedule())
  const [recipes, setRecipes] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ recipe_id: '', machine: MACHINES[0], date: new Date().toISOString().slice(0, 10), time_slot: TIME_SLOTS[0], notes: '' })

  useEffect(() => {
    db.recipes.toArray().then(setRecipes)
  }, [])

  const dayEntries = entries.filter(e => e.date === selectedDate)

  const handleAdd = () => {
    const recipe = recipes.find(r => r.id === form.recipe_id)
    if (!recipe) { toast.error('Select a recipe'); return }

    // Check for machine conflict
    const conflict = entries.find(e => e.machine === form.machine && e.date === form.date && e.time_slot === form.time_slot && e.status !== 'completed')
    if (conflict) { toast.error(`${form.machine} is already booked for ${form.time_slot}`); return }

    const entry: ScheduleEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      recipe_id: recipe.id,
      recipe_no: recipe.recipe_no,
      customer_name: recipe.customer_name,
      style: recipe.style,
      wash_type: recipe.wash_type,
      machine: form.machine,
      date: form.date,
      time_slot: form.time_slot,
      status: 'queued',
      notes: form.notes,
    }

    const updated = [...entries, entry]
    setEntries(updated)
    saveSchedule(updated)
    setShowAdd(false)
    toast.success('Schedule entry added')
  }

  const handleStatusChange = (id: string, status: ScheduleEntry['status']) => {
    const updated = entries.map(e => e.id === id ? { ...e, status } : e)
    setEntries(updated)
    saveSchedule(updated)
    toast.success(`Status updated to ${status}`)
  }

  const handleDelete = (id: string) => {
    const updated = entries.filter(e => e.id !== id)
    setEntries(updated)
    saveSchedule(updated)
    toast.success('Entry removed')
  }

  // Calendar week view
  const getWeekDates = () => {
    const dates = []
    const d = new Date(selectedDate)
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      dates.push(date.toISOString().slice(0, 10))
    }
    return dates
  }

  const weekDates = getWeekDates()
  const weekEntries = entries.filter(e => weekDates.includes(e.date))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-400" />
            Production Schedule
          </h1>
          <p className="text-muted-foreground mt-1">Plan and manage production runs with machine allocation</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold">New Schedule Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Recipe</label>
              <select value={form.recipe_id} onChange={e => setForm({ ...form, recipe_id: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm">
                <option value="">— Select —</option>
                {recipes.map(r => <option key={r.id} value={r.id}>{r.recipe_no} — {r.customer_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Machine</label>
              <select value={form.machine} onChange={e => setForm({ ...form, machine: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm">
                {MACHINES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Time Slot</label>
              <select value={form.time_slot} onChange={e => setForm({ ...form, time_slot: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm">
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..." className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <button onClick={handleAdd} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold">
                Add to Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['queued', 'running', 'completed', 'delayed'] as const).map(status => {
          const Icon = STATUS_ICONS[status]
          const count = entries.filter(e => e.status === status).length
          return (
            <div key={status} className={`rounded-lg border p-3 ${STATUS_COLORS[status]}`}>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${status === 'running' ? 'animate-spin' : ''}`} />
                <span className="text-sm font-semibold capitalize">{status}</span>
              </div>
              <div className="text-2xl font-bold mt-1">{count}</div>
            </div>
          )
        })}
      </div>

      {/* Week view */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">Week View</h3>
          <div className="flex gap-2">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-muted border border-border rounded-lg text-sm" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-28">Time Slot</th>
                {weekDates.map(d => (
                  <th key={d} className={`px-2 py-2 text-xs font-semibold ${d === new Date().toISOString().slice(0, 10) ? 'text-indigo-400' : 'text-muted-foreground'}`}>
                    {new Date(d + 'T00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map(slot => (
                <tr key={slot} className="border-b border-border/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground font-medium">{slot}</td>
                  {weekDates.map(d => {
                    const cellEntries = weekEntries.filter(e => e.date === d && e.time_slot === slot)
                    return (
                      <td key={d} className="px-1 py-1 align-top min-w-[120px]">
                        {cellEntries.map(e => (
                          <div key={e.id} className={`rounded px-2 py-1 mb-1 text-[10px] border ${STATUS_COLORS[e.status]} cursor-pointer`}
                            onClick={() => {
                              const next = e.status === 'queued' ? 'running' : e.status === 'running' ? 'completed' : 'queued'
                              handleStatusChange(e.id, next as any)
                            }}
                          >
                            <div className="font-bold truncate">{e.recipe_no}</div>
                            <div className="truncate">{e.machine}</div>
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Day detail */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">
          Schedule for {new Date(selectedDate + 'T00:00').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          <span className="text-muted-foreground text-sm ml-2">({dayEntries.length} entries)</span>
        </h3>
        {dayEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No entries for this date</p>
        ) : (
          <div className="space-y-2">
            {dayEntries.sort((a, b) => a.time_slot.localeCompare(b.time_slot)).map(e => {
              const Icon = STATUS_ICONS[e.status]
              return (
                <div key={e.id} className={`flex items-center gap-4 p-3 rounded-lg border ${STATUS_COLORS[e.status]}`}>
                  <Icon className={`w-5 h-5 shrink-0 ${e.status === 'running' ? 'animate-spin' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{e.recipe_no}</span>
                      <span className="text-xs text-muted-foreground">{e.customer_name} · {e.style}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {e.time_slot} · {e.machine} · {e.wash_type}
                      {e.notes && <span className="ml-2">📝 {e.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {e.status !== 'completed' && (
                      <button onClick={() => handleStatusChange(e.id, e.status === 'queued' ? 'running' : 'completed')}
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold">
                        {e.status === 'queued' ? '▶ Start' : '✓ Complete'}
                      </button>
                    )}
                    {e.status !== 'delayed' && e.status !== 'completed' && (
                      <button onClick={() => handleStatusChange(e.id, 'delayed')}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-semibold">
                        ⚠ Delay
                      </button>
                    )}
                    <button onClick={() => handleDelete(e.id)} className="p-1 text-red-400 hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
