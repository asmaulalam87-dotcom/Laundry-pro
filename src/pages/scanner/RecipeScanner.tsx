/**
 * Recipe Photo Scanner
 * 
 * Takes a photo or uploaded image of a chemical recipe (from paper, screen, Excel, PDF screenshot, etc.)
 * Uses Tesseract.js for client-side OCR to extract text
 * Then intelligently parses the text into structured recipe data matching our system format
 */

import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createWorker } from 'tesseract.js'
import { db } from '@/services/local-db'
import {
  Camera, Upload, FileText, Zap, ArrowRight, CheckCircle2,
  AlertCircle, Loader2, ImagePlus, RotateCcw, Save, Trash2, Plus, X
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ParsedStep {
  process_name: string
  temperature: number | null
  time_minutes: number | null
  rpm: number | null
  ph: string | null
  lr: string | null
  chemicals: { name: string; dosage: string; unit: string }[]
  remarks: string
}

interface ParsedRecipe {
  recipe_no: string
  customer_name: string
  factory_name: string
  style: string
  color: string
  wash_type: string
  batch_weight: number
  batch_quantity: number
  recipe_date: string
  steps: ParsedStep[]
  rawText: string
}

type ScanStage = 'idle' | 'uploading' | 'ocr' | 'parsing' | 'review' | 'saving'

// ── Known process names for matching ───────────────────────────────────────────

const KNOWN_PROCESSES = [
  'Desizing', 'Scouring', 'Bleaching', 'Washing', 'Rinsing', 'Rinse',
  'Dyeing', 'Dye', 'Neutralization', 'Neutralize', 'Neutral',
  'Bio-Polish', 'Bio Polish', 'Biopolish', 'Enzyme Wash', 'Enzyme',
  'Stone Wash', 'Acid Wash', 'Silicone Wash', 'Softener', 'Softening',
  'Soaping', 'Fixing', 'Fix', 'Pigment Dye', 'Reactive Dye',
  'Garment Dye', 'Overdye', 'Resin', 'Tinting', 'Hydro Extract',
  'Drying', 'Dry', 'Padding', 'Pad', 'Curing', 'Aging', 'Ozoning',
  'Laser', 'Sandblasting', 'Whisker', 'Destroy', 'Grinding',
  'PP Spray', 'Potassium', 'Chlorine', 'Anti-Chlor', 'Anti Chlor',
  'De-mineralize', 'Demineralize', 'Souring', 'Mercerizing',
  'Heat Setting', 'Calendaring', 'Compacting', 'Sponging',
]

const KNOWN_CHEMICALS = [
  'Alpha Amylase', 'Cellulase', 'Acid Cellulase', 'Neutral Cellulase',
  'Caustic Soda', 'Soda Ash', 'Sodium Bicarbonate', 'Baking Soda',
  'Acetic Acid', 'Formic Acid', 'Sulfuric Acid', 'Hydrochloric Acid',
  'Hydrogen Peroxide', 'H2O2', 'Sodium Hypochlorite', 'Bleaching Powder',
  'Sodium Bisulfite', 'Sodium Metabisulfite', 'Sodium Thiosulfate',
  'Detergent', 'Wetting Agent', 'Sequestering Agent', 'Stabilizer',
  'Dispersing Agent', 'Leveling Agent', 'Salt', 'Glauber Salt', 'Common Salt',
  'Cationic Softener', 'Silicone Softener', 'Micro Silicone', 'Anionic Softener',
  'Nonionic Softener', 'Softener Flakes',
  'Reactive Dye', 'Pigment', 'Pigment Binder', 'Pigment Color',
  'Fixing Agent', 'Fixing CDR', 'Cross Linker',
  'Soaping Agent', 'Washing Agent', 'Anti-Back Staining',
  'Resin', 'Catalyst', 'Magnesium Chloride', 'Urea',
  'Optical Brightener', 'OBA', 'Bluing Agent',
  'Anti-Foaming Agent', 'Defoamer', 'De-Foamer',
  'Enzyme', 'Pumice Stone', 'Ball Stone',
  'Chlorine', 'Potassium Permanganate', 'PP',
  'Ozone', 'Laser',
  'Anti-Chlor', 'Desizing Agent', 'Scouring Agent',
  'Penetrating Agent', 'Lubricating Agent', 'Anti Crease Agent',
]

// ── Smart Parser ───────────────────────────────────────────────────────────────

function parseOcrText(text: string): ParsedRecipe {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  const recipe: ParsedRecipe = {
    recipe_no: '',
    customer_name: '',
    factory_name: '',
    style: '',
    color: '',
    wash_type: '',
    batch_weight: 100,
    batch_quantity: 0,
    recipe_date: new Date().toISOString().split('T')[0],
    steps: [],
    rawText: text,
  }

  // ── Extract header info ──
  for (const line of lines) {
    const lower = line.toLowerCase()

    // Recipe number
    if (!recipe.recipe_no) {
      const recipeNoMatch = lower.match(/recipe\s*(?:no|#|number|code)?[\s:.-]*([a-z0-9\-\/]+)/i)
      if (recipeNoMatch && !lower.includes('recipe_type')) recipe.recipe_no = recipeNoMatch[1].toUpperCase()
    }

    // Customer
    if (!recipe.customer_name) {
      const custMatch = lower.match(/(?:customer|buyer|client)[\s:.-]+(.+)/i)
      if (custMatch) recipe.customer_name = custMatch[1].trim().substring(0, 60)
    }

    // Style
    if (!recipe.style) {
      const styleMatch = lower.match(/style[\s:.-]+(.+)/i)
      if (styleMatch) recipe.style = styleMatch[1].trim().substring(0, 60)
    }

    // Color
    if (!recipe.color) {
      const colorMatch = lower.match(/color|colour[\s:.-]+(.+)/i)
      if (colorMatch) recipe.color = colorMatch[1].trim().substring(0, 40)
    }

    // Wash Type
    if (!recipe.wash_type) {
      const washMatch = lower.match(/wash\s*type[\s:.-]+(.+)/i)
      if (washMatch) recipe.wash_type = washMatch[1].trim().substring(0, 80)
    }

    // Batch Weight
    if (lower.match(/batch\s*weight/i)) {
      const bwMatch = lower.match(/(\d+(?:\.\d+)?)\s*kg/i)
      if (bwMatch) recipe.batch_weight = parseFloat(bwMatch[1])
    }

    // Batch Quantity
    if (lower.match(/batch\s*(?:qty|quantity)/i)) {
      const bqMatch = lower.match(/(\d+)\s*(?:pcs|pieces|pc)?/i)
      if (bqMatch) recipe.batch_quantity = parseInt(bqMatch[1])
    }

    // Factory
    if (!recipe.factory_name) {
      const facMatch = lower.match(/(?:factory|plant|unit)[\s:.-]+(.+)/i)
      if (facMatch) recipe.factory_name = facMatch[1].trim().substring(0, 60)
    }

    // Date
    const dateMatch = lower.match(/date[\s:.-]+(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})/)
    if (dateMatch) recipe.recipe_date = dateMatch[1].replace(/\//g, '-')
  }

  // ── Extract process steps ──
  // Strategy: scan each line for process names, then gather subsequent lines for params + chemicals
  let currentStep: ParsedStep | null = null
  const processStepLines: number[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()

    // Check if this line contains a known process name
    let matchedProcess: string | null = null
    for (const proc of KNOWN_PROCESSES) {
      if (lowerLine.includes(proc.toLowerCase())) {
        matchedProcess = proc
        break
      }
    }

    // Also check for numbered steps like "1.", "2.", "Step 1:", "SL#", "S/N"
    const stepNumMatch = line.match(/^(?:step\s*)?(\d+)\s*[.):\-]\s*(.+)/i)
    const slMatch = line.match(/^(?:sl\s*#?|s\/n)\s*[.):\-]?\s*(.+)/i)

    if (matchedProcess || stepNumMatch || slMatch) {
      // Save previous step
      if (currentStep) recipe.steps.push(currentStep)

      let processName = matchedProcess || 'Process'
      if (stepNumMatch && !matchedProcess) {
        processName = stepNumMatch[2].trim()
      } else if (slMatch && !matchedProcess) {
        processName = slMatch[1].trim()
      }

      currentStep = {
        process_name: processName,
        temperature: null,
        time_minutes: null,
        rpm: null,
        ph: null,
        lr: null,
        chemicals: [],
        remarks: '',
      }
      processStepLines.push(i)
    }

    if (!currentStep) continue

    // ── Extract parameters from this line ──

    // Temperature
    const tempMatch = line.match(/(\d+)\s*°?\s*[cC]/)
    if (tempMatch) currentStep.temperature = parseInt(tempMatch[1])
    const tempWordMatch = line.match(/temp(?:erature)?[\s:.-]*(\d+)/i)
    if (tempWordMatch && !currentStep.temperature) currentStep.temperature = parseInt(tempWordMatch[1])

    // Time
    const timeMatch = line.match(/(\d+)\s*(?:min|minutes?|')/i)
    if (timeMatch) currentStep.time_minutes = parseInt(timeMatch[1])
    const timeWordMatch = line.match(/time[\s:.-]*(\d+)/i)
    if (timeWordMatch && !currentStep.time_minutes) currentStep.time_minutes = parseInt(timeWordMatch[1])

    // RPM
    const rpmMatch = line.match(/(\d+)\s*(?:rpm|r\.p\.m)/i)
    if (rpmMatch) currentStep.rpm = parseInt(rpmMatch[1])

    // pH
    const phMatch = line.match(/ph[\s:.-]*([\d.]+(?:\s*[-–]\s*[\d.]+)?)/i)
    if (phMatch) currentStep.ph = phMatch[1]

    // LR (Liquor Ratio)
    const lrMatch = line.match(/lr[\s:.-]*(\d+\s*:\s*\d+)/i)
    if (lrMatch) currentStep.lr = lrMatch[1].replace(/\s/g, '')

    // ── Extract chemicals from this line ──
    for (const chem of KNOWN_CHEMICALS) {
      if (lowerLine.includes(chem.toLowerCase())) {
        // Try to find dosage near the chemical name
        const chemIdx = lowerLine.indexOf(chem.toLowerCase())
        const afterChem = line.substring(chemIdx + chem.length)

        // Match patterns like "2 g/l", "1.5 g/kg", "3%", "0.5 ml/l", "5 kg"
        const dosageMatch = afterChem.match(/[\s:.-]*(\d+(?:\.\d+)?)\s*(g\/l|g\/kg|ml\/l|ml\/kg|kg|%|g|ml|pcs)/i)

        currentStep.chemicals.push({
          name: chem,
          dosage: dosageMatch ? dosageMatch[1] : '',
          unit: dosageMatch ? dosageMatch[2].toLowerCase() : 'g/l',
        })
      }
    }

    // Also try generic chemical pattern: "Some Name  2.5 g/l"
    const genericChemMatch = line.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(\d+(?:\.\d+)?)\s*(g\/l|g\/kg|ml\/l|ml\/kg|kg|%|g|ml)/)
    if (genericChemMatch) {
      const chemName = genericChemMatch[1]
      // Only add if not already found via known chemicals
      if (!currentStep.chemicals.some(c => c.name === chemName)) {
        currentStep.chemicals.push({
          name: chemName,
          dosage: genericChemMatch[2],
          unit: genericChemMatch[3].toLowerCase(),
        })
      }
    }
  }

  // Push the last step
  if (currentStep) recipe.steps.push(currentStep)

  // If no steps found, try a simpler line-by-line parse
  if (recipe.steps.length === 0) {
    for (const line of lines) {
      const lower = line.toLowerCase()
      // Look for lines that look like data rows (contain numbers)
      if (line.match(/\d/) && line.length > 5 && line.length < 200) {
        // Try to parse as a step row
        const step: ParsedStep = {
          process_name: line.substring(0, 30).replace(/[0-9.:;\-]/g, '').trim() || 'Process',
          temperature: null,
          time_minutes: null,
          rpm: null,
          ph: null,
          lr: null,
          chemicals: [],
          remarks: '',
        }

        const tempM = line.match(/(\d+)\s*°?\s*[cC]/)
        if (tempM) step.temperature = parseInt(tempM[1])

        const timeM = line.match(/(\d+)\s*(?:min|')/i)
        if (timeM) step.time_minutes = parseInt(timeM[1])

        recipe.steps.push(step)
      }
    }
  }

  // Ensure minimum recipe_no
  if (!recipe.recipe_no) {
    recipe.recipe_no = `RCP-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
  }
  if (!recipe.customer_name) recipe.customer_name = 'Unknown Customer'
  if (!recipe.style) recipe.style = 'N/A'
  if (!recipe.color) recipe.color = 'N/A'
  if (!recipe.wash_type && recipe.steps.length > 0) {
    recipe.wash_type = recipe.steps.map(s => s.process_name).join('+')
  }
  if (!recipe.wash_type) recipe.wash_type = 'General Wash'
  if (!recipe.factory_name) recipe.factory_name = ''

  return recipe
}

// ═══════════════════════════════════════════════════════════════════════════════
// RecipeScanner Component
// ═══════════════════════════════════════════════════════════════════════════════

export const RecipeScanner = () => {
  const navigate = useNavigate()
  const [stage, setStage] = useState<ScanStage>('idle')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrText, setOcrText] = useState('')
  const [parsedRecipe, setParsedRecipe] = useState<ParsedRecipe | null>(null)
  const [editingStep, setEditingStep] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // ── Handle image selection ──────────────────────────────────────────────────
  const handleImageSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)

    // Run OCR
    setStage('ocr')
    setOcrProgress(0)
    try {
      const worker = await createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100))
          }
        },
      })

      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()

      setOcrText(text)
      setStage('parsing')

      // Parse the OCR text
      const parsed = parseOcrText(text)
      setParsedRecipe(parsed)
      setStage('review')

      if (parsed.steps.length > 0) {
        toast.success(`Detected ${parsed.steps.length} process steps with ${parsed.steps.reduce((s, st) => s + st.chemicals.length, 0)} chemicals`)
      } else {
        toast.warning('No process steps detected. You can manually add steps below.')
      }
    } catch (err: any) {
      console.error('[OCR Error]', err)
      toast.error('OCR failed: ' + (err?.message || 'Unknown error'))
      setStage('idle')
    }
  }, [])

  // ── File input handlers ─────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageSelect(file)
  }

  // ── Update parsed recipe field ──────────────────────────────────────────────
  const updateField = (field: keyof ParsedRecipe, value: any) => {
    if (!parsedRecipe) return
    setParsedRecipe({ ...parsedRecipe, [field]: value })
  }

  const updateStep = (idx: number, field: keyof ParsedStep, value: any) => {
    if (!parsedRecipe) return
    const steps = [...parsedRecipe.steps]
    steps[idx] = { ...steps[idx], [field]: value }
    setParsedRecipe({ ...parsedRecipe, steps })
  }

  const addStep = () => {
    if (!parsedRecipe) return
    setParsedRecipe({
      ...parsedRecipe,
      steps: [...parsedRecipe.steps, {
        process_name: 'New Step',
        temperature: null,
        time_minutes: null,
        rpm: null,
        ph: null,
        lr: null,
        chemicals: [],
        remarks: '',
      }],
    })
  }

  const removeStep = (idx: number) => {
    if (!parsedRecipe) return
    setParsedRecipe({ ...parsedRecipe, steps: parsedRecipe.steps.filter((_, i) => i !== idx) })
  }

  const addChemicalToStep = (stepIdx: number) => {
    if (!parsedRecipe) return
    const steps = [...parsedRecipe.steps]
    steps[stepIdx].chemicals.push({ name: '', dosage: '', unit: 'g/l' })
    setParsedRecipe({ ...parsedRecipe, steps })
  }

  const updateChemicalInStep = (stepIdx: number, chemIdx: number, field: string, value: string) => {
    if (!parsedRecipe) return
    const steps = [...parsedRecipe.steps]
    steps[stepIdx].chemicals[chemIdx] = { ...steps[stepIdx].chemicals[chemIdx], [field]: value }
    setParsedRecipe({ ...parsedRecipe, steps })
  }

  const removeChemicalFromStep = (stepIdx: number, chemIdx: number) => {
    if (!parsedRecipe) return
    const steps = [...parsedRecipe.steps]
    steps[stepIdx].chemicals = steps[stepIdx].chemicals.filter((_, i) => i !== chemIdx)
    setParsedRecipe({ ...parsedRecipe, steps })
  }

  // ── Save as recipe in the system ────────────────────────────────────────────
  const saveAsRecipe = async () => {
    if (!parsedRecipe) return
    setStage('saving')

    try {
      const recipeId = `recipe-${Date.now()}`
      const now = new Date().toISOString()

      // Create recipe record
      const recipe = {
        id: recipeId,
        recipe_no: parsedRecipe.recipe_no,
        customer_name: parsedRecipe.customer_name,
        factory_name: parsedRecipe.factory_name,
        style: parsedRecipe.style,
        color: parsedRecipe.color,
        wash_type: parsedRecipe.wash_type,
        recipe_type: 'Original' as const,
        status: 'Draft' as const,
        batch_weight: parsedRecipe.batch_weight,
        batch_quantity: parsedRecipe.batch_quantity,
        recipe_date: parsedRecipe.recipe_date,
        created_at: now,
        updated_at: now,
        created_by: 'ocr-import',
      }

      await db.recipes.add(recipe)

      // Create step + chemical records
      for (let i = 0; i < parsedRecipe.steps.length; i++) {
        const step = parsedRecipe.steps[i]
        const stepId = `step-${Date.now()}-${i}`

        await db.recipe_steps.add({
          id: stepId,
          recipe_id: recipeId,
          step_order: i + 1,
          process_name: step.process_name,
          temperature: step.temperature || undefined,
          time_minutes: step.time_minutes || undefined,
          rpm: step.rpm || undefined,
          ph: step.ph || undefined,
          ltr: step.lr || undefined,
          remarks: step.remarks || undefined,
        })

        for (let j = 0; j < step.chemicals.length; j++) {
          const chem = step.chemicals[j]
          await db.recipe_step_chemicals.add({
            id: `chem-${Date.now()}-${i}-${j}`,
            recipe_step_id: stepId,
            recipe_id: recipeId,
            chemical_name: chem.name,
            dosage: chem.dosage ? parseFloat(chem.dosage) : undefined,
            unit: (chem.unit as any) || 'g/l',
          })
        }
      }

      toast.success(`Recipe "${parsedRecipe.recipe_no}" saved with ${parsedRecipe.steps.length} steps!`)
      navigate(`/recipes/builder?id=${recipeId}`)
    } catch (err: any) {
      toast.error('Save failed: ' + (err?.message || 'Unknown error'))
      setStage('review')
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  const resetScanner = () => {
    setStage('idle')
    setImagePreview(null)
    setOcrText('')
    setOcrProgress(0)
    setParsedRecipe(null)
    setEditingStep(null)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Camera className="w-8 h-8 text-indigo-500" />
          Photo Recipe Scanner
        </h1>
        <p className="text-muted-foreground mt-1">
          Take a photo or upload an image of any chemical recipe — from paper, screen, Excel, PDF — and auto-convert it to system format.
        </p>
      </div>

      {/* ── STAGE: Idle — Upload prompt ──────────────────────────────────────── */}
      {stage === 'idle' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload area */}
          <div className="bg-card border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center min-h-[350px] hover:border-indigo-500/50 transition-colors">
            <ImagePlus className="w-20 h-20 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-1">Upload Recipe Image</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
              Support for photos of paper recipes, screenshots of Excel/PDF, scanned documents, or any image containing recipe data
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Image
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors"
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Supported formats */}
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {['Paper Recipe', 'Excel Screenshot', 'PDF Print', 'Handwritten', 'Whiteboard', 'Email'].map(fmt => (
                <span key={fmt} className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                  {fmt}
                </span>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold">How It Works</h3>
            <div className="space-y-3">
              {[
                { icon: Upload, title: '1. Upload Image', desc: 'Take a photo or upload any image of a chemical recipe' },
                { icon: FileText, title: '2. OCR Extraction', desc: 'Tesseract.js extracts text from the image (100% offline)' },
                { icon: Zap, title: '3. Smart Parsing', desc: 'AI parser identifies process steps, chemicals, dosages, temperatures' },
                { icon: CheckCircle2, title: '4. Review & Edit', desc: 'Review the extracted data, fix any errors, add missing info' },
                { icon: Save, title: '5. Save to System', desc: 'One click saves as a properly formatted recipe in your database' },
              ].map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <step.icon className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE: OCR Processing ────────────────────────────────────────────── */}
      {(stage === 'ocr' || stage === 'parsing') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image preview */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {imagePreview && (
              <img src={imagePreview} alt="Scanned recipe" className="w-full object-contain max-h-[500px]" />
            )}
          </div>

          {/* Progress */}
          <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center">
            <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {stage === 'ocr' ? 'Extracting Text...' : 'Parsing Recipe Data...'}
            </h3>
            {stage === 'ocr' && (
              <>
                <div className="w-full max-w-xs bg-muted rounded-full h-3 mb-2">
                  <div
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{ocrProgress}% complete</p>
              </>
            )}
            {stage === 'parsing' && (
              <p className="text-sm text-muted-foreground">Analyzing text structure and identifying recipe components...</p>
            )}
          </div>
        </div>
      )}

      {/* ── STAGE: Review & Edit ──────────────────────────────────────────────── */}
      {(stage === 'review' || stage === 'saving') && parsedRecipe && (
        <div className="space-y-4">
          {/* Header with actions */}
          <div className="flex items-center justify-between bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div>
                <h3 className="font-semibold">Recipe Extracted</h3>
                <p className="text-xs text-muted-foreground">
                  {parsedRecipe.steps.length} process steps &middot; {parsedRecipe.steps.reduce((s, st) => s + st.chemicals.length, 0)} chemicals detected
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={resetScanner} className="flex items-center gap-1 px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-lg text-xs font-medium">
                <RotateCcw className="w-3.5 h-3.5" /> Rescan
              </button>
              <button
                onClick={saveAsRecipe}
                disabled={stage === 'saving'}
                className="flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
              >
                {stage === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save as Recipe
              </button>
            </div>
          </div>

          {/* Recipe Header Info */}
          <div className="bg-card border border-border rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">Recipe Information</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Recipe No', key: 'recipe_no' as const },
                { label: 'Customer', key: 'customer_name' as const },
                { label: 'Style', key: 'style' as const },
                { label: 'Color', key: 'color' as const },
                { label: 'Wash Type', key: 'wash_type' as const },
                { label: 'Factory', key: 'factory_name' as const },
                { label: 'Batch Weight (KG)', key: 'batch_weight' as const },
                { label: 'Batch Qty', key: 'batch_quantity' as const },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">{field.label}</label>
                  <input
                    type={field.key === 'batch_weight' || field.key === 'batch_quantity' ? 'number' : 'text'}
                    value={(parsedRecipe as any)[field.key]}
                    onChange={e => updateField(field.key, field.key === 'batch_weight' || field.key === 'batch_quantity' ? Number(e.target.value) : e.target.value)}
                    className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Process Steps */}
          {parsedRecipe.steps.map((step, idx) => (
            <div key={idx} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Step header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30"
                onClick={() => setEditingStep(editingStep === idx ? null : idx)}
              >
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {idx + 1}
                </span>
                <span className="font-semibold text-sm flex-1">{step.process_name}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {step.temperature && <span>{step.temperature}°C</span>}
                  {step.time_minutes && <span>{step.time_minutes}min</span>}
                  {step.rpm && <span>{step.rpm}RPM</span>}
                  {step.ph && <span>pH:{step.ph}</span>}
                  {step.chemicals.length > 0 && <span className="text-indigo-400">{step.chemicals.length} chems</span>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeStep(idx) }} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Step detail (expanded) */}
              {editingStep === idx && (
                <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="col-span-2 md:col-span-1">
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Process Name</label>
                      <input
                        type="text"
                        value={step.process_name}
                        onChange={e => updateStep(idx, 'process_name', e.target.value)}
                        className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Temp (°C)</label>
                      <input
                        type="number"
                        value={step.temperature ?? ''}
                        onChange={e => updateStep(idx, 'temperature', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Time (min)</label>
                      <input
                        type="number"
                        value={step.time_minutes ?? ''}
                        onChange={e => updateStep(idx, 'time_minutes', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">RPM</label>
                      <input
                        type="number"
                        value={step.rpm ?? ''}
                        onChange={e => updateStep(idx, 'rpm', e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">pH</label>
                      <input
                        type="text"
                        value={step.ph ?? ''}
                        onChange={e => updateStep(idx, 'ph', e.target.value || null)}
                        className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Chemicals */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Chemicals</span>
                      <button onClick={() => addChemicalToStep(idx)} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    {step.chemicals.map((chem, chemIdx) => (
                      <div key={chemIdx} className="flex items-center gap-2 mb-1.5">
                        <input
                          type="text"
                          value={chem.name}
                          onChange={e => updateChemicalInStep(idx, chemIdx, 'name', e.target.value)}
                          placeholder="Chemical name"
                          className="flex-[2] px-2 py-1 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="text"
                          value={chem.dosage}
                          onChange={e => updateChemicalInStep(idx, chemIdx, 'dosage', e.target.value)}
                          placeholder="Dosage"
                          className="w-20 px-2 py-1 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <select
                          value={chem.unit}
                          onChange={e => updateChemicalInStep(idx, chemIdx, 'unit', e.target.value)}
                          className="w-20 px-2 py-1 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="g/l">g/l</option>
                          <option value="g/kg">g/kg</option>
                          <option value="ml/l">ml/l</option>
                          <option value="ml/kg">ml/kg</option>
                          <option value="%">%</option>
                          <option value="kg">kg</option>
                        </select>
                        <button onClick={() => removeChemicalFromStep(idx, chemIdx)} className="text-red-400 hover:text-red-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {step.chemicals.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No chemicals detected. Click "Add" to manually add.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add step button */}
          <button onClick={addStep} className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-lg text-sm text-muted-foreground hover:border-indigo-500/50 hover:text-indigo-400 transition-colors">
            <Plus className="w-4 h-4" /> Add Process Step
          </button>

          {/* Raw OCR Text (collapsible) */}
          <details className="bg-card border border-border rounded-lg">
            <summary className="p-3 text-sm font-medium cursor-pointer hover:bg-muted/30 rounded-lg">
              View Raw OCR Text ({ocrText.length} characters)
            </summary>
            <pre className="p-3 text-xs text-muted-foreground overflow-auto max-h-60 whitespace-pre-wrap border-t border-border">
              {ocrText}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
