import { useState, useEffect } from 'react'
import { LocalDB } from '@/services/local-db'
import type { Recipe, RecipeStep, RecipeStepChemical, Chemical } from '@/types'
import { A4ReportLayout } from '@/components/reports/A4ReportLayout'

// ── Wet chemical cost item (auto-calculated from recipe) ────────────────────
interface ChemCostItem {
  id: string           // chemical_name as key
  name: string
  totalQtyKg: number   // total kg consumed per batch
  pricePerKg: number   // from Chemical master
  costBatch: number    // totalQtyKg × pricePerKg
  costPcs: number      // costBatch / pcsInLot
  manualOverride: boolean
}

// ── Dry process item (process-wise) ──────────────────────────────────────────
interface DryProcessItem {
  id: number
  process: string
  costPcs: number
}

interface CostSheetData {
  companyName: string
  status: string
  costingDate: string
  customer: string
  styleCode: string
  poNo: string
  reference: string
  pcsInLot: number
  currency: string
  exchangeRate: number
  issueDate: string
  styleCategory: string
  fabDetails: string
  exFactory: string
  garmentWeight: number
  color: string
  orderQty: number
  lotWeight: number
  contract: string
  washType: string
  processes: string
  reProcess: number
  profitMargin: number
  randomTime: number
  dryerTime: number
  hydroTime: number
  batchTime: number
  // Material cost extras (non-chemical, still manual)
  dryProcessMat: number
  garmentDyeing: number
  // Fixed costs (ex-DIRECT COST)
  floorExpenses: number
  dryProcessLabour: number
  specialFinish: number
  subContract: number
}

const DEFAULT_DRY_PROCESSES: DryProcessItem[] = [
  { id: 1, process: 'Sandblasting',   costPcs: 0 },
  { id: 2, process: 'Hand Scraping',  costPcs: 0 },
  { id: 3, process: 'Whiskers',       costPcs: 0 },
  { id: 4, process: 'PP Spray',       costPcs: 0 },
  { id: 5, process: 'Grinding',       costPcs: 0 },
]

