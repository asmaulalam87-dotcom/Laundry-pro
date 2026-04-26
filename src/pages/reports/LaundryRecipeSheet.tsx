import { useState, useEffect } from 'react'
import { Printer, RefreshCw, FileCheck, ShieldCheck, Lock } from 'lucide-react'
import { LocalDB, db } from '@/services/local-db'
import { printRecipe } from '@/services/export-services'
import type { Recipe } from '@/types'
import { toast } from 'sonner'
import { A4ReportLayout } from '@/components/reports/A4ReportLayout'

interface Step {
  id: any
  recipe_id: string
  step_order: number
  process_name: string
  temperature?: string | number
  time_minutes?: string | number
  non_op_time?: string | number
  ltr?: string
  step_weight?: number
  step_qty?: number
  remarks?: string
  chemicals?: Chemical[]
}

interface Chemical {
  id: any
  recipe_step_id: any
  chemical_name: string
  batch_no?: string
  dosage: number
  unit: string
}

// ── helpers ────────────────────────────────────────────────────────────────────
const calcWater = (step: Step, batchWeight: number): number => {
  const match = String(step.ltr || '').match(/1:(\d+(?:\.\d+)?)/)
  if (!match) return 0
  const ratio = parseFloat(match[1])
  const wt = step.step_weight ? parseFloat(String(step.step_weight)) || batchWeight : batchWeight
  return ratio * wt
}

const calcQty = (chem: Chemical, water: number, weight: number): number => {
  const d = parseFloat(String(chem.dosage)) || 0
  switch (chem.unit) {
    case 'g/l':   case 'ml/l':  return (d * water) / 1000
    case '%':                   return (d * weight) / 100
    case 'g/kg':  case 'ml/kg': return (d * weight) / 1000
    case 'kg':                  return d
    default:                    return (d * weight) / 1000
  }
}

