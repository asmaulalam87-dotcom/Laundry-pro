import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import {
  FileText, Settings, FlaskConical, Calculator, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, ShieldCheck, Calendar,
  Activity, Droplets, Package, ArrowRight, BarChart3,
} from 'lucide-react'
import { db } from '@/services/local-db'
import type { Recipe, Chemical, CostingRecord } from '@/types'

// ── Color palette ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  Draft: '#6366f1', Pending: '#f59e0b', Approved: '#22c55e',
  Finalized: '#0ea5e9', Rejected: '#ef4444',
}
const PIE_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#0ea5e9', '#ef4444', '#8b5cf6', '#ec4899']

export const Dashboard = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ recipes: 0, processes: 0, chemicals: 0, costings: 0 })
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([])
  const [lowStock, setLowStock] = useState<Chemical[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [statusBreakdown, setStatusBreakdown] = useState<any[]>([])
  const [costTrend, setCostTrend] = useState<any[]>([])
  const [topChemicals, setTopChemicals] = useState<any[]>([])
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const [upcomingSchedule, setUpcomingSchedule] = useState<any[]>([])
  const [washTypeBreakdown, setWashTypeBreakdown] = useState<any[]>([])

  useEffect(() => { loadDashboardData() }, [])

  const loadDashboardData = async () => {
    const recipes = await db.recipes.toArray()
    const processes = await db.processes.toArray()
    const chemicals = await db.chemicals.toArray()
    const costings = await db.costing_records.toArray()

    setStats({
      recipes: recipes.length,
      processes: processes.length,
      chemicals: chemicals.length,
      costings: costings.length,
    })

    setRecentRecipes(
      recipes
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
    )

    // Low stock alerts
    setLowStock(chemicals.filter(c => c.current_stock <= c.minimum_stock_threshold))

    // ── Status breakdown (Pie chart) ──────────────────────────────────────────
    const statusMap: Record<string, number> = {}
    recipes.forEach(r => { statusMap[r.status] = (statusMap[r.status] || 0) + 1 })
    setStatusBreakdown(
      Object.entries(statusMap).map(([name, value]) => ({ name, value }))
    )

    // ── Wash type breakdown ────────────────────────────────────────────────────
    const washMap: Record<string, number> = {}
    recipes.forEach(r => { washMap[r.wash_type || 'Other'] = (washMap[r.wash_type || 'Other'] || 0) + 1 })
    setWashTypeBreakdown(
      Object.entries(washMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
    )

    // ── Daily activity (Last 7 days) ──────────────────────────────────────────
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const count = recipes.filter(r => r.created_at?.split('T')[0] === dateStr).length
      last7Days.push({ day: d.toLocaleDateString('en-US', { weekday: 'short' }), count })
    }
    setChartData(last7Days)

    // ── Cost trend (last 30 days) ──────────────────────────────────────────────
    const costByDay: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      costByDay[dateStr] = 0
    }
    costings.forEach(c => {
      const dateStr = (c as any).created_at?.split('T')[0]
      if (dateStr && costByDay[dateStr] !== undefined) {
        costByDay[dateStr] += (c as any).total_cost || c.cost_per_kg || 0
      }
    })
    setCostTrend(
      Object.entries(costByDay).map(([date, cost]) => ({
        date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cost: Math.round(cost * 100) / 100,
      }))
    )

    // ── Top chemicals by usage (from recipe_step_chemicals) ────────────────────
    const stepChemicals = await db.recipe_step_chemicals.toArray()
    const chemUsage: Record<string, { name: string; totalDosage: number }> = {}
    stepChemicals.forEach(sc => {
      const name = sc.chemical_name || 'Unknown'
      if (!chemUsage[name]) chemUsage[name] = { name, totalDosage: 0 }
      chemUsage[name].totalDosage += Number(sc.dosage) || 0
    })
    setTopChemicals(
      Object.values(chemUsage)
        .sort((a, b) => b.totalDosage - a.totalDosage)
        .slice(0, 8)
        .map(c => ({ ...c, totalDosage: Math.round(c.totalDosage * 100) / 100 }))
    )

    // ── Pending approvals ──────────────────────────────────────────────────────
    const pendingCount = recipes.filter(r => r.status === 'Pending').length
    setPendingApprovals(pendingCount)

    // ── Upcoming schedule (placeholder — from local data) ──────────────────────
    try {
      const schedule = await (db as any).production_schedule?.toArray() || []
      setUpcomingSchedule(schedule.slice(0, 5))
    } catch { setUpcomingSchedule([]) }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Laundry Pro Recipe System</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/recipes/builder')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <FileText className="w-4 h-4" /> New Recipe
          </button>
          <button onClick={() => navigate('/reports')}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <BarChart3 className="w-4 h-4" /> Reports
          </button>
        </div>
      </div>

      {/* ── Stats Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Total Recipes" value={stats.recipes} color="primary"
          onClick={() => navigate('/recipes')} />
        <StatCard icon={Settings} label="Processes" value={stats.processes} color="secondary"
          onClick={() => navigate('/processes')} />
        <StatCard icon={FlaskConical} label="Chemicals" value={stats.chemicals} color="accent"
          onClick={() => navigate('/chemicals')} />
        <StatCard icon={Calculator} label="Costings" value={stats.costings} color="warning"
          onClick={() => navigate('/costing-list')} />
      </div>

      {/* ── Quick Actions Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {pendingApprovals > 0 && (
          <button onClick={() => navigate('/approval')}
            className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <div className="text-left">
              <p className="text-sm font-semibold text-amber-500">{pendingApprovals} Pending</p>
              <p className="text-[11px] text-muted-foreground">Approval Queue</p>
            </div>
          </button>
        )}
        {lowStock.length > 0 && (
          <button onClick={() => navigate('/stock-alerts')}
            className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <div className="text-left">
              <p className="text-sm font-semibold text-red-500">{lowStock.length} Low Stock</p>
              <p className="text-[11px] text-muted-foreground">Chemical Alerts</p>
            </div>
          </button>
        )}
        <button onClick={() => navigate('/templates')}
          className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/20 transition-colors">
          <Package className="w-5 h-5 text-indigo-500" />
          <div className="text-left">
            <p className="text-sm font-semibold text-indigo-500">Templates</p>
            <p className="text-[11px] text-muted-foreground">Recipe Library</p>
          </div>
        </button>
        <button onClick={() => navigate('/scheduling')}
          className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors">
          <Calendar className="w-5 h-5 text-emerald-500" />
          <div className="text-left">
            <p className="text-sm font-semibold text-emerald-500">Schedule</p>
            <p className="text-[11px] text-muted-foreground">Production Plan</p>
          </div>
        </button>
      </div>

      {/* ── Charts Row 1: Activity + Status Breakdown ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" /> Daily Activity (Last 7 Days)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown Pie */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recipe Status</h2>
          {statusBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                    dataKey="value" paddingAngle={2} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {statusBreakdown.map((s, i) => (
                  <span key={s.name} className="flex items-center gap-1 text-[11px]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[s.name] || PIE_COLORS[i] }} />
                    {s.name} ({s.value})
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Charts Row 2: Cost Trend + Chemical Usage ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Trend */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" /> Cost Trend (30 Days)
          </h2>
          {costTrend.every(d => d.cost === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Calculator className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No costing data yet</p>
              <button onClick={() => navigate('/costing')} className="mt-2 text-xs text-indigo-500 hover:underline">
                Create your first costing
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={costTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Line type="monotone" dataKey="cost" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Chemicals */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500" /> Top Chemical Usage
          </h2>
          {topChemicals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FlaskConical className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No usage data yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topChemicals.map((chem, i) => {
                const maxDosage = topChemicals[0]?.totalDosage || 1
                const pct = Math.min((chem.totalDosage / maxDosage) * 100, 100)
                return (
                  <div key={chem.name} className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-muted-foreground w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm truncate">{chem.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{chem.totalDosage}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Charts Row 3: Wash Type Breakdown + Recent Recipes ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wash Type Breakdown */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Wash Type Distribution</h2>
          {washTypeBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={washTypeBreakdown} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Recent Recipes */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Recipes</h2>
            <button onClick={() => navigate('/recipes')} className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentRecipes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No recipes yet</p>
          ) : (
            <div className="space-y-2">
              {recentRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => navigate(`/recipes/builder?id=${recipe.id}`)}
                  className="w-full flex items-center justify-between p-2.5 bg-muted/50 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{
                        background: (STATUS_COLORS[recipe.status] || '#6366f1') + '20',
                        color: STATUS_COLORS[recipe.status] || '#6366f1',
                      }}>
                      {recipe.status}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{recipe.recipe_no}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{recipe.customer_name} · {recipe.style}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                    {new Date(recipe.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Low Stock Alerts ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" /> Low Stock Alerts
          </h2>
          <button onClick={() => navigate('/chemicals')} className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
            Manage Stock <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {lowStock.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 text-emerald-500">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm">All stock levels are healthy</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStock.slice(0, 6).map((chem) => (
              <div key={chem.id} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{chem.name}</p>
                  <p className="text-[11px] text-muted-foreground">{chem.category}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-bold text-red-500">{chem.current_stock.toFixed(1)} {chem.unit}</p>
                  <p className="text-[11px] text-muted-foreground">Min: {chem.minimum_stock_threshold}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, onClick }: any) => {
  const colorClasses: Record<string, string> = {
    primary: 'bg-indigo-500/10 text-indigo-500',
    secondary: 'bg-purple-500/10 text-purple-500',
    accent: 'bg-emerald-500/10 text-emerald-500',
    warning: 'bg-yellow-500/10 text-yellow-500',
  }

  return (
    <button
      onClick={onClick}
      className="w-full bg-card border border-border rounded-lg p-5 hover:shadow-lg transition-all text-left group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <TrendingUp className="w-4 h-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
      </div>
      <p className="text-2xl font-bold mb-0.5">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  )
}