export function WashingCostSheet() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [selectedRecipe, setSelectedRecipe] = useState<string>('')
  const [editMode, setEditMode] = useState(false)
  const [chemItems, setChemItems] = useState<ChemCostItem[]>([])
  const [dryItems, setDryItems] = useState<DryProcessItem[]>(DEFAULT_DRY_PROCESSES)
  const [nextId, setNextId] = useState(DEFAULT_DRY_PROCESSES.length + 1)
  const [confidentiality, setConfidentiality] = useState<'CONFIDENTIAL' | 'INTERNAL' | 'RESTRICTED' | 'PUBLIC'>('CONFIDENTIAL')

  const [data, setData] = useState<CostSheetData>({
    companyName: localStorage.getItem('company_name') || '',
    status: 'PROCESSING',
    costingDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    customer: '',
    styleCode: '',
    poNo: '',
    reference: '',
    pcsInLot: 435,
    currency: 'USD',
    exchangeRate: 92.4,
    issueDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    styleCategory: '',
    fabDetails: '',
    exFactory: '',
    garmentWeight: 0.230,
    color: '',
    orderQty: 1,
    lotWeight: 100,
    contract: 'In House',
    washType: '',
    processes: '',
    reProcess: 15,
    profitMargin: 15,
    randomTime: 0,
    dryerTime: 60,
    hydroTime: 10,
    batchTime: 206,
    dryProcessMat: 0,
    garmentDyeing: 0.040,
    floorExpenses: 0.097,
    dryProcessLabour: 0,
    specialFinish: 0,
    subContract: 0,
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const recipeData = await LocalDB.getAll<Recipe>('recipes')
    setRecipes(recipeData)
  }

  // ── Helpers for chemical quantity calculation ─────────────────────────────
  const calcWater = (step: RecipeStep, batchWeight: number): number => {
    const match = String(step.ltr || '').match(/1:(\d+(?:\.\d+)?)/)
    if (!match) return 0
    const ratio = parseFloat(match[1])
    const wt = step.step_weight ? parseFloat(String(step.step_weight)) || batchWeight : batchWeight
    return ratio * wt
  }

  const calcChemQty = (chem: RecipeStepChemical, water: number, weight: number): number => {
    const d = parseFloat(String(chem.dosage)) || 0
    switch (chem.unit) {
      case 'g/l':  case 'ml/l':  return (d * water) / 1000
      case '%':                  return (d * weight) / 100
      case 'g/kg': case 'ml/kg': return (d * weight) / 1000
      case 'kg':                 return d
      default:                   return (d * weight) / 1000
    }
  }

  const buildChemItems = async (recipe: Recipe): Promise<ChemCostItem[]> => {
    const pcs = recipe.batch_quantity || 435
    const bw  = parseFloat(String(recipe.batch_weight)) || 100

    const steps    = await LocalDB.getByIndex<RecipeStep>('recipe_steps', 'recipe_id', recipe.id)
    const chemicals = await LocalDB.getAll<Chemical>('chemicals')
    const priceMap  = Object.fromEntries(chemicals.map(c => [c.name, c.price_per_kg || 0]))

    // Aggregate qty per chemical across all steps
    const totals: Record<string, { qty: number; price: number }> = {}
    for (const step of steps) {
      const chems = await LocalDB.getByIndex<RecipeStepChemical>('recipe_step_chemicals', 'recipe_step_id', step.id)
      const water = calcWater(step, bw)
      const wt    = step.step_weight ? parseFloat(String(step.step_weight)) || bw : bw
      for (const c of chems) {
        if (!c.chemical_name) continue
        const qty = calcChemQty(c, water, wt)
        if (!totals[c.chemical_name]) totals[c.chemical_name] = { qty: 0, price: priceMap[c.chemical_name] || 0 }
        totals[c.chemical_name].qty += qty
      }
    }

    return Object.entries(totals).map(([name, { qty, price }]) => ({
      id: name,
      name,
      totalQtyKg:   qty,
      pricePerKg:   price,
      costBatch:    qty * price,
      costPcs:      pcs > 0 ? (qty * price) / pcs : 0,
      manualOverride: false,
    }))
  }

  const handleRecipeSelect = async (recipeId: string) => {
    setSelectedRecipe(recipeId)
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return

    const items = await buildChemItems(recipe)
    setChemItems(items)

    setData(prev => ({
      ...prev,
      companyName: localStorage.getItem('company_name') || recipe.factory_name || prev.companyName,
      customer:    recipe.customer_name || '',
      styleCode:   recipe.style || '',
      color:       recipe.color || '',
      garmentWeight: recipe.batch_weight ? recipe.batch_weight / 435 : 0.230,
      lotWeight:   recipe.batch_weight || 100,
      washType:    recipe.wash_type || '',
      processes:   recipe.wash_type || '',
      reference:   recipe.recipe_ref || '',
      poNo:        (recipe as any).po || '',
      batchTime:   recipe.recipe_time || 206,
      pcsInLot:    recipe.batch_quantity || 435,
      orderQty:    (recipe as any).order_quantity || 1,
    }))
  }

  const set = (key: keyof CostSheetData, val: string | number) =>
    setData(prev => ({ ...prev, [key]: val }))

  // ── Dry process item helpers ────────────────────────────────────────────────
  const addDryItem = () => {
    setDryItems(prev => [...prev, { id: nextId, process: 'New Process', costPcs: 0 }])
    setNextId(n => n + 1)
  }
  const removeDryItem = (id: number) => setDryItems(prev => prev.filter(d => d.id !== id))
  const updateDryItem = (id: number, field: 'process' | 'costPcs', val: string | number) =>
    setDryItems(prev => prev.map(d => d.id === id ? { ...d, [field]: val } : d))

  // ── Calculations ─────────────────────────────────────────────────────────────
  const totalChemCost   = chemItems.reduce((s, c) => s + c.costPcs, 0)
  const totalMaterials  = totalChemCost + data.dryProcessMat + data.garmentDyeing
  const totalFixed      = data.floorExpenses + data.dryProcessLabour + data.specialFinish + data.subContract
  const totalDryProcess = dryItems.reduce((s, d) => s + d.costPcs, 0)
  const reProcessCost   = (totalMaterials + totalFixed) * (data.reProcess / 100)
  const totalAfterReprocess = totalMaterials + totalFixed + reProcessCost
  const totalCost       = totalAfterReprocess + totalDryProcess
  const profitAmount    = totalCost * (data.profitMargin / 100)
  const totalPrice      = totalCost + profitAmount

  const pct = (val: number) => totalPrice > 0 ? ((val / totalPrice) * 100).toFixed(0) + '%' : '0%'
  const dzn = (val: number) => (val * 12).toFixed(2)
  const fmt = (val: number) => val.toFixed(3)

  // QR data for the cost sheet
  const qrData = JSON.stringify({
    customer: data.customer,
    style: data.styleCode,
    washType: data.washType,
    totalPcs: fmt(totalPrice),
    currency: data.currency,
  })

  // Status color
  const statusColorMap: Record<string, 'green' | 'yellow' | 'blue' | 'red' | 'purple' | 'gray'> = {
    PROCESSING: 'yellow',
    APPROVED: 'green',
    PENDING: 'blue',
    REJECTED: 'red',
  }

  // ── Sub-components ────────────────────────────────────────────────────────────
  const Field = ({ label, value, field, type = 'text' }: { label: string; value: string | number; field: keyof CostSheetData; type?: string }) => (
    <div className="flex text-xs leading-5">
      <span className="font-bold w-28 shrink-0">{label} :</span>
      {editMode ? (
        <input type={type} value={value}
          onChange={e => set(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
          className="border-b border-gray-500 flex-1 px-1 text-xs outline-none bg-yellow-50" />
      ) : (
        <span className="border-b border-gray-400 flex-1 px-1">{value}</span>
      )}
    </div>
  )

  // vertical label cell (rowSpan)
  const VLabel = ({ label, rowSpan, color }: { label: string; rowSpan: number; color: string }) => (
    <td rowSpan={rowSpan}
      className={`border border-gray-400 px-1 text-center text-xs font-bold align-middle ${color}`}
      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '2px', width: 22 }}>
      {label}
    </td>
  )

  // editable cost row
  const EditableCostRow = ({ label, field, bg }: { label: string; field: keyof CostSheetData; bg: string }) => (
    <tr className={bg}>
      <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4">{label}</td>
      <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
        {editMode
          ? <input type="number" step="0.001" value={data[field] as number}
              onChange={e => set(field, parseFloat(e.target.value) || 0)}
              className="w-20 text-right border-b border-gray-400 bg-yellow-50 outline-none text-xs" />
          : fmt(data[field] as number)}
      </td>
      <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{dzn(data[field] as number)}</td>
      <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{pct(data[field] as number)}</td>
    </tr>
  )

  const SubTotalRow = ({ label, val, bg = 'bg-gray-100' }: { label: string; val: number; bg?: string }) => (
    <tr className={bg}>
      <td className="border border-gray-500 px-3 py-0.5 text-xs font-bold">{label}</td>
      <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{fmt(val)}</td>
      <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{dzn(val)}</td>
      <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{pct(val)}</td>
    </tr>
  )

  // ── Cost breakdown mini-bar ──
  const costBreakdownBar = () => {
    if (totalPrice <= 0) return null
    const matW = (totalMaterials / totalPrice) * 100
    const fixW = (totalFixed / totalPrice) * 100
    const dryW = (totalDryProcess / totalPrice) * 100
    const profW = (profitAmount / totalPrice) * 100
    const reW  = (reProcessCost / totalPrice) * 100
    return (
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 14, fontSize: 0 }}>
        {matW > 0 && <div style={{ width: `${matW}%`, background: '#3b82f6' }} title={`Material: ${matW.toFixed(0)}%`} />}
        {fixW > 0 && <div style={{ width: `${fixW}%`, background: '#22c55e' }} title={`Fixed: ${fixW.toFixed(0)}%`} />}
        {reW > 0 && <div style={{ width: `${reW}%`, background: '#f97316' }} title={`Re-process: ${reW.toFixed(0)}%`} />}
        {dryW > 0 && <div style={{ width: `${dryW}%`, background: '#a855f7' }} title={`Dry Process: ${dryW.toFixed(0)}%`} />}
        {profW > 0 && <div style={{ width: `${profW}%`, background: '#eab308' }} title={`Profit: ${profW.toFixed(0)}%`} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-3 items-center flex-wrap no-print">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Select Recipe</label>
          <select value={selectedRecipe} onChange={e => handleRecipeSelect(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-sm">
            <option value="">-- Select Recipe --</option>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.recipe_no} - {r.customer_name}</option>)}
          </select>
        </div>
        <button onClick={() => setEditMode(!editMode)}
          className={`px-4 py-2 rounded-lg text-white text-sm ${editMode ? 'bg-amber-600' : 'bg-gray-700'}`}>
          {editMode ? '✓ Done' : '✏️ Edit Fields'}
        </button>
        <select
          value={confidentiality}
          onChange={e => setConfidentiality(e.target.value as any)}
          className="px-2 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs"
        >
          <option value="CONFIDENTIAL">Confidential</option>
          <option value="RESTRICTED">Restricted</option>
          <option value="INTERNAL">Internal</option>
          <option value="PUBLIC">Public</option>
        </select>
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm">
          🖨️ Print
        </button>
      </div>

      {/* A4 Report using A4ReportLayout */}
      <A4ReportLayout
        reportId="cost-sheet-print"
        title="WASHING COST SHEET"
        orientation="portrait"
        companyName={data.companyName || undefined}
        qrData={qrData}
        showQR={true}
        confidentiality={confidentiality}
        statusBadge={data.status}
        statusColor={statusColorMap[data.status] || 'blue'}
        showSignatures={true}
        signatureConfigKey="washing_cost"
      >
        {/* ── INFO GRID ── */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-0.5 mb-3">
          <div className="space-y-0.5">
            <Field label="Costing Date" value={data.costingDate}  field="costingDate" />
            <Field label="Customer"     value={data.customer}     field="customer" />
            <Field label="Style Code"   value={data.styleCode}    field="styleCode" />
            <Field label="Po No"        value={data.poNo}         field="poNo" />
            <Field label="Reference"    value={data.reference}    field="reference" />
            <Field label="Pcs in Lot"   value={data.pcsInLot}     field="pcsInLot"  type="number" />
          </div>
          <div className="space-y-0.5">
            <Field label="Currency"    value={`${data.currency} (${data.exchangeRate})`} field="currency" />
            <Field label="Issue Date"  value={data.issueDate}      field="issueDate" />
            <Field label="Style Cat."  value={data.styleCategory}  field="styleCategory" />
            <Field label="Fab. Details" value={data.fabDetails}    field="fabDetails" />
            <Field label="Ex-Factory"  value={data.exFactory}      field="exFactory" />
            <Field label="Garment Wt"  value={`${data.garmentWeight.toFixed(3)} KG`} field="garmentWeight" type="number" />
          </div>
          <div className="space-y-0.5">
            <Field label="Color"        value={data.color}         field="color" />
            <Field label="Order Qty"   value={data.orderQty}       field="orderQty"  type="number" />
            <Field label="Lot Weight"   value={`${data.lotWeight} KG`} field="lotWeight" type="number" />
            <Field label="Contract"     value={data.contract}      field="contract" />
            <Field label="Re-Process"   value={`${data.reProcess}%`}    field="reProcess"   type="number" />
            <Field label="Profit Margin" value={`${data.profitMargin}%`} field="profitMargin" type="number" />
          </div>
        </div>

        {/* ── WASH TYPE & PROCESSES ── */}
        <div className="mb-2 text-xs">
          <span className="font-bold">Wash Type : </span>
          {editMode
            ? <input value={data.washType} onChange={e => set('washType', e.target.value)}
                className="border-b border-gray-400 w-48 px-1 bg-yellow-50 outline-none" />
            : <span>{data.washType}</span>}
        </div>
        <div className="mb-3 text-xs">
          <span className="font-bold">Processes : </span>
          {editMode
            ? <input value={data.processes} onChange={e => set('processes', e.target.value)}
                className="border-b border-gray-400 w-full px-1 bg-yellow-50 outline-none" />
            : <span className="italic">{data.processes}</span>}
        </div>

        {/* ── TIME ROW ── */}
        <div className="grid grid-cols-4 gap-4 mb-3 bg-gray-50 border border-gray-300 p-2 rounded text-xs">
          <Field label="Random Time"  value={`${data.randomTime} Min`} field="randomTime"  type="number" />
          <Field label="Dryer Time"   value={`${data.dryerTime} Min`}  field="dryerTime"   type="number" />
          <Field label="Hydro Time"   value={`${data.hydroTime} Min`}  field="hydroTime"   type="number" />
          <Field label="Batch Time"   value={`${data.batchTime} Min`}  field="batchTime"   type="number" />
        </div>

        {/* ── Cost Breakdown Mini Bar ── */}
        {costBreakdownBar()}

        {/* ── Legend for cost bar ── */}
        {totalPrice > 0 && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 9, color: '#666', flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#3b82f6', marginRight: 3, verticalAlign: 'middle' }}></span>Material</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#22c55e', marginRight: 3, verticalAlign: 'middle' }}></span>Fixed</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f97316', marginRight: 3, verticalAlign: 'middle' }}></span>Re-process</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#a855f7', marginRight: 3, verticalAlign: 'middle' }}></span>Dry Process</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#eab308', marginRight: 3, verticalAlign: 'middle' }}></span>Profit</span>
          </div>
        )}

        {/* ── COST TABLE ── */}
        <table className="w-full text-xs border-collapse mb-3">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="border border-gray-600 px-3 py-1 text-left w-6">COST</th>
              <th className="border border-gray-600 px-3 py-1 text-left">Particulars</th>
              <th className="border border-gray-600 px-3 py-1 text-right w-24">Amount (Pcs)</th>
              <th className="border border-gray-600 px-3 py-1 text-right w-24">Amount (DZ)</th>
              <th className="border border-gray-600 px-3 py-1 text-right w-20">Sale Price %</th>
            </tr>
          </thead>
          <tbody>

            {/* ── MATERIAL COST — chemical cost rows (auto from recipe) ── */}
            {chemItems.length === 0 ? (
              <tr className="bg-blue-50">
                <VLabel label="MATERIAL COST" rowSpan={3} color="text-blue-900" />
                <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4 italic text-gray-400" colSpan={4}>
                  Select a recipe to load chemical costs
                </td>
              </tr>
            ) : (
              chemItems.map((item, idx) => (
                <tr key={item.id} className="bg-blue-50">
                  {idx === 0 && (
                    <VLabel label="MATERIAL COST" rowSpan={chemItems.length + 3} color="text-blue-900" />
                  )}
                  <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4 flex items-center gap-1">
                    {item.name}
                    <span className="text-gray-400 ml-1">({item.totalQtyKg.toFixed(3)} kg × {item.pricePerKg.toFixed(2)})</span>
                  </td>
                  <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
                    {editMode
                      ? <input type="number" step="0.0001" value={item.costPcs}
                          onChange={e => setChemItems(prev => prev.map(c =>
                            c.id === item.id ? { ...c, costPcs: parseFloat(e.target.value)||0, manualOverride: true } : c
                          ))}
                          className="w-20 text-right border-b border-gray-400 bg-yellow-50 outline-none text-xs" />
                      : fmt(item.costPcs)}
                  </td>
                  <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{dzn(item.costPcs)}</td>
                  <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{pct(item.costPcs)}</td>
                </tr>
              ))
            )}
            {/* Chemical subtotal */}
            {chemItems.length > 0 && (
              <tr className="bg-blue-100">
                <td className="border border-gray-500 px-3 py-0.5 text-xs font-semibold pl-4">Chemical Cost (Total)</td>
                <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-semibold">{fmt(totalChemCost)}</td>
                <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-semibold">{dzn(totalChemCost)}</td>
                <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-semibold">{pct(totalChemCost)}</td>
              </tr>
            )}
            <tr className="bg-blue-50">
              {chemItems.length === 0 && <td />}
              <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4">Dry Process (Mat)</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
                {editMode ? <input type="number" step="0.001" value={data.dryProcessMat} onChange={e => set('dryProcessMat', parseFloat(e.target.value)||0)} className="w-20 text-right border-b border-gray-400 bg-yellow-50 outline-none text-xs" /> : fmt(data.dryProcessMat)}
              </td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{dzn(data.dryProcessMat)}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{pct(data.dryProcessMat)}</td>
            </tr>
            <tr className="bg-blue-50">
              {chemItems.length === 0 && <td />}
              <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4">Garment Dyeing</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
                {editMode ? <input type="number" step="0.001" value={data.garmentDyeing} onChange={e => set('garmentDyeing', parseFloat(e.target.value)||0)} className="w-20 text-right border-b border-gray-400 bg-yellow-50 outline-none text-xs" /> : fmt(data.garmentDyeing)}
              </td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{dzn(data.garmentDyeing)}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{pct(data.garmentDyeing)}</td>
            </tr>
            <SubTotalRow label="Total materials cost" val={totalMaterials} bg="bg-blue-100" />

            {/* ── FIXED COSTS (ex-DIRECT COST) ── */}
            <tr className="bg-green-50">
              <VLabel label="FIXED COSTS" rowSpan={5} color="text-green-900" />
              <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4">Floor Expenses (Wet+G.Dye)</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
                {editMode ? <input type="number" step="0.001" value={data.floorExpenses} onChange={e => set('floorExpenses', parseFloat(e.target.value)||0)} className="w-20 text-right border-b border-gray-400 bg-yellow-50 outline-none text-xs" /> : fmt(data.floorExpenses)}
              </td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{dzn(data.floorExpenses)}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{pct(data.floorExpenses)}</td>
            </tr>
            <tr className="bg-green-50">
              <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4">Dry Process (Labour Cost)</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
                {editMode ? <input type="number" step="0.001" value={data.dryProcessLabour} onChange={e => set('dryProcessLabour', parseFloat(e.target.value)||0)} className="w-20 text-right border-b border-gray-400 bg-yellow-50 outline-none text-xs" /> : fmt(data.dryProcessLabour)}
              </td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{dzn(data.dryProcessLabour)}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{pct(data.dryProcessLabour)}</td>
            </tr>
            <tr className="bg-green-50">
              <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4">Special Finish</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
                {editMode ? <input type="number" step="0.001" value={data.specialFinish} onChange={e => set('specialFinish', parseFloat(e.target.value)||0)} className="w-20 text-right border-b border-gray-400 bg-yellow-50 outline-none text-xs" /> : fmt(data.specialFinish)}
              </td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{dzn(data.specialFinish)}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{pct(data.specialFinish)}</td>
            </tr>
            <tr className="bg-green-50">
              <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4">Sub-Contract</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
                {editMode ? <input type="number" step="0.001" value={data.subContract} onChange={e => set('subContract', parseFloat(e.target.value)||0)} className="w-20 text-right border-b border-gray-400 bg-yellow-50 outline-none text-xs" /> : fmt(data.subContract)}
              </td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{dzn(data.subContract)}</td>
              <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{pct(data.subContract)}</td>
            </tr>
            <SubTotalRow label="Total fixed costs" val={totalFixed} bg="bg-green-100" />

            {/* ── RE-PROCESSING ── */}
            <tr className="bg-orange-50">
              <td className="border border-gray-400 px-1 text-center text-xs font-bold align-middle text-orange-900"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', width: 22 }}>RE-PROC</td>
              <td className="border border-gray-500 px-3 py-0.5 text-xs font-semibold">
                Total manufacturing cost after re-processing ({data.reProcess}%)
              </td>
              <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{fmt(totalAfterReprocess)}</td>
              <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{dzn(totalAfterReprocess)}</td>
              <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{pct(totalAfterReprocess)}</td>
            </tr>

            {/* ── DRY PROCESS COST (process-wise, dynamic) ── */}
            {dryItems.map((item, idx) => (
              <tr key={item.id} className="bg-purple-50">
                {idx === 0 && (
                  <td rowSpan={dryItems.length + 1}
                    className="border border-gray-400 px-1 text-center text-xs font-bold align-middle text-purple-900"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '2px', width: 22 }}>
                    DRY PROCESS COST
                  </td>
                )}
                <td className="border border-gray-400 px-3 py-0.5 text-xs pl-4">
                  {editMode
                    ? <input value={item.process} onChange={e => updateDryItem(item.id, 'process', e.target.value)}
                        className="border-b border-gray-400 bg-yellow-50 outline-none text-xs w-48 px-1" />
                    : item.process}
                </td>
                <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
                  {editMode
                    ? <input type="number" step="0.001" value={item.costPcs}
                        onChange={e => updateDryItem(item.id, 'costPcs', parseFloat(e.target.value) || 0)}
                        className="w-20 text-right border-b border-gray-400 bg-yellow-50 outline-none text-xs" />
                    : fmt(item.costPcs)}
                </td>
                <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">{dzn(item.costPcs)}</td>
                <td className="border border-gray-400 px-2 py-0.5 text-xs text-right">
                  {pct(item.costPcs)}
                  {editMode && (
                    <button onClick={() => removeDryItem(item.id)}
                      className="ml-2 text-red-500 hover:text-red-700 font-bold leading-none no-print" title="Remove">✕</button>
                  )}
                </td>
              </tr>
            ))}
            {/* Dry process subtotal + add button row */}
            <tr className="bg-purple-100">
              <td className="border border-gray-500 px-3 py-0.5 text-xs font-bold">
                Total dry process cost
                {editMode && (
                  <button onClick={addDryItem}
                    className="ml-3 px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs no-print">
                    + Add Process
                  </button>
                )}
              </td>
              <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{fmt(totalDryProcess)}</td>
              <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{dzn(totalDryProcess)}</td>
              <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{pct(totalDryProcess)}</td>
            </tr>

            {/* ── PROFIT ── */}
            <tr className="bg-yellow-100">
              <td className="border border-gray-500 px-2 py-0.5 text-xs font-semibold text-center">PROFIT</td>
              <td className="border border-gray-500 px-3 py-0.5 text-xs font-semibold">Profit margin on total cost ({data.profitMargin}%)</td>
              <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{fmt(profitAmount)}</td>
              <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{dzn(profitAmount)}</td>
              <td className="border border-gray-500 px-2 py-0.5 text-xs text-right font-bold">{data.profitMargin}%</td>
            </tr>

            {/* ── TOTAL WASHING PRICE ── */}
            <tr className="bg-green-200">
              <td className="border-2 border-gray-700 px-2 py-1 text-xs font-bold text-center">TOTAL</td>
              <td className="border-2 border-gray-700 px-3 py-1 text-sm font-bold">Total Washing Price</td>
              <td className="border-2 border-gray-700 px-2 py-1 text-sm text-right font-bold">{fmt(totalPrice)}</td>
              <td className="border-2 border-gray-700 px-2 py-1 text-sm text-right font-bold">{dzn(totalPrice)}</td>
              <td className="border-2 border-gray-700 px-2 py-1 text-sm text-right font-bold">100%</td>
            </tr>

          </tbody>
        </table>
      </A4ReportLayout>
    </div>
  )
}
