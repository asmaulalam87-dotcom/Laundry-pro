import { useState, useEffect } from 'react'
import { db } from '@/services/local-db'
import { DollarSign, Plus, Trash2, Calculator, Download } from 'lucide-react'
import { toast } from 'sonner'

interface CostLine {
  id: string
  item: string
  category: 'chemical' | 'utility' | 'labor' | 'overhead' | 'other'
  quantity: number
  unit: string
  unitCost: number
}

const CATEGORIES = [
  { value: 'chemical', label: 'Chemical', color: 'text-cyan-400' },
  { value: 'utility', label: 'Utility', color: 'text-amber-400' },
  { value: 'labor', label: 'Labor', color: 'text-emerald-400' },
  { value: 'overhead', label: 'Overhead', color: 'text-violet-400' },
  { value: 'other', label: 'Other', color: 'text-gray-400' },
] as const

const COMMON_UNITS = ['g/kg', 'g/l', 'ml/l', 'kg', 'liter', 'pcs', 'hour', 'batch']

export const CostEstimator = () => {
  const [lines, setLines] = useState<CostLine[]>([])
  const [chemicals, setChemicals] = useState<any[]>([])
  const [recipeId, setRecipeId] = useState('')
  const [recipes, setRecipes] = useState<any[]>([])
  const [garmentQty, setGarmentQty] = useState(100)
  const [estimateName, setEstimateName] = useState('')

  useEffect(() => {
    db.chemicals.toArray().then(setChemicals)
    db.recipes.toArray().then(setRecipes)
  }, [])

  const addLine = (category: CostLine['category'] = 'chemical') => {
    setLines(prev => [...prev, {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      item: '',
      category,
      quantity: 0,
      unit: 'g/kg',
      unitCost: 0,
    }])
  }

  const updateLine = (id: string, field: keyof CostLine, value: any) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const removeLine = (id: string) => {
    setLines(prev => prev.filter(l => l.id !== id))
  }

  const loadFromRecipe = async () => {
    if (!recipeId) return
    const recipe = await db.recipes.get(recipeId)
    if (!recipe) return
    setEstimateName(`Cost: ${recipe.recipe_no} — ${recipe.customer_name}`)

    const recipeSteps = await db.recipe_steps.where('recipe_id').equals(recipeId).sortBy('step_order')
    const allChemicals = await db.recipe_step_chemicals.toArray()

    const newLines: CostLine[] = []
    for (const step of recipeSteps) {
      const stepChems = allChemicals.filter(c => c.recipe_step_id === step.id)
      for (const c of stepChems) {
        const dbChem = chemicals.find((ch: any) => ch.name === c.chemical_name)
        newLines.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          item: c.chemical_name,
          category: 'chemical',
          quantity: Number(c.dosage) || 0,
          unit: c.unit || 'g/kg',
          unitCost: Number((dbChem as any)?.cost_per_unit) || Number((c as any).cost_per_unit) || 0,
        })
      }
    }
    setLines(newLines)
    toast.success(`Loaded ${newLines.length} chemicals from recipe`)
  }

  const handleItemBlur = (line: CostLine) => {
    if (line.category === 'chemical' && line.item) {
      const dbChem = chemicals.find((c: any) =>
        c.name.toLowerCase() === (line.item || '').toLowerCase() ||
        c.name.toLowerCase().includes((line.item || '').toLowerCase())
      )
      if (dbChem && (dbChem as any).cost_per_unit && !line.unitCost) {
        updateLine(line.id, 'unitCost', (dbChem as any).cost_per_unit)
        updateLine(line.id, 'unit', (dbChem as any).unit || line.unit)
      }
    }
  }

  const lineTotal = (l: CostLine) => l.quantity * l.unitCost
  const categoryTotal = (cat: string) => lines.filter(l => l.category === cat).reduce((sum, l) => sum + lineTotal(l), 0)
  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0)
  const costPerGarment = garmentQty > 0 ? grandTotal / garmentQty : 0
  const chemicalTotal = categoryTotal('chemical')

  const handleExport = () => {
    const txt = [
      `Cost Estimate: ${estimateName || 'Untitled'}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Garment Quantity: ${garmentQty}`,
      ``,
      `ITEMS:`,
      ...lines.map(l => `${l.item.padEnd(30)} ${l.category.padEnd(10)} ${l.quantity} ${l.unit} @ $${l.unitCost} = $${lineTotal(l).toFixed(2)}`),
      ``,
      `TOTAL: $${grandTotal.toFixed(2)}`,
      `Per Garment: $${costPerGarment.toFixed(3)}`,
    ]
    const blob = new Blob([txt.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cost-estimate-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Estimate exported')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-400" />
            Quick Cost Estimator
          </h1>
          <p className="text-muted-foreground mt-1">Estimate recipe costs — load from recipe or build manually</p>
        </div>
        <button onClick={handleExport} disabled={lines.length === 0}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Load from recipe */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Load from Recipe</h3>
        <div className="flex gap-3">
          <select value={recipeId} onChange={e => setRecipeId(e.target.value)}
            className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm">
            <option value="">— Select Recipe —</option>
            {recipes.map(r => (
              <option key={r.id} value={r.id}>{r.recipe_no} — {r.customer_name}</option>
            ))}
          </select>
          <button onClick={loadFromRecipe} disabled={!recipeId}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            Load
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Estimate Name</label>
            <input type="text" value={estimateName} onChange={e => setEstimateName(e.target.value)}
              placeholder="e.g. Cost for Customer ABC" className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Garment Quantity</label>
            <input type="number" value={garmentQty} onChange={e => setGarmentQty(Number(e.target.value) || 1)}
              min={1} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat.value} onClick={() => addLine(cat.value)}
                className={`px-2 py-1.5 bg-muted hover:bg-muted/70 border border-border rounded-lg text-xs font-semibold ${cat.color}`}>
                + {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cost lines table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Item</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-28">Category</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground w-20">Qty</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground w-20">Unit</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground w-24">Unit Cost</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground w-24">Total</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                No items yet. Click a category button above or load from a recipe.
              </td></tr>
            ) : lines.map(line => {
              const catConfig = CATEGORIES.find(c => c.value === line.category)
              return (
                <tr key={line.id} className="border-b border-border/30">
                  <td className="px-3 py-1.5">
                    <input type="text" value={line.item} onChange={e => updateLine(line.id, 'item', e.target.value)}
                      onBlur={() => handleItemBlur(line)} placeholder="Item name..."
                      className="w-full bg-transparent text-sm focus:outline-none" />
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={line.category} onChange={e => updateLine(line.id, 'category', e.target.value)}
                      className="w-full bg-transparent text-xs focus:outline-none">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" value={line.quantity} onChange={e => updateLine(line.id, 'quantity', Number(e.target.value))}
                      className="w-full bg-transparent text-sm text-right focus:outline-none" min={0} step={0.01} />
                  </td>
                  <td className="px-3 py-1.5">
                    <select value={line.unit} onChange={e => updateLine(line.id, 'unit', e.target.value)}
                      className="w-full bg-transparent text-xs focus:outline-none">
                      {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" value={line.unitCost} onChange={e => updateLine(line.id, 'unitCost', Number(e.target.value))}
                      className="w-full bg-transparent text-sm text-right focus:outline-none" min={0} step={0.01} />
                  </td>
                  <td className="px-3 py-1.5 text-sm text-right font-semibold text-emerald-400">
                    ${lineTotal(line).toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5">
                    <button onClick={() => removeLine(line.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {lines.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-sm">Cost Breakdown</h3>
            {CATEGORIES.filter(c => categoryTotal(c.value) > 0).map(cat => {
              const total = categoryTotal(cat.value)
              const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0
              return (
                <div key={cat.value} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={cat.color}>{cat.label}</span>
                    <span className="font-semibold">${total.toFixed(2)} <span className="text-xs text-muted-foreground">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-current h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Total Estimated Cost</div>
                <div className="text-3xl font-bold text-emerald-400">${grandTotal.toFixed(2)}</div>
              </div>
              <Calculator className="w-8 h-8 text-emerald-400/30" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-emerald-500/20">
              <div>
                <div className="text-xs text-muted-foreground">Per Garment</div>
                <div className="text-lg font-bold text-emerald-300">${costPerGarment.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Garment Qty</div>
                <div className="text-lg font-bold">{garmentQty}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Chemicals</div>
                <div className="font-semibold text-cyan-400">${chemicalTotal.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Non-Chemical</div>
                <div className="font-semibold">${(grandTotal - chemicalTotal).toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
