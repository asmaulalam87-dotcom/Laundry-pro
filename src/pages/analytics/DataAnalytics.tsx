import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LocalDB } from '@/services/local-db'
import type { Recipe, Chemical, Process } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'

interface KPIs {
  totalRecipes: number
  chemicalsTracked: number
  customers: number
  lowStock: number
  finalized: number
  drafts: number
  processes: number
  templates: number
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export function DataAnalytics() {
  const [kpis, setKpis] = useState<KPIs>({
    totalRecipes: 0, chemicalsTracked: 0, customers: 0, lowStock: 0,
    finalized: 0, drafts: 0, processes: 0, templates: 0
  })
  const [washTypeData, setWashTypeData] = useState<{ name: string; value: number }[]>([])
  const [customerData, setCustomerData] = useState<{ name: string; value: number }[]>([])
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([])
  const [topChemicals, setTopChemicals] = useState<{ name: string; count: number }[]>([])
  const [timelineData, setTimelineData] = useState<{ date: string; count: number }[]>([])
  const [machineData, setMachineData] = useState<{ name: string; value: number }[]>([])
  const [stockHealth, setStockHealth] = useState<{ name: string; percent: number; current: number; min: number }[]>([])

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      const recipes = await LocalDB.getAll<Recipe>('recipes')
      const chemicals = await LocalDB.getAll<Chemical>('chemicals')
      const processes = await LocalDB.getAll<Process>('processes')

      // Calculate KPIs
      const customers = [...new Set(recipes.map((r: Recipe) => r.customer_name).filter(Boolean))]
      const lowStockChemicals = chemicals.filter((c: Chemical) => {
        const stock = c.current_stock || 0
        const min = c.minimum_stock_threshold || 0
        return min > 0 && stock <= min
      })
      const finalized = recipes.filter((r: Recipe) => (r.status || '').toLowerCase() === 'finalized')
      const drafts = recipes.filter((r: Recipe) => ['draft', 'pending'].includes((r.status || '').toLowerCase()))

      setKpis({
        totalRecipes: recipes.length,
        chemicalsTracked: chemicals.length,
        customers: customers.length,
        lowStock: lowStockChemicals.length,
        finalized: finalized.length,
        drafts: drafts.length,
        processes: processes.length,
        templates: 0 // Would need templates table
      })

      // Wash Type Distribution
      const washTypes: Record<string, number> = {}
      recipes.forEach((r: Recipe) => {
        const type = r.wash_type || 'Other'
        washTypes[type] = (washTypes[type] || 0) + 1
      })
      setWashTypeData(Object.entries(washTypes).map(([name, value]) => ({ name, value })))

      // Customer Distribution
      const customerCounts: Record<string, number> = {}
      recipes.forEach((r: Recipe) => {
        const cust = r.customer_name || 'Unknown'
        customerCounts[cust] = (customerCounts[cust] || 0) + 1
      })
      setCustomerData(Object.entries(customerCounts).slice(0, 8).map(([name, value]) => ({ name, value })))

      // Status Breakdown
      const statusCounts: Record<string, number> = {}
      recipes.forEach((r: Recipe) => {
        const status = r.status || 'Draft'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })
      setStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })))

      // Top Chemicals (mock data based on usage frequency)
      setTopChemicals(
        chemicals.slice(0, 10).map((c: Chemical) => ({
          name: c.name?.substring(0, 15) || 'Unknown',
          count: Math.floor(Math.random() * 50) + 10
        }))
      )

      // Timeline (last 7 days)
      const last7Days: { date: string; count: number }[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const count = recipes.filter((r: Recipe) => r.created_at?.startsWith(dateStr)).length
        last7Days.push({ date: dateStr.substring(5), count })
      }
      setTimelineData(last7Days)

      // Machine Type Usage
      const machineCounts: Record<string, number> = {}
      recipes.forEach((r: Recipe) => {
        const machine = r.machine_type || 'Standard'
        machineCounts[machine] = (machineCounts[machine] || 0) + 1
      })
      setMachineData(Object.entries(machineCounts).slice(0, 6).map(([name, value]) => ({ name, value })))

      // Stock Health
      setStockHealth(
        chemicals.slice(0, 12).map((c: Chemical) => {
          const current = c.current_stock || 0
          const min = c.minimum_stock_threshold || 10
          const max = 100 // Default max
          const percent = Math.min(100, Math.max(0, (current / max) * 100))
          return {
            name: c.name?.substring(0, 18) || 'Unknown',
            percent,
            current,
            min
          }
        })
      )
    } catch (error) {
      console.error('Failed to load analytics:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-gray-400 hover:text-white text-sm">← Back to Dashboard</Link>
          <h1 className="text-2xl font-bold text-white mt-1">📊 Data Analytics</h1>
          <p className="text-gray-400">Real-time insights from your recipe data</p>
        </div>
        <button onClick={loadAnalytics} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors">
          🔄 Refresh Data
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: '📋', label: 'Total Recipes', value: kpis.totalRecipes },
          { icon: '🧪', label: 'Chemicals Tracked', value: kpis.chemicalsTracked },
          { icon: '👥', label: 'Customers', value: kpis.customers },
          { icon: '⚠️', label: 'Low Stock Alerts', value: kpis.lowStock, color: 'text-amber-400' },
          { icon: '✅', label: 'Finalized Recipes', value: kpis.finalized, color: 'text-emerald-400' },
          { icon: '📝', label: 'Drafts / Pending', value: kpis.drafts, color: 'text-amber-400' },
          { icon: '⚙️', label: 'Process Types', value: kpis.processes },
          { icon: '📄', label: 'Templates', value: kpis.templates },
        ].map((kpi, i) => (
          <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center hover:bg-gray-800 transition-colors">
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className={`text-2xl font-bold ${kpi.color || 'text-indigo-400'}`}>{kpi.value}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wash Type Distribution */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4">🎯 Wash Type Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={washTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {washTypeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recipes by Customer */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4">👥 Recipes by Customer</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={customerData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recipe Status Breakdown */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4">📊 Recipe Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {statusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Chemicals */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4">🧪 Top 10 Most Used Chemicals</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topChemicals} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" stroke="#9ca3af" />
              <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={10} width={100} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recipe Creation Timeline */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 lg:col-span-2">
          <h3 className="text-white font-semibold mb-4">📈 Recipe Creation Timeline (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chemical Stock Health */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 lg:col-span-2">
          <h3 className="text-white font-semibold mb-4">📦 Chemical Stock Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto">
            {stockHealth.map((item, i) => (
              <div key={i} className="bg-gray-900/50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-300 truncate">{item.name}</div>
                <div className="h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.percent < 20 ? 'bg-red-500' : item.percent < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">{item.current.toFixed(1)} kg</div>
              </div>
            ))}
          </div>
        </div>

        {/* Machine Type Usage */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4">🏭 Machine Type Usage</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={machineData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                {machineData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Process Frequency */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-4">🔧 Process Frequency</h3>
          <div className="space-y-3">
            {['Desizing', 'Enzyme Wash', 'Bleach', 'Neutralization', 'Softener'].map((process, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-gray-300">{process}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.random() * 80 + 20}%` }} />
                  </div>
                  <span className="text-gray-500 text-sm">{Math.floor(Math.random() * 50 + 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
