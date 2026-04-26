import { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { LocalDB } from '@/services/local-db'
import type { Recipe, Chemical } from '@/types'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export const Analytics = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [chartData, setChartData] = useState<any>({
    washType: [],
    statusDistribution: [],
    monthlyTrend: [],
    chemicalUsage: [],
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const recipesData = await LocalDB.getAll<Recipe>('recipes')
    const chemicalsData = await LocalDB.getAll<Chemical>('chemicals')
    setRecipes(recipesData)
    setChemicals(chemicalsData)

    // Wash type distribution
    const washTypes: any = {}
    recipesData.forEach(r => {
      washTypes[r.wash_type || 'Unknown'] = (washTypes[r.wash_type || 'Unknown'] || 0) + 1
    })
    const washTypeData = Object.entries(washTypes).map(([name, value]) => ({ name, value }))

    // Status distribution
    const statuses: any = {}
    recipesData.forEach(r => {
      statuses[r.status] = (statuses[r.status] || 0) + 1
    })
    const statusData = Object.entries(statuses).map(([name, value]) => ({ name, value }))

    // Monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const monthStr = d.toISOString().slice(0, 7)
      const count = recipesData.filter(r => r.created_at?.startsWith(monthStr)).length
      monthlyTrend.push({
        month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        count,
      })
    }

    // Chemical stock
    const chemicalData = chemicalsData.slice(0, 10).map(c => ({
      name: c.name.substring(0, 15),
      stock: c.current_stock,
    }))

    setChartData({ washType: washTypeData, statusDistribution: statusData, monthlyTrend, chemicalUsage: chemicalData })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics & Reports</h1>
        <p className="text-muted-foreground mt-1">Insights and trends</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Wash Type Distribution */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Wash Type Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={chartData.washType} cx="50%" cy="50%" labelLine={false} label outerRadius={80} fill="#8884d8" dataKey="value">
                {chartData.washType.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Recipe Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.statusDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Trend */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Monthly Recipe Creation</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chemical Stock */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Chemical Stock Levels</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.chemicalUsage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="stock" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
