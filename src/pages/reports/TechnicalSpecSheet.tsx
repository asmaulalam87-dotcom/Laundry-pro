import { useState, useEffect, useRef } from 'react'
import { LocalDB } from '@/services/local-db'
import type { Recipe } from '@/types'
import { A4ReportLayout } from '@/components/reports/A4ReportLayout'
import { Camera, Plus, Trash2, Copy, X } from 'lucide-react'

interface DryProcess {
  name: string
}

interface PriceColumn {
  id: string
  label: string
}

interface Sheet {
  id: string
  buyer: string
  style: string
  item: string
  size: string
  color: string
  date: string
  sdzn: string
  washProcess: string
  washProcessCost: number
  dryCosts: number[]
  priceInputs: Record<string, number>
  photoUrl: string
}

const DEFAULT_DRY_COLUMNS: DryProcess[] = [
  { name: 'LASER WHISKER' },
  { name: 'HAND SAND' },
  { name: 'PP SPRAY' },
  { name: 'TAGGING' },
  { name: 'HEAVY GRINDING\n(5 POCKET & VAM)' },
]

const newSheet = (dryCount: number, priceColIds: string[], id?: string): Sheet => ({
  id: id ?? Date.now().toString(),
  buyer: '',
  style: '',
  item: '',
  size: 'XXS-XXL',
  color: '',
  date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
  sdzn: '5/DZN',
  washProcess: '',
  washProcessCost: 0,
  dryCosts: Array(dryCount).fill(0),
  priceInputs: Object.fromEntries(priceColIds.map(pid => [pid, 0])),
  photoUrl: '',
})