// ── Helper sub-component: one info table row ──────────────────────────────────
function InfoRow({
  c1, v1, c2, v2, c3, v3, c4, v4, lastRow = false
}: {
  c1: string; v1: any
  c2: string; v2: any
  c3: string; v3: any
  c4: string; v4: any
  lastRow?: boolean
}) {
  const border = lastRow ? '2px solid #333' : '1px solid #eee'
  const td = (label: string, val: any) => (
    <>
      <td style={{ padding: '4px 6px', borderBottom: border, width: '12%', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {label}
      </td>
      <td style={{ padding: '4px 6px', borderBottom: border, width: '13%' }}>
        {val || '-'}
      </td>
    </>
  )
  return (
    <tr>
      {td(c1, v1)}
      {td(c2, v2)}
      {td(c3, v3)}
      {td(c4, v4)}
    </tr>
  )
}

// ── Shared recipe loader hook ─────────────────────────────────────────────────
function useRecipeSheet() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    LocalDB.getAll<Recipe>('recipes').then(r => {
      setRecipes(r.sort((a, b) => (a.recipe_no || '').localeCompare(b.recipe_no || '')))
    })
  }, [])

  const loadRecipe = async (id: string) => {
    if (!id) { setRecipe(null); setSteps([]); return }
    setLoading(true)
    try {
      const rec = recipes.find(r => r.id === id) || null
      setRecipe(rec)
      if (!rec) { setSteps([]); return }
      const rawSteps = await LocalDB.getByIndex<Step>('recipe_steps', 'recipe_id', id)
      rawSteps.sort((a, b) => a.step_order - b.step_order)
      const enriched = await Promise.all(rawSteps.map(async (step) => {
        const chems = await db.recipe_step_chemicals
          .where('recipe_step_id').equals(step.id)
          .toArray() as Chemical[]
        return { ...step, chemicals: chems }
      }))
      setSteps(enriched)
    } catch (e: any) {
      toast.error('Failed to load recipe: ' + e?.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRecipe(selectedId) }, [selectedId, recipes])

  return { recipes, selectedId, setSelectedId, recipe, steps, loading }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared SheetBody — using A4ReportLayout
// ═══════════════════════════════════════════════════════════════════════════════
function SheetBody({
  recipe, steps, showChemSummary, includeSignatures, confidentiality, sigConfigKey,
}: {
  recipe: Recipe
  steps: Step[]
  showChemSummary: boolean
  includeSignatures: boolean
  confidentiality: 'CONFIDENTIAL' | 'INTERNAL' | 'RESTRICTED' | 'PUBLIC'
  sigConfigKey: string
}) {
  const bw = parseFloat(String(recipe.batch_weight)) || 0

  const chemTotals: Record<string, number> = {}
  steps.forEach(step => {
    const water = calcWater(step, bw)
    const wt = step.step_weight ? parseFloat(String(step.step_weight)) || bw : bw
    ;(step.chemicals || []).forEach(c => {
      if (!c.chemical_name) return
      chemTotals[c.chemical_name] = (chemTotals[c.chemical_name] || 0) + calcQty(c, water, wt)
    })
  })

  const totalTime  = steps.reduce((s, st) => s + (parseFloat(String(st.time_minutes)) || 0), 0)
  const totalWater = steps.reduce((s, st) => s + calcWater(st, bw), 0)

  // QR data: recipe key info
  const qrData = [
    'Recipe: ' + (recipe.recipe_no || '-'),
    'Ref: '    + (recipe.recipe_ref || '-'),
    'Customer: '+ (recipe.customer_name || '-'),
    'Style: '  + (recipe.style || '-'),
    'Date: '   + (recipe.recipe_date || '-'),
    'Batch: '  + bw + 'KG/' + (recipe.batch_quantity || 0) + 'pcs',
  ].join(' | ')

  // Efficiency metrics
  const totalChemKg = Object.values(chemTotals).reduce((s, q) => s + q, 0)
  const waterEfficiency = bw > 0 && totalWater > 0 ? (totalWater / bw).toFixed(1) : '-'
  const chemEfficiency = bw > 0 && totalChemKg > 0 ? ((totalChemKg / bw) * 1000).toFixed(1) : '-'

  // Status color mapping
  const statusColorMap: Record<string, 'green' | 'yellow' | 'blue' | 'red' | 'purple' | 'gray'> = {
    Approved: 'green',
    Finalized: 'indigo' as any,
    Pending: 'yellow',
    Draft: 'gray',
    Rejected: 'red',
  }

  return (
    <A4ReportLayout
      reportId="laundry-recipe-sheet-preview"
      title="LAUNDRY RECIPE SHEET"
      orientation="portrait"
      qrData={qrData}
      showQR={true}
      confidentiality={confidentiality}
      statusBadge={recipe.recipe_stage || recipe.status}
      statusColor={statusColorMap[recipe.status] || 'blue'}
      docRef={recipe.recipe_no || undefined}
      showSignatures={includeSignatures}
      signatureConfigKey={sigConfigKey}
    >
      {/* Info table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 6 }}>
        <tbody>
          <InfoRow c1="Recipe No:" v1={recipe.recipe_no} c2="Reference:" v2={recipe.recipe_ref} c3="Customer:" v3={recipe.customer_name} c4="Date:" v4={recipe.recipe_date} />
          <InfoRow c1="Style:" v1={recipe.style} c2="Item:" v2={(recipe as any).item} c3="Color:" v3={recipe.color} c4="Batch Wt:" v4={bw ? `${bw} KG` : '-'} />
          <InfoRow c1="PO No:" v1={(recipe as any).po} c2="OB No:" v2={(recipe as any).ob_no} c3="Order Qty:" v3={(recipe as any).order_quantity} c4="Batch Qty:" v4={recipe.batch_quantity ? `${recipe.batch_quantity} pcs` : '-'} />
          <InfoRow c1="Stage:" v1={recipe.recipe_stage} c2="Version:" v2={(recipe as any).recipe_version || 'V1'} c3="Machine:" v3={(recipe as any).machine_type} c4="Factory:" v4={recipe.factory_name} />
          <InfoRow c1="Recipe Time:" v1={recipe.recipe_time ? `${recipe.recipe_time} min` : `${totalTime.toFixed(0)} min`} c2="Total Water:" v2={recipe.total_water ? `${recipe.total_water} Ltr` : `${totalWater.toFixed(1)} Ltr`} c3="Cost/Batch:" v3={recipe.cost_batch != null ? String(recipe.cost_batch) : '-'} c4="Cost/Pc:" v4={recipe.cost_pc != null ? String(recipe.cost_pc) : '-'} lastRow />
        </tbody>
      </table>

      {/* Wash Type & Wash Process — full-width single-line rows */}
      {recipe.wash_type && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 3, background: '#f0f9ff' }}>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: 10, color: '#0369a1', minWidth: 70 }}>Wash Type:</span>
          <span style={{ fontSize: 10, color: '#0c4a6e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {recipe.wash_type.split('+').map((p, i, arr) => (
              <span key={i}>
                <span style={{ fontWeight: 600 }}>{p.trim()}</span>
                {i < arr.length - 1 && <span style={{ color: '#94a3b8', margin: '0 3px' }}>+</span>}
              </span>
            ))}
          </span>
        </div>
      )}
      {(recipe as any).final_wash && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 3, background: '#f0fdf4' }}>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: 10, color: '#15803d', minWidth: 70 }}>Wash Process:</span>
          <span style={{ fontSize: 10, color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {String((recipe as any).final_wash).split('+').map((p, i, arr) => (
              <span key={i}>
                <span style={{ fontWeight: 600 }}>{p.trim()}</span>
                {i < arr.length - 1 && <span style={{ color: '#94a3b8', margin: '0 3px' }}>+</span>}
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Efficiency metrics strip */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, padding: '6px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 10 }}>
        <span style={{ color: '#0891b2' }}>
          <strong>Water Ratio:</strong> {waterEfficiency} L/kg
        </span>
        <span style={{ color: '#059669' }}>
          <strong>Chemical Usage:</strong> {chemEfficiency} g/kg
        </span>
        <span style={{ color: '#7c3aed' }}>
          <strong>Total Steps:</strong> {steps.length}
        </span>
        <span style={{ color: '#ea580c' }}>
          <strong>Total Time:</strong> {recipe.recipe_time || totalTime.toFixed(0)} min
        </span>
      </div>

      {/* Process Workflow */}
      <div style={{ margin: '14px 0 6px', fontSize: 12, fontWeight: 900, background: '#000', color: '#fff', padding: '5px 10px' }}>
        PROCESS WORKFLOW
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            {['Step','Process','Temp','Op. Time','Non-Op','L/R','Water','Chemicals','Total Qty','Remarks'].map(h => (
              <th key={h} style={{ padding: '6px 5px', border: '1px solid #ccc', whiteSpace: 'nowrap', textAlign: 'center' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {steps.length === 0 ? (
            <tr><td colSpan={10} style={{ padding: 10, textAlign: 'center', border: '1px solid #ccc', color: '#888' }}>No steps found</td></tr>
          ) : steps.map((step, idx) => {
            const water = calcWater(step, bw)
            const wt = step.step_weight ? parseFloat(String(step.step_weight)) || bw : bw
            const validChems = (step.chemicals || []).filter(c => c.chemical_name)
            return (
              <tr key={step.id} style={{ verticalAlign: 'top' }}>
                <td style={{ padding: '5px', border: '1px solid #ccc', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ padding: '5px', border: '1px solid #ccc', fontWeight: 600 }}>
                  {step.process_name || '-'}
                  {step.step_weight ? <div style={{ fontSize: 9, color: '#888', fontWeight: 400 }}>[{wt}kg]</div> : null}
                </td>
                <td style={{ padding: '5px', border: '1px solid #ccc', textAlign: 'center' }}>{step.temperature || '-'}</td>
                <td style={{ padding: '5px', border: '1px solid #ccc', textAlign: 'center' }}>{step.time_minutes || '-'}</td>
                <td style={{ padding: '5px', border: '1px solid #ccc', textAlign: 'center', background: 'rgba(245,158,11,0.05)' }}>{step.non_op_time || '-'}</td>
                <td style={{ padding: '5px', border: '1px solid #ccc', textAlign: 'center' }}>{step.ltr || '-'}</td>
                <td style={{ padding: '5px', border: '1px solid #ccc', textAlign: 'center', color: '#0891b2', fontWeight: 600 }}>
                  {water > 0 ? `${water.toFixed(1)} Ltr` : '-'}
                </td>
                <td style={{ padding: '5px', border: '1px solid #ccc' }}>
                  {validChems.length > 0
                    ? validChems.map(c => <div key={c.id} style={{ padding: '2px 0' }}>{c.chemical_name}{c.batch_no ? ` [${c.batch_no}]` : ''}: {c.dosage} {c.unit}</div>)
                    : <span style={{ color: '#aaa' }}>-</span>}
                </td>
                <td style={{ padding: '5px', border: '1px solid #ccc', textAlign: 'right' }}>
                  {validChems.length > 0
                    ? validChems.map(c => <div key={c.id} style={{ padding: '2px 0', fontWeight: 600, color: '#059669' }}>{calcQty(c, water, wt).toFixed(3)} kg</div>)
                    : <span style={{ color: '#aaa' }}>-</span>}
                </td>
                <td style={{ padding: '5px', border: '1px solid #ccc', fontSize: 10, color: '#555' }}>{step.remarks || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Chemical Summary (optional) */}
      {showChemSummary && Object.keys(chemTotals).length > 0 && (
        <>
          <div style={{ margin: '18px 0 6px', fontSize: 12, fontWeight: 900, background: '#000', color: '#fff', padding: '5px 10px' }}>
            TOTAL CHEMICAL REQUIREMENT
          </div>
          <table style={{ width: '50%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'left' }}>Chemical Name</th>
                <th style={{ padding: '6px 8px', border: '1px solid #ccc', textAlign: 'right' }}>Total Qty (kg)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(chemTotals).map(([name, qty]) => (
                <tr key={name}>
                  <td style={{ padding: '4px 8px', border: '1px solid #ccc' }}>{name}</td>
                  <td style={{ padding: '4px 8px', border: '1px solid #ccc', textAlign: 'right', fontWeight: 600, color: '#059669' }}>{qty.toFixed(3)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Remarks */}
      {recipe.remarks && (
        <div style={{ marginTop: 18, padding: 10, border: '1px solid #ccc', borderRadius: 4 }}>
          <strong style={{ fontSize: 11 }}>Remarks</strong>
          <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 11 }}>{recipe.remarks}</p>
        </div>
      )}
    </A4ReportLayout>
  )
}

// ── Controls wrapper (shared) ─────────────────────────────────────────────────
function SheetControls({
  recipes, selectedId, setSelectedId,
  showChemSummary, setShowChemSummary,
  includeSignatures, setIncludeSignatures,
  confidentiality, setConfidentiality,
  onPrint, withChemToggle,
}: {
  recipes: Recipe[]
  selectedId: string
  setSelectedId: (id: string) => void
  showChemSummary: boolean
  setShowChemSummary: (v: boolean) => void
  includeSignatures: boolean
  setIncludeSignatures: (v: boolean) => void
  confidentiality: 'CONFIDENTIAL' | 'INTERNAL' | 'RESTRICTED' | 'PUBLIC'
  setConfidentiality: (v: 'CONFIDENTIAL' | 'INTERNAL' | 'RESTRICTED' | 'PUBLIC') => void
  onPrint: () => void
  withChemToggle: boolean
}) {
  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/40 rounded-xl border border-border no-print">
      <div className="flex-1 min-w-48">
        <label className="block text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">Select Recipe</label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">-- Choose Recipe --</option>
          {recipes.map(r => (
            <option key={r.id} value={r.id}>
              {r.recipe_no} — {r.customer_name}{r.style ? ` / ${r.style}` : ''}
            </option>
          ))}
        </select>
      </div>
      {withChemToggle && (
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={showChemSummary} onChange={e => setShowChemSummary(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
          <FileCheck className="w-4 h-4 text-muted-foreground" /> Chemical Summary
        </label>
      )}
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input type="checkbox" checked={includeSignatures} onChange={e => setIncludeSignatures(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
        Signatures
      </label>
      <div className="flex flex-col gap-1">
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Lock className="w-3 h-3" /> Access Level
        </label>
        <select
          value={confidentiality}
          onChange={e => setConfidentiality(e.target.value as any)}
          className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="CONFIDENTIAL">Confidential</option>
          <option value="RESTRICTED">Restricted</option>
          <option value="INTERNAL">Internal</option>
          <option value="PUBLIC">Public</option>
        </select>
      </div>
      <button
        onClick={onPrint}
        disabled={!selectedId}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-semibold"
      >
        <Printer className="w-4 h-4" /> Print / Save PDF
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT 1 — Full (with chemical summary toggle)
// ═══════════════════════════════════════════════════════════════════════════════
export function LaundryRecipeSheet() {
  const { recipes, selectedId, setSelectedId, recipe, steps, loading } = useRecipeSheet()
  const [showChemSummary, setShowChemSummary] = useState(true)
  const [includeSignatures, setIncludeSignatures] = useState(true)
  const [confidentiality, setConfidentiality] = useState<'CONFIDENTIAL' | 'INTERNAL' | 'RESTRICTED' | 'PUBLIC'>('CONFIDENTIAL')

  const handlePrint = () => {
    if (!recipe) { toast.error('Select a recipe first'); return }
    printRecipe(recipe, steps, { includeSummary: showChemSummary, includeChemicalSummary: showChemSummary, includeSignatures })
  }

  return (
    <div className="flex flex-col gap-4">
      <SheetControls
        recipes={recipes} selectedId={selectedId} setSelectedId={setSelectedId}
        showChemSummary={showChemSummary} setShowChemSummary={setShowChemSummary}
        includeSignatures={includeSignatures} setIncludeSignatures={setIncludeSignatures}
        confidentiality={confidentiality} setConfidentiality={setConfidentiality}
        onPrint={handlePrint} withChemToggle={true}
      />
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading...
        </div>
      )}
      {!loading && !recipe && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <span className="text-5xl mb-3">📝</span>
          <p className="font-semibold text-lg">Laundry Recipe Sheet</p>
          <p className="text-sm mt-1">Select a recipe above to preview the A4 sheet</p>
        </div>
      )}
      {!loading && recipe && (
        <SheetBody recipe={recipe} steps={steps} showChemSummary={showChemSummary} includeSignatures={includeSignatures} confidentiality={confidentiality} sigConfigKey="laundry_recipe" />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT 2 — Simple (NO chemical summary, company name always from Settings)
// ═══════════════════════════════════════════════════════════════════════════════
export function LaundryRecipeSheetSimple() {
  const { recipes, selectedId, setSelectedId, recipe, steps, loading } = useRecipeSheet()
  const [includeSignatures, setIncludeSignatures] = useState(true)
  const [confidentiality, setConfidentiality] = useState<'CONFIDENTIAL' | 'INTERNAL' | 'RESTRICTED' | 'PUBLIC'>('INTERNAL')

  const handlePrint = () => {
    if (!recipe) { toast.error('Select a recipe first'); return }
    printRecipe(recipe, steps, { includeSummary: false, includeChemicalSummary: false, includeSignatures })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Info banner showing current company name */}
      <div className="flex items-center gap-3 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-sm no-print">
        <span className="text-lg">🏭</span>
        <div>
          <span className="font-semibold">Company: </span>
          <span className="text-indigo-400 font-bold">
            {localStorage.getItem('company_name') || '(not set — go to Settings → Company Profile)'}
          </span>
        </div>
        <a href="/settings" className="ml-auto text-xs text-indigo-400 hover:underline">Change in Settings →</a>
      </div>

      <SheetControls
        recipes={recipes} selectedId={selectedId} setSelectedId={setSelectedId}
        showChemSummary={false} setShowChemSummary={() => {}}
        includeSignatures={includeSignatures} setIncludeSignatures={setIncludeSignatures}
        confidentiality={confidentiality} setConfidentiality={setConfidentiality}
        onPrint={handlePrint} withChemToggle={false}
      />
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading...
        </div>
      )}
      {!loading && !recipe && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <span className="text-5xl mb-3">📄</span>
          <p className="font-semibold text-lg">Simple Laundry Recipe Sheet</p>
          <p className="text-sm mt-1">No chemical summary — clean process sheet only</p>
        </div>
      )}
      {!loading && recipe && (
        <SheetBody recipe={recipe} steps={steps} showChemSummary={false} includeSignatures={includeSignatures} confidentiality={confidentiality} sigConfigKey="laundry_recipe_simple" />
      )}
    </div>
  )
}
