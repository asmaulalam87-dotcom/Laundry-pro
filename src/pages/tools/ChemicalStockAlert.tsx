import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/services/local-db'
import { AlertTriangle, TrendingDown, Package, Clock, CheckCircle, Download, ShoppingCart, BarChart3, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface ChemicalAlert {
  id: string
  name: string
  category: string
  current_stock: number
  min_stock: number
  unit: string
  supplier: string
  alert_type: 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'ok'
  days_until_expiry?: number
  shelf_life?: string
  cost_per_unit?: number
  usage_rate?: number
  days_until_depletion?: number
}

export const ChemicalStockAlert = () => {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<ChemicalAlert[]>([])
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'ok'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'urgency' | 'name' | 'stock' | 'category'>('urgency')

  useEffect(() => { loadAlerts() }, [])

  const loadAlerts = async () => {
    const chemicals = await db.chemicals.toArray()

    const alertData: ChemicalAlert[] = chemicals.map((c: any) => {
      let alert_type: ChemicalAlert['alert_type'] = 'ok'
      const current = Number(c.current_stock) || 0
      const min = Number(c.min_stock) || 0

      if (current <= 0) {
        alert_type = 'out_of_stock'
      } else if (current <= min) {
        alert_type = 'low_stock'
      }

      let days_until_expiry: number | undefined
      if (c.shelf_life && c.created_at) {
        const created = new Date(c.created_at)
        const shelfDays = parseInt(c.shelf_life)
        if (!isNaN(shelfDays)) {
          const expiryDate = new Date(created.getTime() + shelfDays * 24 * 60 * 60 * 1000)
          days_until_expiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          if (days_until_expiry <= 30 && days_until_expiry > 0) {
            alert_type = 'expiring_soon'
          } else if (days_until_expiry <= 0 && alert_type === 'ok') {
            alert_type = 'low_stock'
          }
        }
      }

      // Estimate usage rate and days until depletion
      const usageRate = Number((c as any).monthly_usage) || Number((c as any).usage_rate) || 0
      const daysUntilDepletion = usageRate > 0 && current > 0 ? Math.round((current / usageRate) * 30) : undefined

      return {
        id: c.id,
        name: c.name,
        category: c.category || 'Uncategorized',
        current_stock: current,
        min_stock: min,
        unit: c.unit || 'kg',
        supplier: c.supplier || 'Unknown',
        alert_type,
        shelf_life: c.shelf_life,
        days_until_expiry,
        cost_per_unit: Number((c as any).cost_per_unit) || 0,
        usage_rate: usageRate,
        days_until_depletion: daysUntilDepletion,
      }
    })

    setAlerts(alertData)
  }

  const critical = alerts.filter(a => a.alert_type === 'out_of_stock')
  const warning = alerts.filter(a => a.alert_type === 'low_stock' || a.alert_type === 'expiring_soon')
  const ok = alerts.filter(a => a.alert_type === 'ok')

  // Category list
  const categories = ['all', ...Array.from(new Set(alerts.map(a => a.category)))]

  // Filtered + sorted
  let filtered = filter === 'all' ? alerts
    : filter === 'critical' ? critical
    : filter === 'warning' ? warning
    : ok

  if (categoryFilter !== 'all') {
    filtered = filtered.filter(a => a.category === categoryFilter)
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(a => a.name.toLowerCase().includes(q) || a.supplier.toLowerCase().includes(q))
  }

  // Sort
  const urgencyOrder = { out_of_stock: 0, low_stock: 1, expiring_soon: 2, ok: 3 }
  if (sortBy === 'urgency') filtered.sort((a, b) => urgencyOrder[a.alert_type] - urgencyOrder[b.alert_type])
  else if (sortBy === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name))
  else if (sortBy === 'stock') filtered.sort((a, b) => a.current_stock - b.current_stock)
  else if (sortBy === 'category') filtered.sort((a, b) => a.category.localeCompare(b.category))

  // Category breakdown for chart
  const categoryCounts = alerts.reduce<Record<string, { total: number; critical: number; warning: number }>>((acc, a) => {
    if (!acc[a.category]) acc[a.category] = { total: 0, critical: 0, warning: 0 }
    acc[a.category].total++
    if (a.alert_type === 'out_of_stock') acc[a.category].critical++
    if (a.alert_type === 'low_stock' || a.alert_type === 'expiring_soon') acc[a.category].warning++
    return acc
  }, {})

  const ALERT_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
    out_of_stock: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Out of Stock' },
    low_stock: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'Low Stock' },
    expiring_soon: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', label: 'Expiring Soon' },
    ok: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'OK' },
  }

  const handleExport = () => {
    const lines = [
      `CHEMICAL STOCK ALERT REPORT`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `SUMMARY:`,
      `  Out of Stock: ${critical.length}`,
      `  Low / Expiring: ${warning.length}`,
      `  OK: ${ok.length}`,
      `  Total: ${alerts.length}`,
      ``,
      `ALERTS:`,
      `${'Name'.padEnd(30)} ${'Category'.padEnd(15)} ${'Status'.padEnd(15)} ${'Current'.padEnd(10)} ${'Min'.padEnd(10)} Unit  Supplier`,
      '-'.repeat(100),
      ...filtered.map(a =>
        `${a.name.padEnd(30)} ${a.category.padEnd(15)} ${ALERT_STYLES[a.alert_type].label.padEnd(15)} ${String(a.current_stock).padEnd(10)} ${String(a.min_stock).padEnd(10)} ${a.unit.padEnd(5)} ${a.supplier}`
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-alerts-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Alert report exported')
  }

  const handleReorderAll = () => {
    const reorderItems = alerts.filter(a => a.alert_type === 'out_of_stock' || a.alert_type === 'low_stock')
    if (reorderItems.length === 0) { toast.info('No items need reordering'); return }
    const list = reorderItems.map(a => `• ${a.name}: ${a.current_stock} ${a.unit} (min: ${a.min_stock})`).join('\n')
    toast.success(`${reorderItems.length} items flagged for reorder`)
    // Copy to clipboard
    navigator.clipboard.writeText(`REORDER LIST:\n${list}`).then(() => {
      toast.success('Reorder list copied to clipboard')
    }).catch(() => {
      toast.info('Reorder items: ' + reorderItems.map(a => a.name).join(', '))
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
            Chemical Stock Alerts
          </h1>
          <p className="text-muted-foreground mt-1">Monitor stock levels, expiry dates, and reorder requirements</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAlerts}
            className="px-3 py-2 bg-muted hover:bg-muted/70 border border-border rounded-lg text-xs font-semibold flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button onClick={handleReorderAll}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1">
            <ShoppingCart className="w-3.5 h-3.5" /> Reorder All
          </button>
          <button onClick={handleExport}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Out of Stock', count: critical.length, icon: AlertTriangle, color: 'bg-red-500/10 border-red-500/30 text-red-400' },
          { label: 'Low / Expiring', count: warning.length, icon: TrendingDown, color: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
          { label: 'In Stock', count: ok.length, icon: CheckCircle, color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
          { label: 'Total Chemicals', count: alerts.length, icon: Package, color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' },
        ].map(s => (
          <button key={s.label} onClick={() => {
            if (s.label === 'Out of Stock') setFilter('critical')
            else if (s.label === 'Low / Expiring') setFilter('warning')
            else if (s.label === 'In Stock') setFilter('ok')
            else setFilter('all')
          }} className={`rounded-lg border p-4 text-center ${s.color} hover:opacity-80 transition-opacity`}>
            <s.icon className="w-5 h-5 mx-auto mb-1" />
            <div className="text-3xl font-bold">{s.count}</div>
            <div className="text-xs font-semibold mt-1">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Category chart */}
      {Object.keys(categoryCounts).length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" /> Category Breakdown
          </h3>
          <div className="space-y-1.5">
            {Object.entries(categoryCounts).sort((a, b) => (b[1].critical + b[1].warning) - (a[1].critical + a[1].warning)).map(([cat, data]) => (
              <div key={cat} className="flex items-center gap-3 text-sm">
                <span className="w-32 truncate font-medium">{cat}</span>
                <div className="flex-1 bg-muted rounded-full h-3 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-red-500 rounded-l-full"
                    style={{ width: `${(data.critical / data.total) * 100}%` }} />
                  <div className="absolute inset-y-0 bg-amber-500"
                    style={{ left: `${(data.critical / data.total) * 100}%`, width: `${(data.warning / data.total) * 100}%` }} />
                  <div className="absolute inset-y-0 right-0 bg-emerald-500 rounded-r-full"
                    style={{ width: `${((data.total - data.critical - data.warning) / data.total) * 100}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-14 text-right">{data.total} items</span>
                {(data.critical > 0 || data.warning > 0) && (
                  <span className="text-xs text-amber-400 w-16 text-right">
                    {data.critical > 0 && `${data.critical} critical`}
                    {data.critical > 0 && data.warning > 0 && ' · '}
                    {data.warning > 0 && `${data.warning} warn`}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full" /> Critical</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full" /> Warning</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" /> OK</span>
          </div>
        </div>
      )}

      {/* Filters + search + sort */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter tabs */}
        <div className="flex gap-1">
          {[
            { key: 'all', label: 'All', count: alerts.length },
            { key: 'critical', label: 'Critical', count: critical.length },
            { key: 'warning', label: 'Warning', count: warning.length },
            { key: 'ok', label: 'OK', count: ok.length },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filter === f.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-muted text-muted-foreground border-border hover:bg-muted/70'
              }`}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Category filter */}
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="px-2 py-1.5 bg-muted border border-border rounded-lg text-xs">
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
        </select>

        {/* Search */}
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search chemical..." className="px-3 py-1.5 bg-muted border border-border rounded-lg text-xs flex-1 min-w-[140px]" />

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="px-2 py-1.5 bg-muted border border-border rounded-lg text-xs">
          <option value="urgency">Sort: Urgency</option>
          <option value="name">Sort: Name</option>
          <option value="stock">Sort: Stock Level</option>
          <option value="category">Sort: Category</option>
        </select>
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No chemicals match the current filter</p>
          </div>
        ) : (
          filtered.map(chem => {
            const style = ALERT_STYLES[chem.alert_type]
            const stockPercent = chem.min_stock > 0 ? Math.min(100, Math.round((chem.current_stock / chem.min_stock) * 100)) : 100

            return (
              <div key={chem.id} className={`rounded-lg border p-4 ${style.bg} ${style.border}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {chem.alert_type === 'out_of_stock' && <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
                    {chem.alert_type === 'low_stock' && <TrendingDown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
                    {chem.alert_type === 'expiring_soon' && <Clock className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />}
                    {chem.alert_type === 'ok' && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{chem.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${style.bg} ${style.text} border ${style.border}`}>
                          {style.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {chem.category}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Supplier: {chem.supplier}
                        {chem.shelf_life && <span> · Shelf: {chem.shelf_life}</span>}
                        {chem.cost_per_unit != null && chem.cost_per_unit > 0 && <span> · Cost: ${(chem.cost_per_unit as number).toFixed(2)}/{chem.unit}</span>}
                        {chem.days_until_depletion !== undefined && (
                          <span className={chem.days_until_depletion <= 14 ? ' text-amber-400' : ''}>
                            {' · ~'}{chem.days_until_depletion} days until depletion
                          </span>
                        )}
                      </div>
                      {/* Reorder suggestion */}
                      {(chem.alert_type === 'out_of_stock' || chem.alert_type === 'low_stock') && chem.min_stock > 0 && (
                        <div className="mt-1.5 text-xs">
                          <button onClick={() => {
                            const reorderQty = chem.min_stock * 2 - chem.current_stock
                            toast.info(`Reorder ${chem.name}: ${reorderQty} ${chem.unit} (to 2x min stock)`)
                          }} className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-semibold flex items-center gap-1">
                            <ShoppingCart className="w-3 h-3" /> Suggest Reorder
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm">
                      <span className={`font-bold ${style.text}`}>{chem.current_stock}</span>
                      <span className="text-muted-foreground"> / {chem.min_stock} {chem.unit}</span>
                    </div>
                    <div className="w-24 mt-1 bg-muted rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          stockPercent <= 0 ? 'bg-red-500' : stockPercent <= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.max(stockPercent, 2)}%` }}
                      />
                    </div>
                    <button onClick={() => navigate('/chemicals')}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 mt-1">
                      Edit Stock →
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
