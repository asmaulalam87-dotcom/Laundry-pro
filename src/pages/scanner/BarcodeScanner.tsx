import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { db } from '@/services/local-db'
import { ScanLine, Camera, X, Search, ArrowRight, QrCode, Keyboard, Trash2, FlaskConical, FileText, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface ScanResult {
  type: 'recipe_no' | 'style' | 'customer' | 'qr_data' | 'chemical'
  value: string
  recipeId?: string
  recipeNo?: string
  timestamp?: string
}

export const BarcodeScanner = () => {
  const navigate = useNavigate()
  const [scanning, setScanning] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [recentScans, setRecentScans] = useState<ScanResult[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [scanMode, setScanMode] = useState<'recipe' | 'chemical'>('recipe')
  const [chemicalResults, setChemicalResults] = useState<any[]>([])
  const scannerRef = useRef<Html5Qrcode | null>(null)

  // Load recent scans from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_scans')
      if (saved) setRecentScans(JSON.parse(saved))
    } catch {}
  }, [])

  const saveRecentScan = (scan: ScanResult) => {
    const updated = [{ ...scan, timestamp: new Date().toISOString() }, ...recentScans.filter(s => s.value !== scan.value)].slice(0, 20)
    setRecentScans(updated)
    localStorage.setItem('recent_scans', JSON.stringify(updated))
  }

  // Start camera scanner
  const startScanning = async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanResult(decodedText)
          stopScanning()
        },
        () => {} // ignore errors during scanning
      )
      setScanning(true)
    } catch (err: any) {
      toast.error('Camera access failed: ' + (err?.message || 'Unknown error'))
    }
  }

  const stopScanning = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      }
    } catch {}
    scannerRef.current = null
    setScanning(false)
  }

  // Process scanned data
  const handleScanResult = async (data: string) => {
    toast.success('Scanned: ' + data.substring(0, 50))
    
    if (scanMode === 'chemical') {
      saveRecentScan({ type: 'chemical', value: data })
      await searchChemicalByValue(data)
      return
    }

    let scanResult: ScanResult = { type: 'qr_data', value: data }
    try {
      const parsed = JSON.parse(data)
      if (parsed.doc || parsed.title) {
        scanResult = { type: 'qr_data', value: data, recipeNo: parsed.doc }
      }
    } catch {
      scanResult = { type: 'recipe_no', value: data }
    }

    saveRecentScan(scanResult)
    await searchByValue(data)
  }

  // Search recipes by scanned value or manual input
  const searchByValue = async (value: string) => {
    if (!value.trim()) return
    setSearching(true)
    try {
      const allRecipes = await db.recipes.toArray()
      const lowerVal = value.toLowerCase().trim()
      const matches = allRecipes.filter(r =>
        r.recipe_no?.toLowerCase().includes(lowerVal) ||
        r.style?.toLowerCase().includes(lowerVal) ||
        r.customer_name?.toLowerCase().includes(lowerVal) ||
        r.wash_type?.toLowerCase().includes(lowerVal) ||
        r.color?.toLowerCase().includes(lowerVal) ||
        r.factory_name?.toLowerCase().includes(lowerVal)
      )
      setSearchResults(matches)
      if (matches.length === 0) {
        toast.warning('No matching recipe found')
      } else {
        toast.success(`Found ${matches.length} recipe(s)`)
      }
    } catch (err) {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleManualSearch = () => {
    if (manualInput.trim()) {
      const type = scanMode === 'chemical' ? 'chemical' : 'recipe_no'
      saveRecentScan({ type: type as any, value: manualInput.trim() })
      if (scanMode === 'chemical') {
        searchChemicalByValue(manualInput.trim())
      } else {
        searchByValue(manualInput.trim())
      }
    }
  }

  // Search chemicals
  const searchChemicalByValue = async (value: string) => {
    if (!value.trim()) return
    setSearching(true)
    try {
      const allChemicals = await db.chemicals.toArray()
      const lowerVal = value.toLowerCase().trim()
      const matches = allChemicals.filter(c =>
        c.name?.toLowerCase().includes(lowerVal) ||
        c.category?.toLowerCase().includes(lowerVal) ||
        c.supplier?.toLowerCase().includes(lowerVal)
      )
      setChemicalResults(matches)
      if (matches.length === 0) toast.warning('No matching chemical found')
      else toast.success(`Found ${matches.length} chemical(s)`)
    } catch { toast.error('Search failed') }
    finally { setSearching(false) }
  }

  const goToRecipe = (recipeId: string) => {
    navigate(`/recipes/builder?id=${recipeId}`)
  }

  const clearHistory = () => {
    setRecentScans([])
    localStorage.removeItem('recent_scans')
    toast.success('Scan history cleared')
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanning() }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ScanLine className="w-8 h-8 text-indigo-500" />
            Barcode / QR Scanner
          </h1>
          <p className="text-muted-foreground mt-1">
            Scan a barcode or QR code to instantly load a recipe or chemical. Works offline with local data.
          </p>
        </div>
        {/* Scan mode toggle */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          <button onClick={() => { setScanMode('recipe'); setSearchResults([]); setChemicalResults([]) }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${scanMode === 'recipe' ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
            <FileText className="w-3.5 h-3.5" /> Recipe
          </button>
          <button onClick={() => { setScanMode('chemical'); setSearchResults([]); setChemicalResults([]) }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${scanMode === 'chemical' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
            <FlaskConical className="w-3.5 h-3.5" /> Chemical
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Scanner Panel ──────────────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Camera Scanner
          </h2>

          {/* Scanner viewport */}
          <div
            id="qr-reader"
            className={`w-full rounded-lg overflow-hidden border-2 border-dashed ${
              scanning ? 'border-indigo-500' : 'border-border'
            }`}
            style={{ minHeight: scanning ? 300 : 200 }}
          >
            {!scanning && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <QrCode className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-sm">Click "Start Scanner" to begin</p>
                <p className="text-xs mt-1">Supports QR codes, barcodes, and data matrices</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!scanning ? (
              <button
                onClick={startScanning}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
              >
                <Camera className="w-4 h-4" />
                Start Scanner
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
              >
                <X className="w-4 h-4" />
                Stop Scanner
              </button>
            )}
          </div>

          {/* Manual input */}
          <div className="pt-2 border-t border-border">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4" />
              Manual Search
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={scanMode === 'chemical' ? 'Enter chemical name, category, supplier…' : 'Enter recipe no, style, customer, wash type…'}
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
                className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleManualSearch}
                disabled={searching}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Recent scans */}
          {recentScans.length > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Scan History
                </h3>
                <button onClick={clearHistory} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {recentScans.map((scan, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (scan.type === 'chemical') searchChemicalByValue(scan.value)
                      else searchByValue(scan.value)
                    }}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={`shrink-0 ${scan.type === 'chemical' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                        {scan.type === 'chemical' ? <FlaskConical className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      </span>
                      <span className="truncate">{scan.value}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {scan.timestamp ? new Date(scan.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* -- Results Panel -- */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Search className="w-5 h-5" />
            {scanMode === 'chemical' ? 'Chemical Results' : 'Search Results'}
            {(scanMode === 'chemical' ? chemicalResults.length : searchResults.length) > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold">
                {scanMode === 'chemical' ? chemicalResults.length : searchResults.length}
              </span>
            )}
          </h2>

          {searching && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          )}

          {/* Chemical results */}
          {scanMode === 'chemical' && !searching && chemicalResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FlaskConical className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No chemicals found</p>
              <p className="text-xs mt-1">Scan a barcode or search by name/category/supplier</p>
            </div>
          )}
          {scanMode === 'chemical' && !searching && chemicalResults.map(chem => (
            <div key={chem.id}
              className="flex items-center gap-4 p-3 bg-muted/50 border border-border rounded-lg hover:border-emerald-500/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-2">
                  {chem.name}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold">{chem.category}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Stock: {chem.current_stock} {chem.unit} · Supplier: {chem.supplier || 'N/A'}
                </div>
              </div>
              <button onClick={() => navigate('/chemicals')}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold">
                View <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Recipe results */}
          {scanMode === 'recipe' && !searching && searchResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ScanLine className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No results yet</p>
              <p className="text-xs mt-1">Scan a code or search manually to find recipes</p>
            </div>
          )}
          {scanMode === 'recipe' && !searching && searchResults.map(recipe => (
            <div
              key={recipe.id}
              className="flex items-center gap-4 p-3 bg-muted/50 border border-border rounded-lg hover:border-indigo-500/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{recipe.recipe_no}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    recipe.status === 'Approved' ? 'bg-green-500/10 text-green-400' :
                    recipe.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400' :
                    recipe.status === 'Draft' ? 'bg-gray-500/10 text-gray-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {recipe.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {recipe.customer_name} · {recipe.style} · {recipe.wash_type}
                </div>
                <div className="text-xs text-muted-foreground">
                  {recipe.color} · {recipe.factory_name} · {recipe.recipe_date}
                </div>
              </div>
              <button
                onClick={() => goToRecipe(recipe.id)}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Open <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
