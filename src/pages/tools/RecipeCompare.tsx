import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/services/local-db'
import { GitCompare, ArrowRight, ArrowLeftRight, Download, Thermometer, Clock, Beaker, FlaskConical, DollarSign, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

interface RecipeData {
  id: string
  recipe_no: string
  customer_name: string
  style: string
  color: string
  wash_type: string
  factory_name: string
  status: string
  steps: any[]
  [key: string]: any
}

export const RecipeCompare = () => {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<RecipeData[]>([])
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const [left, setLeft] = useState<RecipeData | null>(null)
  const [right, setRight] = useState<RecipeData | null>(null)
  const [showCost, setShowCost] = useState(true)
  const [diffOnly, setDiffOnly] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const allRecipes = await db.recipes.toArray()
    const allSteps = await db.recipe_steps.toArray()
    const allChemicals = await db.recipe_step_chemicals.toArray()

    const mapped = allRecipes.map(r => ({
      ...r,
      steps: allSteps
        .filter(s => s.recipe_id === r.id)
        .sort((a, b) => (a.step_order || 0) - (b.step_order || 0))
        .map(s => ({
          ...s,
          chemicals: allChemicals.filter(c => c.recipe_step_id === s.id),
        })),
    })) as any[]

    setRecipes(mapped)
  }

  useEffect(() => {
    setLeft(recipes.find(r => r.id === leftId) || null)
    setRight(recipes.find(r => r.id === rightId) || null)
  }, [leftId, rightId, recipes])

  const handleSwap = () => {
    const tmpId = leftId
    setLeftId(rightId)
    setRightId(tmpId)
  }

  // Calculate total cost per recipe
  const calcCost = (recipe: RecipeData | null) => {
    if (!recipe) return { total: 0, steps: 0, chemicals: 0 }
    let total = 0
    let chemCount = 0
    recipe.steps.forEach((step: any) => {
      (step.chemicals || []).forEach((c: any) => {
        const dosage = parseFloat(c.dosage) || 0
        const cost = parseFloat(c.cost_per_unit) || 0
        total += dosage * cost
        chemCount++
      })
    })
    return { total, steps: recipe.steps.length, chemicals: chemCount }
  }

  const leftCost = calcCost(left)
  const rightCost = calcCost(right)

  const maxSteps = Math.max(left?.steps.length || 0, right?.steps.length || 0)

  // Diff meter: % similarity
  const calcSimilarity = () => {
    if (!left || !right) return 0
    const fields = ['customer_name', 'style', 'color', 'wash_type', 'factory_name']
    let matches = 0
    fields.forEach(f => { if (left[f] === right[f]) matches++ })
    const fieldSimilarity = (matches / fields.length) * 40 // 40% weight

    // Process similarity
    const leftProcesses = left.steps.map((s: any) => s.process_name).join(',')
    const rightProcesses = right.steps.map((s: any) => s.process_name).join(',')
    const processMatch = leftProcesses === rightProcesses ? 30 : 0

    // Step count similarity
    const stepDiff = Math.abs(left.steps.length - right.steps.length)
    const stepSimilarity = stepDiff === 0 ? 30 : Math.max(0, 30 - stepDiff * 10)

    return Math.round(fieldSimilarity + processMatch + stepSimilarity)
  }

  const similarity = calcSimilarity()

  const handleExportDiff = () => {
    if (!left || !right) return
    const lines: string[] = []
    lines.push(`Recipe Comparison Report`)
    lines.push(`Generated: ${new Date().toLocaleString()}`)
    lines.push(``)
    lines.push(`Recipe A: ${left.recipe_no} — ${left.customer_name} · ${left.style} · ${left.wash_type}`)
    lines.push(`Recipe B: ${right.recipe_no} — ${right.customer_name} · ${right.style} · ${right.wash_type}`)
    lines.push(`Similarity: ${similarity}%`)
    lines.push(``)

    const fields = [
      ['Recipe No', left.recipe_no, right.recipe_no],
      ['Customer', left.customer_name, right.customer_name],
      ['Style', left.style, right.style],
      ['Color', left.color, right.color],
      ['Wash Type', left.wash_type, right.wash_type],
      ['Factory', left.factory_name, right.factory_name],
      ['Steps', String(left.steps.length), String(right.steps.length)],
      ['Chemicals', String(leftCost.chemicals), String(rightCost.chemicals)],
      ['Est. Cost', `$${leftCost.total.toFixed(2)}`, `$${rightCost.total.toFixed(2)}`],
    ]

    lines.push(`FIELD COMPARISON:`)
    lines.push(`${'Field'.padEnd(15)} ${'Recipe A'.padEnd(25)} ${'Recipe B'.padEnd(25)} Match`)
    fields.forEach(([label, lv, rv]) => {
      const match = lv === rv ? '✓' : '✗ DIFF'
      lines.push(`${label.padEnd(15)} ${String(lv || '—').padEnd(25)} ${String(rv || '—').padEnd(25)} ${match}`)
    })

    lines.push(``)
    lines.push(`STEP-BY-STEP COMPARISON:`)
    for (let i = 0; i < maxSteps; i++) {
      const ls: any = left.steps[i]
      const rs: any = right.steps[i]
      lines.push(`--- Step ${i + 1} ---`)
      lines.push(`  A: ${ls?.process_name || 'N/A'} | B: ${rs?.process_name || 'N/A'}`)
      lines.push(`  A Temp: ${ls?.temperature || '-'} | B Temp: ${rs?.temperature || '-'}`)
      lines.push(`  A Time: ${ls?.time_min || ls?.time_minutes || '-'} | B Time: ${rs?.time_min || rs?.time_minutes || '-'}`)
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparison-${left.recipe_no}-vs-${right.recipe_no}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Comparison exported')
  }

  const DiffCell = ({ leftVal, rightVal }: { leftVal?: string | number; rightVal?: string | number }) => {
    const lv = String(leftVal ?? '')
    const rv = String(rightVal ?? '')
    const different = lv && rv && lv !== rv
    return (
      <td className={`px-3 py-2 text-sm ${different ? 'bg-amber-500/10 text-amber-300 font-medium' : 'text-foreground'}`}>
        {leftVal || '—'}
      </td>
    )
  }

  const DiffCellRight = ({ leftVal, rightVal }: { leftVal?: string | number; rightVal?: string | number }) => {
    const lv = String(leftVal ?? '')
    const rv = String(rightVal ?? '')
    const different = lv && rv && lv !== rv
    return (
      <td className={`px-3 py-2 text-sm ${different ? 'bg-amber-500/10 text-amber-300 font-medium' : 'text-foreground'}`}>
        {rightVal || '—'}
      </td>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <GitCompare className="w-8 h-8 text-indigo-400" />
            Recipe Compare
          </h1>
          <p className="text-muted-foreground mt-1">Side-by-side comparison with difference highlighting & cost analysis</p>
        </div>
        {left && right && (
          <button onClick={handleExportDiff}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Diff
          </button>
        )}
      </div>

      {/* Recipe selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-indigo-500/30 rounded-lg p-4">
          <label className="block text-sm font-semibold mb-2 text-indigo-400">Recipe A</label>
          <select value={leftId} onChange={e => setLeftId(e.target.value)}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">— Select Recipe —</option>
            {recipes.filter(r => r.id !== rightId).map(r => (
              <option key={r.id} value={r.id}>{r.recipe_no} — {r.customer_name} · {r.style}</option>
            ))}
          </select>
        </div>
        <div className="bg-card border border-emerald-500/30 rounded-lg p-4">
          <label className="block text-sm font-semibold mb-2 text-emerald-400">Recipe B</label>
          <select value={rightId} onChange={e => setRightId(e.target.value)}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">— Select Recipe —</option>
            {recipes.filter(r => r.id !== leftId).map(r => (
              <option key={r.id} value={r.id}>{r.recipe_no} — {r.customer_name} · {r.style}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison */}
      {left && right && (
        <div className="space-y-4">
          {/* Similarity meter + controls */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                Similarity Score
              </h3>
              <div className="flex items-center gap-3">
                <button onClick={handleSwap}
                  className="px-3 py-1.5 bg-muted hover:bg-muted/70 border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Swap
                </button>
                <button onClick={() => setShowCost(!showCost)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${showCost ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground border border-border'}`}>
                  <DollarSign className="w-3.5 h-3.5 inline" /> Cost
                </button>
                <button onClick={() => setDiffOnly(!diffOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${diffOnly ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground border border-border'}`}>
                  Diff Only
                </button>
              </div>
            </div>

            {/* Similarity bar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Similarity</span>
                <span className={`font-bold ${similarity >= 70 ? 'text-emerald-400' : similarity >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                  {similarity}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    similarity >= 70 ? 'bg-emerald-500' : similarity >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${similarity}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {similarity >= 80 ? 'Very similar recipes' : similarity >= 50 ? 'Moderate differences' : 'Significantly different recipes'}
              </p>
            </div>

            {/* Quick comparison cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Steps</div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-indigo-400 font-bold">{left.steps.length}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="text-emerald-400 font-bold">{right.steps.length}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Chemicals</div>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-indigo-400 font-bold">{leftCost.chemicals}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="text-emerald-400 font-bold">{rightCost.chemicals}</span>
                </div>
              </div>
              {showCost && (
                <>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Est. Cost A</div>
                    <div className="text-indigo-400 font-bold mt-1">${leftCost.total.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Est. Cost B</div>
                    <div className="text-emerald-400 font-bold mt-1">${rightCost.total.toFixed(2)}</div>
                  </div>
                </>
              )}
              {!showCost && (
                <>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Wash Type</div>
                    <div className={`font-bold mt-1 ${left.wash_type === right.wash_type ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {left.wash_type === right.wash_type ? '✓ Match' : '✗ Diff'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Customer</div>
                    <div className={`font-bold mt-1 ${left.customer_name === right.customer_name ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {left.customer_name === right.customer_name ? '✓ Match' : '✗ Diff'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Cost difference bar */}
            {showCost && leftCost.total > 0 && rightCost.total > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-4">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-indigo-400">A: ${leftCost.total.toFixed(2)}</span>
                    <span className={leftCost.total < rightCost.total ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}>
                      {leftCost.total < rightCost.total ? '← Cheaper' : ''}
                    </span>
                    <span className="text-red-400 font-semibold">
                      {leftCost.total > rightCost.total ? '+' : ''}{((leftCost.total - rightCost.total)).toFixed(2)}
                    </span>
                    <span className={rightCost.total < leftCost.total ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}>
                      {rightCost.total < leftCost.total ? 'Cheaper →' : ''}
                    </span>
                    <span className="text-emerald-400">B: ${rightCost.total.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 relative">
                    <div className="absolute inset-0 flex">
                      <div className="bg-indigo-500 rounded-l-full h-2" style={{ width: `${(leftCost.total / Math.max(leftCost.total, rightCost.total)) * 50}%` }} />
                      <div className="flex-1" />
                      <div className="bg-emerald-500 rounded-r-full h-2" style={{ width: `${(rightCost.total / Math.max(leftCost.total, rightCost.total)) * 50}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Header comparison */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground w-40">Field</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-indigo-400">Recipe A</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-emerald-400">Recipe B</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Recipe No', left.recipe_no, right.recipe_no],
                  ['Customer', left.customer_name, right.customer_name],
                  ['Style', left.style, right.style],
                  ['Color', left.color, right.color],
                  ['Wash Type', left.wash_type, right.wash_type],
                  ['Factory', left.factory_name, right.factory_name],
                  ['Status', left.status, right.status],
                  ['Steps', String(left.steps.length), String(right.steps.length)],
                  ...(showCost ? [['Est. Cost', `$${leftCost.total.toFixed(2)}`, `$${rightCost.total.toFixed(2)}`] as const] : []),
                ].filter(([label, lv, rv]) => !diffOnly || lv !== rv).map(([label, lv, rv]) => {
                  const diff = lv !== rv
                  return (
                    <tr key={label as string} className="border-b border-border/50">
                      <td className="px-4 py-2 text-sm text-muted-foreground font-medium">{label}</td>
                      <td className={`px-4 py-2 text-sm ${diff ? 'bg-amber-500/10 text-amber-300 font-medium' : ''}`}>{lv || '—'}</td>
                      <td className={`px-4 py-2 text-sm ${diff ? 'bg-amber-500/10 text-amber-300 font-medium' : ''}`}>{rv || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Steps comparison */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Beaker className="w-5 h-5 text-cyan-400" />
              Process Steps Comparison
              <span className="text-xs text-muted-foreground font-normal ml-2">
                {diffOnly ? 'Showing differences only' : 'Highlighted cells = differences'}
              </span>
            </h3>

            {Array.from({ length: maxSteps }).map((_, idx) => {
              const ls: any = left.steps[idx]
              const rs: any = right.steps[idx]
              if (!ls && !rs) return null

              // Diff-only: skip steps where everything matches
              if (diffOnly && ls && rs) {
                const processMatch = ls.process_name === rs.process_name
                const tempMatch = String(ls.temperature) === String(rs.temperature)
                const timeMatch = String(ls.time_min || ls.time_minutes) === String(rs.time_min || rs.time_minutes)
                if (processMatch && tempMatch && timeMatch) return null
              }

              return (
                <div key={idx} className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 font-semibold text-sm border-b border-border flex items-center gap-2">
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">Step {idx + 1}</span>
                    {!ls && <span className="text-xs text-red-400">Missing in A</span>}
                    {!rs && <span className="text-xs text-red-400">Missing in B</span>}
                  </div>
                  <table className="w-full">
                    <tbody>
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground w-32">Process</td>
                        <DiffCell leftVal={ls?.process_name} rightVal={rs?.process_name} />
                        <DiffCellRight leftVal={ls?.process_name} rightVal={rs?.process_name} />
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground"><Thermometer className="w-3 h-3 inline" /> Temp</td>
                        <DiffCell leftVal={ls?.temperature} rightVal={rs?.temperature} />
                        <DiffCellRight leftVal={ls?.temperature} rightVal={rs?.temperature} />
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground"><Clock className="w-3 h-3 inline" /> Time</td>
                        <DiffCell leftVal={ls?.time_min || ls?.time_minutes} rightVal={rs?.time_min || rs?.time_minutes} />
                        <DiffCellRight leftVal={ls?.time_min || ls?.time_minutes} rightVal={rs?.time_min || rs?.time_minutes} />
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">pH</td>
                        <DiffCell leftVal={ls?.ph_range || ls?.default_ph} rightVal={rs?.ph_range || rs?.default_ph} />
                        <DiffCellRight leftVal={ls?.ph_range || ls?.default_ph} rightVal={rs?.ph_range || rs?.default_ph} />
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">RPM</td>
                        <DiffCell leftVal={ls?.default_rpm} rightVal={rs?.default_rpm} />
                        <DiffCellRight leftVal={ls?.default_rpm} rightVal={rs?.default_rpm} />
                      </tr>
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">Liquor Ratio</td>
                        <DiffCell leftVal={ls?.liquor_ratio} rightVal={rs?.liquor_ratio} />
                        <DiffCellRight leftVal={ls?.liquor_ratio} rightVal={rs?.liquor_ratio} />
                      </tr>
                    </tbody>
                  </table>

                  {/* Chemicals comparison */}
                  {(ls?.chemicals.length || rs?.chemicals.length) ? (
                    <div className="border-t border-border">
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/20">
                        <FlaskConical className="w-3 h-3 inline" /> Chemicals
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border/30">
                            <th className="px-3 py-1 text-left text-[10px] text-muted-foreground w-32">Chemical</th>
                            <th className="px-3 py-1 text-left text-[10px] text-indigo-400">A Dosage</th>
                            <th className="px-3 py-1 text-left text-[10px] text-emerald-400">B Dosage</th>
                            {showCost && <th className="px-3 py-1 text-right text-[10px] text-amber-400">Cost Diff</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const allChems = new Set([
                              ...(ls?.chemicals.map((c: any) => c.chemical_name) || []),
                              ...(rs?.chemicals.map((c: any) => c.chemical_name) || []),
                            ])
                            return Array.from(allChems).map(name => {
                              const lChem = ls?.chemicals.find((c: any) => c.chemical_name === name)
                              const rChem = rs?.chemicals.find((c: any) => c.chemical_name === name)
                              const lDosage = lChem ? `${lChem.dosage || ''} ${lChem.unit || ''}`.trim() : ''
                              const rDosage = rChem ? `${rChem.dosage || ''} ${rChem.unit || ''}`.trim() : ''
                              const diff = lDosage !== rDosage
                              const lCostVal = lChem ? (parseFloat(lChem.dosage) || 0) * (parseFloat(lChem.cost_per_unit) || 0) : 0
                              const rCostVal = rChem ? (parseFloat(rChem.dosage) || 0) * (parseFloat(rChem.cost_per_unit) || 0) : 0
                              const costDiff = lCostVal - rCostVal

                              if (diffOnly && !diff) return null

                              return (
                                <tr key={name} className="border-b border-border/20">
                                  <td className="px-3 py-1 text-xs">{name}</td>
                                  <td className={`px-3 py-1 text-xs ${diff ? 'bg-amber-500/10 text-amber-300' : ''}`}>
                                    {lDosage || '—'}
                                  </td>
                                  <td className={`px-3 py-1 text-xs ${diff ? 'bg-amber-500/10 text-amber-300' : ''}`}>
                                    {rDosage || '—'}
                                  </td>
                                  {showCost && (
                                    <td className={`px-3 py-1 text-xs text-right ${Math.abs(costDiff) > 0.01 ? 'text-amber-400 font-medium' : 'text-muted-foreground'}`}>
                                      {Math.abs(costDiff) > 0.01 ? `${costDiff > 0 ? '+' : ''}$${costDiff.toFixed(2)}` : '—'}
                                    </td>
                                  )}
                                </tr>
                              )
                            })
                          })()}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          {/* Quick actions */}
          <div className="flex gap-3">
            <button onClick={() => navigate(`/recipes/builder?id=${left.id}`)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm flex items-center gap-2">
              Edit Recipe A <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => navigate(`/recipes/builder?id=${right.id}`)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm flex items-center gap-2">
              Edit Recipe B <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!left || !right) && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">⚖️</div>
          <h2 className="text-2xl font-semibold mb-2">Recipe Comparison Tool</h2>
          <p className="text-muted-foreground">Select two recipes above to compare them side-by-side</p>
          <p className="text-xs text-muted-foreground mt-2">Differences highlighted in amber · Cost analysis included</p>
        </div>
      )}
    </div>
  )
}
