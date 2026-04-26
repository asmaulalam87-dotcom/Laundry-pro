import { useState, useEffect } from 'react'
import { Save, Printer, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { LocalDB } from '@/services/local-db'
import { printCostingReport } from '@/services/export-services'
import type { Recipe, Chemical, CostingRecord } from '@/types'
import { toast } from 'sonner'

interface UtilityFactor {
  id: string
  name: string
  rate_per_min: number
}

interface DryProcess {
  id: string
  process_name: string
  smv: number
  rate_per_min: number
  total: number
}

export const CostingCalculator = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [loading, setLoading] = useState(false)

  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const [batchWeight, setBatchWeight] = useState(100)
  const [garmentQty, setGarmentQty] = useState(250)
  const [efficiency, setEfficiency] = useState(100)
  const [reprocess, setReprocess] = useState(0)

  const [utilityFactors, setUtilityFactors] = useState<UtilityFactor[]>([
    { id: '1', name: 'Steam', rate_per_min: 0.05 },
    { id: '2', name: 'Water', rate_per_min: 0.02 },
    { id: '3', name: 'Electricity', rate_per_min: 0.08 },
    { id: '4', name: 'Labor', rate_per_min: 0.10 },
  ])

  const [dryProcesses, setDryProcesses] = useState<DryProcess[]>([])
  const [convRate, setConvRate] = useState(120) // BDT per USD

  // What-If Simulator
  const [chemPriceFluctuation, setChemPriceFluctuation] = useState(0)
  const [processTimeImpact, setProcessTimeImpact] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const recipesData = await LocalDB.getAll<Recipe>('recipes')
    const chemicalsData = await LocalDB.getAll<Chemical>('chemicals')
    setRecipes(recipesData.filter(r => r.status === 'Finalized' || r.status === 'Approved'))
    setChemicals(chemicalsData)
  }

  const handleSelectRecipe = async (recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId)
    if (recipe) {
      setSelectedRecipe(recipe)
      setBatchWeight(recipe.batch_weight || 100)
      toast.info(`Loaded recipe: ${recipe.recipe_no}`)
    }
  }

  const calculateWetProcessCost = (): { chemicalCost: number; machineCost: number; totalTime: number } => {
    if (!selectedRecipe) return { chemicalCost: 0, machineCost: 0, totalTime: 0 }

    // Simulated calculation based on recipe
    const totalTime = 120 // minutes (would be calculated from recipe steps)
    const chemicalCost = 25.50 // simulated
    const machineCost = totalTime * utilityFactors.reduce((sum, u) => sum + u.rate_per_min, 0)

    return { chemicalCost, machineCost, totalTime }
  }

  const calculateDryProcessTotal = () => {
    return dryProcesses.reduce((sum, dp) => sum + dp.total, 0)
  }

  const wetProcessCosts = calculateWetProcessCost()
  const dryProcessTotal = calculateDryProcessTotal()
  const totalWashCost = wetProcessCosts.chemicalCost + wetProcessCosts.machineCost + dryProcessTotal
  const costPerGarment = garmentQty > 0 ? totalWashCost / garmentQty : 0
  const totalBatchCost = totalWashCost
  const costPerKg = batchWeight > 0 ? totalWashCost / batchWeight : 0
  const costPerDozen = costPerGarment * 12
  // USD equivalents
  const totalBatchUSD = convRate > 0 ? totalBatchCost / convRate : 0
  const costPerGarmentUSD = convRate > 0 ? costPerGarment / convRate : 0

  const addDryProcess = () => {
    setDryProcesses([...dryProcesses, {
      id: crypto.randomUUID(),
      process_name: '',
      smv: 0,
      rate_per_min: 0,
      total: 0,
    }])
  }

  const updateDryProcess = (id: string, field: keyof DryProcess, value: any) => {
    const updated = dryProcesses.map(dp => {
      if (dp.id === id) {
        const newDp = { ...dp, [field]: value }
        newDp.total = newDp.smv * newDp.rate_per_min
        return newDp
      }
      return dp
    })
    setDryProcesses(updated)
  }

  const removeDryProcess = (id: string) => {
    setDryProcesses(dryProcesses.filter(dp => dp.id !== id))
  }

  const addUtilityRow = () => {
    setUtilityFactors([...utilityFactors, {
      id: crypto.randomUUID(),
      name: 'New Utility',
      rate_per_min: 0,
    }])
  }

  const updateUtility = (id: string, field: keyof UtilityFactor, value: any) => {
    setUtilityFactors(utilityFactors.map(u => u.id === id ? { ...u, [field]: value } : u))
  }

  const removeUtility = (id: string) => {
    setUtilityFactors(utilityFactors.filter(u => u.id !== id))
  }

  const handleSave = async () => {
    if (!selectedRecipe) {
      toast.error('Please select a recipe')
      return
    }

    setLoading(true)
    try {
      const costing: CostingRecord = {
        id: crypto.randomUUID(),
        recipe_id: selectedRecipe.id,
        name: `Costing - ${selectedRecipe.recipe_no}`,
        customer_name: selectedRecipe.customer_name,
        total_cost: totalBatchCost,
        cost_per_piece: costPerGarment,
        cost_per_kg: batchWeight > 0 ? totalBatchCost / batchWeight : 0,
        created_at: new Date().toISOString(),
      }

      await LocalDB.add('costing_records', costing)
      toast.success('Costing saved successfully!')
    } catch (error) {
      toast.error('Failed to save costing')
    } finally {
      setLoading(false)
    }
  }

  const resetSimulator = () => {
    setChemPriceFluctuation(0)
    setProcessTimeImpact(0)
  }

  const handlePrintReport = () => {
    if (!selectedRecipe) {
      toast.error('Please select a recipe first')
      return
    }
    printCostingReport({
      recipeNo: selectedRecipe.recipe_no || '-',
      customerName: selectedRecipe.customer_name || '-',
      style: selectedRecipe.style || '-',
      color: selectedRecipe.color || '-',
      washType: selectedRecipe.wash_type || '-',
      batchWeight,
      garmentQty,
      efficiency,
      reprocess,
      convRate,
      utilityFactors: utilityFactors.map(u => ({ name: u.name, rate_per_min: u.rate_per_min })),
      dryProcesses: dryProcesses.map(dp => ({ process_name: dp.process_name, smv: dp.smv, rate_per_min: dp.rate_per_min, total: dp.total })),
      wetChemicalCost: wetProcessCosts.chemicalCost,
      wetMachineCost: wetProcessCosts.machineCost,
      wetTotalTime: wetProcessCosts.totalTime,
      dryProcessTotal,
      totalWashCost: totalBatchCost,
      costPerGarment,
      costPerKg,
      costPerDozen,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Laundry Costing</h1>
          <p className="text-muted-foreground mt-1">Automated industrial financial modeling</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrintReport} className="flex items-center gap-2 px-4 py-2 bg-muted border border-border rounded-lg hover:bg-muted/80">
            <Printer className="w-4 h-4" /> Print Report
          </button>
          <button onClick={handleSave} disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50">
            <Save className="w-4 h-4" /> Save Costing
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Inputs */}
        <div className="xl:col-span-2 space-y-6">
          {/* Production Configuration */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">📊</div>
              <h2 className="text-xl font-semibold">Production Configuration</h2>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Washing Recipe</label>
                <select
                  value={selectedRecipe?.id || ''}
                  onChange={(e) => handleSelectRecipe(e.target.value)}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a Recipe...</option>
                  {recipes.map(r => (
                    <option key={r.id} value={r.id}>{r.recipe_no} - {r.customer_name} ({r.style})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Batch Weight (kg)</label>
                <input
                  type="number"
                  value={batchWeight}
                  onChange={(e) => setBatchWeight(parseFloat(e.target.value))}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Conversion Rate (1 USD = ? BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={convRate}
                  onChange={(e) => setConvRate(parseFloat(e.target.value) || 120)}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Garments in Batch (qty)</label>
                <input type="number" value={garmentQty} onChange={(e) => setGarmentQty(parseInt(e.target.value))} className="w-full px-4 py-2 bg-muted border border-border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Efficiency (%)</label>
                <input type="number" value={efficiency} onChange={(e) => setEfficiency(parseFloat(e.target.value))} className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Reprocess (%)</label>
                <input type="number" value={reprocess} onChange={(e) => setReprocess(parseFloat(e.target.value))} className="w-full px-4 py-2 bg-muted border border-border rounded-lg text-red-500" />
              </div>
            </div>

            {/* What-If Simulator */}
            <div className="mt-6 p-6 bg-blue-500/5 border border-dashed border-blue-500/30 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-500 mb-4 flex items-center gap-2">
                🔮 What-If Simulator (Impact Analysis)
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Chemical Price Fluctuation</label>
                    <span className="text-blue-500 font-semibold text-sm">{chemPriceFluctuation > 0 ? '+' : ''}{chemPriceFluctuation}%</span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    value={chemPriceFluctuation}
                    onChange={(e) => setChemPriceFluctuation(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Process Time / Utility Impact</label>
                    <span className="text-blue-500 font-semibold text-sm">{processTimeImpact > 0 ? '+' : ''}{processTimeImpact}%</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="50"
                    value={processTimeImpact}
                    onChange={(e) => setProcessTimeImpact(parseInt(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={resetSimulator} className="px-3 py-1 text-xs border border-blue-500/30 text-blue-500 rounded hover:bg-blue-500/10">
                  Reset Simulator
                </button>
              </div>
            </div>

            {/* Machine Utility Factors */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => {}}>
                <h3 className="font-semibold flex items-center gap-2">⚡ Machine Utility Factors (Per Min)</h3>
                <span>▼</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-end gap-2 mb-3">
                  <button onClick={addUtilityRow} className="px-3 py-1 text-xs border border-border rounded hover:bg-muted">
                    + Add Element
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {utilityFactors.map(utility => (
                    <div key={utility.id} className="flex gap-2 items-center p-3 bg-muted rounded-lg">
                      <input
                        type="text"
                        value={utility.name}
                        onChange={(e) => updateUtility(utility.id, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 bg-card border border-border rounded text-sm"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={utility.rate_per_min}
                        onChange={(e) => updateUtility(utility.id, 'rate_per_min', parseFloat(e.target.value))}
                        className="w-24 px-3 py-2 bg-card border border-border rounded text-sm"
                        placeholder="BDT/min"
                      />
                      <button onClick={() => removeUtility(utility.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Dry Process Operations */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">🎨</div>
              <h2 className="text-xl font-semibold">Dry Process Operations</h2>
            </div>

            <div className="space-y-3">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-3 font-semibold">PROCESS</th>
                    <th className="pb-3 font-semibold w-20">SMV</th>
                    <th className="pb-3 font-semibold w-24">RATE(BDT/m)</th>
                    <th className="pb-3 font-semibold w-24 text-right">TOTAL</th>
                    <th className="pb-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {dryProcesses.map(dp => (
                    <tr key={dp.id} className="border-b border-border">
                      <td className="py-3">
                        <input
                          type="text"
                          value={dp.process_name}
                          onChange={(e) => updateDryProcess(dp.id, 'process_name', e.target.value)}
                          className="w-full px-3 py-2 bg-muted border border-border rounded text-sm"
                          placeholder="Process name"
                        />
                      </td>
                      <td className="py-3">
                        <input
                          type="number"
                          step="0.1"
                          value={dp.smv}
                          onChange={(e) => updateDryProcess(dp.id, 'smv', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 bg-muted border border-border rounded text-sm"
                        />
                      </td>
                      <td className="py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={dp.rate_per_min}
                          onChange={(e) => updateDryProcess(dp.id, 'rate_per_min', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 bg-muted border border-border rounded text-sm"
                        />
                      </td>
                      <td className="py-3 text-right font-semibold text-primary">৳{dp.total.toFixed(2)}</td>
                      <td className="py-3">
                        <button onClick={() => removeDryProcess(dp.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addDryProcess} className="w-full py-3 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium">
                + Add Operation
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: P&L Summary */}
        <div>
          <div className="bg-card border-l-4 border-l-primary rounded-lg p-6 sticky top-4">
            <h3 className="text-xl font-bold mb-6">P&L Summary</h3>

            {/* Conversion Rate */}
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-muted rounded-lg text-xs">
              <span className="text-muted-foreground">Rate:</span>
              <span className="font-bold">1 USD = ৳{convRate}</span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-4 border-b border-border">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Wet Process Cost</div>
                  <div className="text-xs text-muted-foreground mt-1">Chemicals & Dyes</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-500">৳{wetProcessCosts.chemicalCost.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Per PC: ৳{(garmentQty > 0 ? wetProcessCosts.chemicalCost / garmentQty : 0).toFixed(3)}</div>
                  <div className="text-xs text-blue-400">≈ ${(wetProcessCosts.chemicalCost / convRate).toFixed(3)} USD</div>
                </div>
              </div>

              <div className="flex justify-between items-center py-4 border-b border-border">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Machine Cost</div>
                  <div className="text-xs text-muted-foreground mt-1">Utilities for <span className="text-white font-semibold">{wetProcessCosts.totalTime}</span> mins</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-500">৳{wetProcessCosts.machineCost.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Per PC: ৳{(garmentQty > 0 ? wetProcessCosts.machineCost / garmentQty : 0).toFixed(3)}</div>
                  <div className="text-xs text-blue-400">≈ ${(wetProcessCosts.machineCost / convRate).toFixed(3)} USD</div>
                </div>
              </div>

              <div className="flex justify-between items-center py-4 border-b border-border">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Dry Process Total</div>
                  <div className="text-xs text-muted-foreground mt-1">Manual SMV total</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-500">৳{dryProcessTotal.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Per PC: ৳{(garmentQty > 0 ? dryProcessTotal / garmentQty : 0).toFixed(3)}</div>
                  <div className="text-xs text-blue-400">≈ ${(dryProcessTotal / convRate).toFixed(3)} USD</div>
                </div>
              </div>

              {/* Total Wash Cost / Per PC */}
              <div className="mt-6 p-6 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="text-center">
                  <div className="text-xs font-bold text-white uppercase tracking-wide mb-2 opacity-90">Cost Per PC (BDT)</div>
                  <div className="text-4xl font-bold text-green-500 mb-1" style={{ textShadow: '0 0 20px rgba(16, 185, 129, 0.3)' }}>
                    ৳{costPerGarment.toFixed(2)}
                  </div>
                  <div className="text-sm text-blue-400 font-semibold">≈ ${costPerGarmentUSD.toFixed(3)} USD</div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-green-500/20">
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Batch Total</div>
                    <div className="text-base font-bold text-green-500">৳{totalBatchCost.toFixed(2)}</div>
                    <div className="text-[10px] text-blue-400">${totalBatchUSD.toFixed(2)} USD</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Cost / KG</div>
                    <div className="text-base font-bold text-green-500">৳{costPerKg.toFixed(2)}</div>
                    <div className="text-[10px] text-blue-400">${(costPerKg / convRate).toFixed(3)} USD</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-green-500/20">
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Cost / Dozen</div>
                    <div className="text-base font-bold text-amber-400">৳{costPerDozen.toFixed(2)}</div>
                    <div className="text-[10px] text-blue-400">${(costPerDozen / convRate).toFixed(3)} USD</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase font-semibold">Efficiency</div>
                    <div className="text-base font-bold text-amber-400">{efficiency}%</div>
                    <div className="text-[10px] text-red-400">Reprocess: {reprocess}%</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button onClick={() => window.location.reload()} className="py-3 bg-muted border border-border rounded-lg hover:bg-muted/80 text-sm font-medium">
                  Reset
                </button>
                <button onClick={handleSave} disabled={loading} className="py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium disabled:opacity-50">
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
