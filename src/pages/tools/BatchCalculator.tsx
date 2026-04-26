import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/services/local-db'
import { Calculator, Plus, Minus, ArrowRight, Download, Printer, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

export const BatchCalculator = () => {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null)
  const [steps, setSteps] = useState<any[]>([])
  const [chemicals, setChemicals] = useState<any[]>([])
  const [batchSize, setBatchSize] = useState(1)
  const [baseQty, setBaseQty] = useState(100)
  const [showCost, setShowCost] = useState(true)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  useEffect(() => {
    db.recipes.toArray().then(setRecipes)
    db.chemicals.toArray().then(setChemicals)
  }, [])

  useEffect(() => { loadData() }, [selectedId])

  const loadData = async () => {
    if (!selectedId) { setSelectedRecipe(null); setSteps([]); return }
    const recipe = await db.recipes.get(selectedId)
    if (!recipe) return
    setSelectedRecipe(recipe)
    setBaseQty((recipe as any).garment_qty || 100)

    const recipeSteps = await db.recipe_steps.where('recipe_id').equals(selectedId).sortBy('step_order')
    const allChemicals = await db.recipe_step_chemicals.toArray()
    const enriched = recipeSteps.map(s => ({
      ...s,
      chemicals: allChemicals.filter(c => c.recipe_step_id === s.id),
    }))
    setSteps(enriched)
  }

  const scaleFactor = batchSize / (baseQty || 100)

  const getChemicalCost = (chem: any) => {
    const dbChem = chemicals.find((c: any) => c.name === chem.chemical_name)
    return Number((dbChem as any)?.cost_per_unit) || 0
  }

  const totalChemicalCost = steps.reduce((sum, step) => {
    return sum + step.chemicals.reduce((s: number, c: any) => {
      const dosage = Number(c.dosage) || 0
      const cost = getChemicalCost(c)
      return s + (dosage * scaleFactor * cost)
    }, 0)
  }, 0)

  const totalChemCount = steps.reduce((s, step) => s + (step.chemicals?.length || 0), 0)
  const perGarment = batchSize > 0 ? totalChemicalCost / batchSize : 0

  const handleExport = () => {
    if (!selectedRecipe) return
    const lines: string[] = []
    lines.push(`BATCH CALCULATION REPORT`)
    lines.push(`Generated: ${new Date().toLocaleString()}`)
    lines.push(``)
    lines.push(`Recipe: ${selectedRecipe.recipe_no}`)
    lines.push(`Customer: ${selectedRecipe.customer_name}`)
    lines.push(`Style: ${selectedRecipe.style} · Color: ${selectedRecipe.color}`)
    lines.push(`Wash Type: ${selectedRecipe.wash_type}`)
    lines.push(`Base Quantity: ${baseQty} pcs`)
    lines.push(`Batch Quantity: ${batchSize} pcs`)
    lines.push(`Scale Factor: ${scaleFactor.toFixed(4)}x`)
    lines.push(``)

    steps.forEach((step: any, idx: number) => {
      lines.push(`--- Step ${idx + 1}: ${step.process_name} ---`)
      lines.push(`  Temp: ${step.temperature || '-'}°C | Time: ${step.time_min || step.time_minutes || '-'} min | pH: ${step.ph_range || step.default_ph || '-'} | LR: 1:${step.liquor_ratio || '-'}`)
      if (step.chemicals.length > 0) {
        lines.push(`  Chemicals:`)
        step.chemicals.forEach((c: any) => {
          const orig = Number(c.dosage) || 0
          const scaled = orig * scaleFactor
          const cost = getChemicalCost(c)
          lines.push(`    ${c.chemical_name}: ${orig} ${c.unit || ''} → ${scaled.toFixed(2)} ${c.unit || ''} ($${(scaled * cost).toFixed(2)})`)
        })
      }
    })

    lines.push(``)
    lines.push(`TOTAL CHEMICAL COST: $${totalChemicalCost.toFixed(2)}`)
    lines.push(`PER GARMENT: $${perGarment.toFixed(3)}`)

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-${selectedRecipe.recipe_no}-${batchSize}pcs.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Batch calculation exported')
  }

  const handlePrint = () => { window.print() }

  // Cost per step for bar chart
  const stepCosts = steps.map((step: any, idx: number) => {
    const cost = step.chemicals.reduce((s: number, c: any) => {
      return s + (Number(c.dosage) || 0) * scaleFactor * getChemicalCost(c)
    }, 0)
    return { step: idx + 1, name: step.process_name, cost }
  })
  const maxStepCost = Math.max(...stepCosts.map(s => s.cost), 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calculator className="w-8 h-8 text-indigo-400" />
            Batch Calculator
          </h1>
          <p className="text-muted-foreground mt-1">Scale recipes by batch quantity — auto-calculates dosages & costs</p>
        </div>
        {selectedRecipe && (
          <div className="flex gap-2">
            <button onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
              className="px-3 py-2 bg-muted hover:bg-muted/70 border border-border rounded-lg text-xs font-semibold">
              {viewMode === 'table' ? 'Card View' : 'Table View'}
            </button>
            <button onClick={() => setShowCost(!showCost)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold ${showCost ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground border border-border'}`}>
              $ Cost
            </button>
            <button onClick={handlePrint}
              className="px-3 py-2 bg-muted hover:bg-muted/70 border border-border rounded-lg text-xs font-semibold flex items-center gap-1">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={handleExport}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        )}
      </div>

      {/* Recipe selector + batch config */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Recipe</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Select Recipe —</option>
              {recipes.map(r => (
                <option key={r.id} value={r.id}>{r.recipe_no} — {r.customer_name} · {r.style}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Base Quantity (pcs)</label>
            <input type="number" value={baseQty} onChange={e => setBaseQty(Number(e.target.value))}
              min={1} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Batch Quantity (pcs)</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setBatchSize(Math.max(1, batchSize - 10))}
                className="p-2 bg-muted border border-border rounded-lg hover:bg-muted/70"><Minus className="w-4 h-4" /></button>
              <input type="number" value={batchSize} onChange={e => setBatchSize(Math.max(1, Number(e.target.value)))}
                min={1} className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-center" />
              <button onClick={() => setBatchSize(batchSize + 10)}
                className="p-2 bg-muted border border-border rounded-lg hover:bg-muted/70"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {selectedRecipe && (
          <div className="flex items-center gap-4 text-sm bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-2 flex-wrap">
            <span>Scale Factor: <span className="font-bold text-indigo-400">{scaleFactor.toFixed(3)}x</span></span>
            <span className="text-muted-foreground">|</span>
            <span>Base: <span className="font-semibold">{baseQty} pcs</span></span>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span>Batch: <span className="font-semibold">{batchSize} pcs</span></span>
            <span className="text-muted-foreground">|</span>
            <span>Steps: <span className="font-semibold">{steps.length}</span></span>
            <span>Chemicals: <span className="font-semibold">{totalChemCount}</span></span>
          </div>
        )}

        {/* Quick batch presets */}
        {selectedRecipe && (
          <div className="flex gap-2">
            <span className="text-xs text-muted-foreground self-center">Quick:</span>
            {[50, 100, 200, 500, 1000, 2000].map(qty => (
              <button key={qty} onClick={() => setBatchSize(qty)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${batchSize === qty ? 'bg-indigo-600 text-white' : 'bg-muted hover:bg-muted/70 border border-border'}`}>
                {qty}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scaled recipe */}
      {selectedRecipe && steps.length > 0 && (
        <div className="space-y-4">
          {/* Step cost bar chart */}
          {showCost && stepCosts.some(s => s.cost > 0) && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" /> Cost per Step
              </h3>
              <div className="flex items-end gap-2 h-32">
                {stepCosts.map(s => (
                  <div key={s.step} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-[10px] text-emerald-400 font-semibold">${s.cost.toFixed(1)}</div>
                    <div className="w-full bg-muted rounded-t relative" style={{ height: '80px' }}>
                      <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 rounded-t transition-all"
                        style={{ height: `${(s.cost / maxStepCost) * 80}px` }} />
                    </div>
                    <div className="text-[9px] text-muted-foreground truncate w-full text-center" title={s.name}>
                      S{s.step}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps */}
          {viewMode === 'table' ? (
            steps.map((step: any, idx: number) => (
              <div key={step.id} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded">Step {idx + 1}</span>
                    <span className="font-semibold text-sm">{step.process_name}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {step.temperature && <span>🌡️ {step.temperature}°C</span>}
                    {(step.time_min || step.time_minutes) && <span>⏱️ {step.time_min || step.time_minutes} min</span>}
                    {step.liquor_ratio && <span>💧 1:{step.liquor_ratio}</span>}
                    {step.ph_range && <span>⚗️ {step.ph_range}</span>}
                  </div>
                </div>
                {step.chemicals.length > 0 && (
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="px-4 py-1.5 text-left text-xs text-muted-foreground">Chemical</th>
                        <th className="px-4 py-1.5 text-right text-xs text-muted-foreground">Original</th>
                        <th className="px-4 py-1.5 text-right text-xs text-indigo-400">Scaled ({scaleFactor.toFixed(2)}x)</th>
                        {showCost && <th className="px-4 py-1.5 text-right text-xs text-muted-foreground">Unit Cost</th>}
                        {showCost && <th className="px-4 py-1.5 text-right text-xs text-emerald-400">Scaled Cost</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {step.chemicals.map((c: any, ci: number) => {
                        const originalDosage = Number(c.dosage) || 0
                        const scaledDosage = originalDosage * scaleFactor
                        const unitCost = getChemicalCost(c)
                        const scaledCost = scaledDosage * unitCost
                        return (
                          <tr key={ci} className="border-b border-border/20">
                            <td className="px-4 py-1.5 text-sm">{c.chemical_name}</td>
                            <td className="px-4 py-1.5 text-sm text-right text-muted-foreground">{c.dosage} {c.unit}</td>
                            <td className="px-4 py-1.5 text-sm text-right font-semibold text-indigo-400">
                              {scaledDosage.toFixed(2)} {c.unit}
                            </td>
                            {showCost && <td className="px-4 py-1.5 text-sm text-right text-muted-foreground">${unitCost.toFixed(2)}/{c.unit}</td>}
                            {showCost && <td className="px-4 py-1.5 text-sm text-right font-semibold text-emerald-400">${scaledCost.toFixed(2)}</td>}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))
          ) : (
            /* Card view */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {steps.map((step: any, idx: number) => (
                <div key={step.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded">Step {idx + 1}</span>
                    <span className="font-semibold text-sm">{step.process_name}</span>
                  </div>
                  <div className="flex gap-2 text-[11px] text-muted-foreground">
                    {step.temperature && <span>🌡️ {step.temperature}°C</span>}
                    {(step.time_min || step.time_minutes) && <span>⏱️ {step.time_min || step.time_minutes}m</span>}
                    {step.liquor_ratio && <span>💧1:{step.liquor_ratio}</span>}
                  </div>
                  {step.chemicals.length > 0 && (
                    <div className="space-y-1">
                      {step.chemicals.map((c: any, ci: number) => {
                        const orig = Number(c.dosage) || 0
                        const scaled = orig * scaleFactor
                        return (
                          <div key={ci} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                            <span>{c.chemical_name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{c.dosage}{c.unit}</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <span className="text-indigo-400 font-semibold">{scaled.toFixed(2)}{c.unit}</span>
                              {showCost && <span className="text-emerald-400">${(scaled * getChemicalCost(c)).toFixed(2)}</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Total cost summary */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Estimated Chemical Cost</div>
                <div className="text-3xl font-bold text-emerald-400">${totalChemicalCost.toFixed(2)}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Per garment: </span>
                  <span className="font-semibold">${perGarment.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Batch: </span>
                  <span className="font-semibold">{batchSize} pcs</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Steps: </span>
                  <span className="font-semibold">{steps.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Chemicals: </span>
                  <span className="font-semibold">{totalChemCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedRecipe && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🧮</div>
          <h2 className="text-2xl font-semibold mb-2">Batch Calculator</h2>
          <p className="text-muted-foreground">Select a recipe and enter batch quantity to auto-scale dosages</p>
        </div>
      )}
    </div>
  )
}