export function TechnicalSpecSheet() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [editMode, setEditMode] = useState(true)
  const [preparedBy, setPreparedBy] = useState(() => localStorage.getItem('company_name') || 'WASH TECHNICAL')
  const [dryColumns, setDryColumns] = useState<DryProcess[]>(DEFAULT_DRY_COLUMNS)
  const [priceColumns, setPriceColumns] = useState<PriceColumn[]>([])
  const [confidentiality, setConfidentiality] = useState<'CONFIDENTIAL' | 'INTERNAL' | 'RESTRICTED' | 'PUBLIC'>('INTERNAL')
  const [sheets, setSheets] = useState<Sheet[]>([
    {
      id: 'sheet-1',
      buyer: 'NEW YORKER',
      style: 'EMBROIDARY PANTS',
      item: 'DLP',
      size: 'XXS-XXL',
      color: 'BLACK',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
      sdzn: '5/DZN',
      washProcess: 'DESIZE+STONE ENZYME+PP BLEACH+NEUTRAL+ACID WASH+NEUTRAL+PP NEUTRAL+CLEANUP+TINT+SOFTNER',
      washProcessCost: 10.50,
      dryCosts: [1.50, 1.20, 1.30, 6.50, 0.80],
      priceInputs: {},
      photoUrl: '',
    }
  ])

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => { LocalDB.getAll<Recipe>('recipes').then(setRecipes) }, [])

  const priceColIds = priceColumns.map(p => p.id)

  const addSheet = () =>
    setSheets(prev => [...prev, newSheet(dryColumns.length, priceColIds)])

  const removeSheet = (id: string) =>
    setSheets(prev => prev.filter(s => s.id !== id))

  const dupSheet = (id: string) => {
    const src = sheets.find(s => s.id === id)
    if (src) setSheets(prev => [...prev, { ...src, id: Date.now().toString() }])
  }

  const updateSheet = (id: string, key: keyof Sheet, val: any) =>
    setSheets(prev => prev.map(s => s.id === id ? { ...s, [key]: val } : s))

  const updateDryCost = (sheetId: string, colIdx: number, val: number) =>
    setSheets(prev => prev.map(s => {
      if (s.id !== sheetId) return s
      const costs = [...s.dryCosts]
      costs[colIdx] = val
      return { ...s, dryCosts: costs }
    }))

  const updatePriceInput = (sheetId: string, priceColId: string, val: number) =>
    setSheets(prev => prev.map(s => {
      if (s.id !== sheetId) return s
      return { ...s, priceInputs: { ...s.priceInputs, [priceColId]: val } }
    }))

  const addColumn = () => {
    setDryColumns(prev => [...prev, { name: 'NEW PROCESS' }])
    setSheets(prev => prev.map(s => ({ ...s, dryCosts: [...s.dryCosts, 0] })))
  }

  const removeColumn = (colIdx: number) => {
    setDryColumns(prev => prev.filter((_, i) => i !== colIdx))
    setSheets(prev => prev.map(s => ({ ...s, dryCosts: s.dryCosts.filter((_, i) => i !== colIdx) })))
  }

  const updateColumnName = (colIdx: number, name: string) =>
    setDryColumns(prev => prev.map((c, i) => i === colIdx ? { name } : c))

  // Price columns
  const addPriceColumn = () => {
    const newCol: PriceColumn = {
      id: Date.now().toString(36),
      label: 'PRICE',
    }
    setPriceColumns(prev => [...prev, newCol])
    setSheets(prev => prev.map(s => ({
      ...s,
      priceInputs: { ...s.priceInputs, [newCol.id]: 0 }
    })))
  }

  const removePriceColumn = (colId: string) => {
    setPriceColumns(prev => prev.filter(p => p.id !== colId))
    setSheets(prev => prev.map(s => {
      const { [colId]: _, ...rest } = s.priceInputs
      return { ...s, priceInputs: rest }
    }))
  }

  const updatePriceColumnLabel = (colId: string, label: string) =>
    setPriceColumns(prev => prev.map(p => p.id === colId ? { ...p, label } : p))

  // Photo handling — file upload
  const handlePhoto = (sheetId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = ev => updateSheet(sheetId, 'photoUrl', ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  // Photo handling — mobile camera capture
  const handleCameraCapture = (sheetId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = ev => updateSheet(sheetId, 'photoUrl', ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const importRecipe = (sheetId: string, recipeId: string) => {
    const recipe = recipes.find(r => r.id === recipeId)
    if (!recipe) return
    setSheets(prev => prev.map(s => s.id === sheetId ? s : {
      ...s,
      buyer: recipe.customer_name || s.buyer,
      style: recipe.style || s.style,
      color: recipe.color || s.color,
      item: (recipe as any).item || s.item,
      washProcess: recipe.wash_type || s.washProcess,
      photoUrl: (recipe as any).photos?.[0] || s.photoUrl,
    }))
  }

  const sheetTotal = (s: Sheet) => s.washProcessCost + s.dryCosts.reduce((a, b) => a + b, 0)
  const colTotal = (colIdx: number) => sheets.reduce((sum, s) => sum + (s.dryCosts[colIdx] || 0), 0)
  const washTotal = sheets.reduce((sum, s) => sum + s.washProcessCost, 0)
  const grandTotal = sheets.reduce((sum, s) => sum + sheetTotal(s), 0)
  const priceColTotal = (colId: string) => sheets.reduce((sum, s) => sum + (s.priceInputs[colId] || 0), 0)

  // QR data
  const qrData = sheets.map(s =>
    `${s.buyer || 'N/A'}|${s.style || 'N/A'}|${s.color || 'N/A'}|$${sheetTotal(s).toFixed(2)}`
  ).join('\n')

  // Editable cell
  const EC = ({ val, onChange, type = 'text', cls = '', rows }: {
    val: string | number; onChange: (v: any) => void
    type?: string; cls?: string; rows?: number
  }) => {
    if (!editMode) return <span className={cls}>{val}</span>
    if (rows) return (
      <textarea value={String(val)} rows={rows} onChange={e => onChange(e.target.value)}
        className={`w-full border border-gray-400 bg-white px-1 text-xs outline-none resize-none ${cls}`} />
    )
    return (
      <input type={type} value={val} step={type === 'number' ? '0.01' : undefined}
        onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        className={`w-full border border-gray-400 bg-white px-1 text-xs outline-none text-center ${cls}`} />
    )
  }

  // Calculate total column count for colSpan
  const totalCols = 6 + 1 + dryColumns.length + 1 + 1 + 1 + priceColumns.length // BUYER(2) STYLE ITEM SIZE COLOR WASH + dry cols + DATE + PICTURE + BEST PRICE + price cols

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex gap-2 flex-wrap items-center no-print p-3 bg-gray-800 rounded-lg">
        <button onClick={() => setEditMode(!editMode)}
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${editMode ? 'bg-amber-600 hover:bg-amber-500' : 'bg-gray-600 hover:bg-gray-500'}`}>
          {editMode ? '✓ Done Editing' : '✏️ Edit Mode'}
        </button>
        {editMode && (
          <>
            <button onClick={addSheet}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Sheet
            </button>
            <button onClick={addColumn}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Dry Process Column
            </button>
            <button onClick={addPriceColumn}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Price Column
            </button>
          </>
        )}
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
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white font-medium ml-auto">
          🖨️ Print (Landscape A4)
        </button>
      </div>

      <div className="flex items-center gap-3 no-print">
        <span className="text-sm text-gray-400">
          {sheets.length} sheet{sheets.length !== 1 ? 's' : ''} · {dryColumns.length} dry process · {priceColumns.length} price column{priceColumns.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── A4 LANDSCAPE REPORT ── */}
      <A4ReportLayout
        reportId="tech-spec-print"
        title="TECHNICAL SPECIFICATION SHEET"
        orientation="landscape"
        qrData={qrData}
        showQR={true}
        confidentiality={confidentiality}
        statusBadge={`${sheets.length} Styles`}
        statusColor="purple"
        preparedBy={editMode ? undefined : preparedBy}
        showSignatures={true}
        signatureConfigKey="technical_spec"
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
        <table className="border-collapse text-xs w-full" style={{ minWidth: '960px' }}>
          <thead>
            {/* Sub-header row: column grouping */}
            <tr className="bg-gray-100 text-gray-500 text-[10px] italic">
              <td className="border border-gray-300 px-1 py-0.5 text-center" colSpan={6}></td>
              <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">WASH PROCESS</td>
              {dryColumns.map((_, i) => (
                <td key={i} className="border border-gray-300 px-1 py-0.5 text-center font-semibold">DRY PROCESS</td>
              ))}
              <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">BASE ON PICTURE</td>
              <td className="border border-gray-300 px-1 py-0.5 text-center font-semibold">BEST PRICE</td>
              {priceColumns.map(pc => (
                <td key={pc.id} className="border border-gray-300 px-1 py-0.5 text-center font-semibold">{pc.label}</td>
              ))}
            </tr>
            {/* Main header row */}
            <tr className="bg-gray-900 text-white">
              <th className="border border-gray-700 px-2 py-1.5 text-left text-[11px]" colSpan={2}>BUYER</th>
              <th className="border border-gray-700 px-2 py-1.5 text-left text-[11px]">STYLE</th>
              <th className="border border-gray-700 px-2 py-1.5 text-center text-[11px]">ITEM</th>
              <th className="border border-gray-700 px-2 py-1.5 text-center text-[11px]">SIZE</th>
              <th className="border border-gray-700 px-2 py-1.5 text-center text-[11px]">COLOR</th>
              <th className="border border-gray-700 px-2 py-1.5 text-center text-[11px]" style={{ minWidth: '140px' }}>WASH PROCESS</th>
              {dryColumns.map((col, i) => (
                <th key={i} className="border border-gray-700 px-1 py-1.5 text-center text-[11px]" style={{ minWidth: '72px' }}>
                  {editMode ? (
                    <div className="flex flex-col gap-0.5">
                      <textarea value={col.name} rows={2} onChange={e => updateColumnName(i, e.target.value)}
                        className="border border-gray-500 bg-white text-black px-1 text-[10px] w-full outline-none resize-none text-center" />
                      <button onClick={() => removeColumn(i)} className="text-red-300 hover:text-red-100 text-[10px]">✕ del</button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold whitespace-pre-line">{col.name}</span>
                  )}
                </th>
              ))}
              <th className="border border-gray-700 px-2 py-1.5 text-center text-[11px]">PICTURE</th>
              <th className="border border-gray-700 px-2 py-1.5 text-center text-[11px]" style={{ minWidth: '80px' }}>
                BEST PRICE<br />PER DZN $
                {editMode && (
                  <button onClick={addPriceColumn} className="text-[9px] text-gray-400 hover:text-white mt-0.5 block mx-auto">+ price col</button>
                )}
              </th>
              {priceColumns.map(pc => (
                <th key={pc.id} className="border border-gray-700 px-1 py-1.5 text-center text-[11px]" style={{ minWidth: '72px' }}>
                  {editMode ? (
                    <div className="flex flex-col gap-0.5">
                      <input type="text" value={pc.label} onChange={e => updatePriceColumnLabel(pc.id, e.target.value)}
                        className="border border-gray-500 bg-white text-black px-1 text-[10px] w-full outline-none text-center" />
                      <button onClick={() => removePriceColumn(pc.id)} className="text-red-300 hover:text-red-100 text-[10px]">✕ del</button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold">{pc.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheets.map((sheet, sheetIdx) => (
              <tr key={sheet.id} className={`align-top ${sheetIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                {/* BUYER */}
                <td className="border border-gray-400 px-2 py-1 font-semibold text-xs" colSpan={2} style={{ minWidth: '100px' }}>
                  <EC val={sheet.buyer} onChange={v => updateSheet(sheet.id, 'buyer', v)} />
                  {editMode && (
                    <select onChange={e => importRecipe(sheet.id, e.target.value)}
                      className="mt-1 w-full text-[10px] border border-gray-300 bg-white px-1 py-0.5 outline-none" defaultValue="">
                      <option value="">📋 Import recipe...</option>
                      {recipes.map(r => <option key={r.id} value={r.id}>{r.recipe_no}</option>)}
                    </select>
                  )}
                </td>
                {/* STYLE */}
                <td className="border border-gray-400 px-2 py-1 text-xs" style={{ minWidth: '110px' }}>
                  <EC val={sheet.style} onChange={v => updateSheet(sheet.id, 'style', v)} />
                </td>
                {/* ITEM */}
                <td className="border border-gray-400 px-2 py-1 text-center text-xs">
                  <EC val={sheet.item} onChange={v => updateSheet(sheet.id, 'item', v)} />
                </td>
                {/* SIZE */}
                <td className="border border-gray-400 px-2 py-1 text-center text-xs">
                  <EC val={sheet.size} onChange={v => updateSheet(sheet.id, 'size', v)} />
                </td>
                {/* COLOR */}
                <td className="border border-gray-400 px-2 py-1 text-center text-xs font-semibold">
                  <EC val={sheet.color} onChange={v => updateSheet(sheet.id, 'color', v)} />
                </td>
                {/* WASH PROCESS */}
                <td className="border border-gray-400 px-2 py-1 text-xs" style={{ maxWidth: '180px' }}>
                  <EC val={sheet.washProcess} onChange={v => updateSheet(sheet.id, 'washProcess', v)} rows={3} cls="italic" />
                  <div className="font-bold text-sm text-center mt-1 border-t border-gray-300 pt-1">
                    <EC val={sheet.washProcessCost.toFixed(2)} onChange={v => updateSheet(sheet.id, 'washProcessCost', parseFloat(v) || 0)} type="number" cls="font-bold text-sm" />
                  </div>
                </td>
                {/* DRY PROCESS COLUMNS */}
                {dryColumns.map((_, ci) => (
                  <td key={ci} className="border border-gray-400 px-1 py-1 text-center" style={{ minWidth: '72px' }}>
                    <EC val={(sheet.dryCosts[ci] || 0).toFixed(2)} onChange={v => updateDryCost(sheet.id, ci, parseFloat(v) || 0)} type="number" cls="font-bold text-sm text-center" />
                  </td>
                ))}
                {/* PICTURE — with camera capture */}
                <td className="border border-gray-400 px-1 py-1 text-center" style={{ width: '90px' }}>
                  {/* File input (upload from gallery) */}
                  <input type="file" accept="image/*" className="hidden"
                    ref={el => { fileInputRefs.current[sheet.id] = el }}
                    onChange={e => handlePhoto(sheet.id, e)} />
                  {/* Camera input (direct capture from mobile) */}
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    ref={el => { cameraInputRefs.current[sheet.id] = el }}
                    onChange={e => handleCameraCapture(sheet.id, e)} />

                  {sheet.photoUrl
                    ? <div className="relative group">
                        <img src={sheet.photoUrl} alt="Product"
                          className="max-h-20 max-w-full object-contain mx-auto cursor-pointer"
                          onClick={() => editMode && fileInputRefs.current[sheet.id]?.click()} />
                        {editMode && (
                          <button onClick={() => updateSheet(sheet.id, 'photoUrl', '')}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[8px] leading-none flex items-center justify-center">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    : <div className="h-16 flex flex-col items-center justify-center text-gray-400 text-[9px] border border-dashed border-gray-300 rounded">
                        {editMode && (
                          <div className="flex flex-col gap-1">
                            <button onClick={() => cameraInputRefs.current[sheet.id]?.click()}
                              className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[9px] text-gray-600">
                              <Camera className="w-3 h-3" /> Camera
                            </button>
                            <button onClick={() => fileInputRefs.current[sheet.id]?.click()}
                              className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[9px] text-gray-600">
                              Gallery
                            </button>
                          </div>
                        )}
                      </div>
                  }
                </td>
                {/* BEST PRICE PER DZN */}
                <td className="border border-gray-400 px-2 py-1 text-center align-middle font-bold">
                  <div className="text-lg">{sheetTotal(sheet).toFixed(2)}</div>
                  {editMode && (
                    <div className="flex gap-1 mt-1 justify-center no-print">
                      <button onClick={() => dupSheet(sheet.id)} title="Duplicate row"
                        className="text-[9px] px-1 py-0.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded border border-gray-400">
                        <Copy className="w-3 h-3 inline" /> Dup
                      </button>
                      {sheets.length > 1 && (
                        <button onClick={() => removeSheet(sheet.id)} title="Remove row"
                          className="text-[9px] px-1 py-0.5 bg-gray-200 hover:bg-gray-300 text-red-600 rounded border border-gray-400">
                          <Trash2 className="w-3 h-3 inline" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                {/* ADDITIONAL PRICE COLUMNS (user-input) */}
                {priceColumns.map(pc => (
                  <td key={pc.id} className="border border-gray-400 px-1 py-1 text-center align-middle">
                    <EC val={(sheet.priceInputs[pc.id] || 0).toFixed(2)}
                      onChange={v => updatePriceInput(sheet.id, pc.id, parseFloat(v) || 0)}
                      type="number" cls="font-bold text-sm text-center" />
                  </td>
                ))}
              </tr>
            ))}
            {/* TOTAL ROW */}
            <tr className="bg-gray-900 text-white font-bold">
              <td className="border border-gray-700 px-2 py-1.5 text-xs text-center" colSpan={6}>TOTAL</td>
              <td className="border border-gray-700 px-2 py-1.5 text-sm text-center">{washTotal.toFixed(2)}</td>
              {dryColumns.map((_, ci) => (
                <td key={ci} className="border border-gray-700 px-2 py-1.5 text-sm text-center">{colTotal(ci).toFixed(2)}</td>
              ))}
              <td className="border border-gray-700 px-2 py-1.5 text-xs text-center text-gray-400">—</td>
              <td className="border border-gray-700 px-2 py-1.5 text-sm text-center">{grandTotal.toFixed(2)}</td>
              {priceColumns.map(pc => (
                <td key={pc.id} className="border border-gray-700 px-2 py-1.5 text-sm text-center">
                  {priceColTotal(pc.id).toFixed(2)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        {/* Prepared by / footer */}
        <div className="flex justify-between items-end mt-6 px-2 pb-4">
          <div className="text-xs">
            {editMode
              ? <div className="flex items-center gap-2">
                  <span className="text-gray-500">Prepared by:</span>
                  <input value={preparedBy} onChange={e => setPreparedBy(e.target.value)}
                    className="border-b border-gray-400 px-1 bg-white outline-none text-xs font-semibold" />
                </div>
              : <span className="font-semibold text-gray-600">{preparedBy}</span>
            }
          </div>
        </div>
        </div>{/* end content wrapper */}
      </A4ReportLayout>
    </div>
  )
}
