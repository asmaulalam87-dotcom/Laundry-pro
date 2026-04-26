import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Save, Plus, Trash2, ArrowLeft, Download, Copy, Printer, QrCode, Camera, Share2, FileText, Image, Wand2, Eye, BookOpen } from 'lucide-react'
import { LocalDB } from '@/services/local-db'
import { logAudit } from '@/services/audit-logger'
import { generateQRCode, printRecipe, shareViaWhatsApp, shareViaEmail, exportAsJSON, handlePhotoUpload, simulateOCR, exportToPDF } from '@/services/export-services'
import type { Recipe, RecipeStep, RecipeStepChemical, Chemical, Process } from '@/types'
import { toast } from 'sonner'

export const RecipeBuilder = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recipeId = searchParams.get('id')
  const cloneId = searchParams.get('cloneId')

  const [loading, setLoading] = useState(false)
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [processes, setProcesses] = useState<Process[]>([])
  
  const [recipe, setRecipe] = useState<Partial<Recipe>>({
    recipe_no: '',
    recipe_ref: '',
    customer_name: '',
    factory_name: '',
    style: '',
    color: '',
    wash_type: '',
    recipe_type: 'Original',
    status: 'Draft',
    batch_weight: 100,
    batch_quantity: 0,
    order_quantity: 0,
    po: '',
    ob_no: '',
    item: '',
    machine_type: '',
    recipe_stage: 'Sample',
    recipe_version: '1.0',
    recipe_time: 0,
    total_water: 0,
    cost_batch: 0,
    cost_pc: 0,
    recipe_date: new Date().toISOString().split('T')[0],
    remarks: '',
    created_by: '',
  })

  const [steps, setSteps] = useState<RecipeStep[]>([])
  const [searchProcess, setSearchProcess] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [showOCRModal, setShowOCRModal] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const printContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
    if (recipeId) loadRecipe(recipeId)
    if (cloneId) loadRecipeForClone(cloneId)
    
    // Load from template
    const fromTemplate = searchParams.get('from_template')
    if (fromTemplate) {
      const raw = localStorage.getItem('recipe_template_to_load')
      if (raw) {
        try {
          const tmpl = JSON.parse(raw)
          loadFromTemplate(tmpl)
          localStorage.removeItem('recipe_template_to_load')
        } catch {}
      }
    }
    
    // Auto-generate recipe number and ref
    if (!recipeId && !recipe.recipe_no) {
      const today = new Date()
      const recipeNo = `REC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
      setRecipe(prev => ({ ...prev, recipe_no: recipeNo }))
    }
  }, [recipeId, cloneId]) // eslint-disable-line

  // Auto-generate recipe ref when customer, style, or color changes
  useEffect(() => {
    if (recipe.customer_name && recipe.style && recipe.color) {
      const ref = `${recipe.customer_name.substring(0, 3).toUpperCase()}/${recipe.style.substring(0, 5).toUpperCase()}/${recipe.color.substring(0, 3).toUpperCase()}`
      setRecipe(prev => ({ ...prev, recipe_ref: ref }))
    }
  }, [recipe.customer_name, recipe.style, recipe.color])

  // Auto-calculate recipe time and total water
  useEffect(() => {
    const totalTime = steps.reduce((sum, step) => sum + (step.time_minutes || 0) + (step.non_op_time || 0), 0)
    const totalWater = steps.reduce((sum, step) => sum + (step.water_liters || 0), 0)
    setRecipe(prev => ({
      ...prev,
      recipe_time: totalTime,
      total_water: totalWater
    }))
  }, [steps])

  const loadData = async () => {
    const chemData = await LocalDB.getAll<Chemical>('chemicals')
    const procData = await LocalDB.getAll<Process>('processes')
    setChemicals(chemData)
    setProcesses(procData)
  }

  const loadRecipe = async (id: string) => {
    setLoading(true)
    try {
      const recipeData = await LocalDB.getById<Recipe>('recipes', id)
      if (recipeData) {
        setRecipe(recipeData)
        const recipeSteps = await LocalDB.getByIndex<RecipeStep>('recipe_steps', 'recipe_id', id)
        setSteps(recipeSteps.sort((a, b) => a.step_order - b.step_order))
      }
    } catch (error) {
      toast.error('Failed to load recipe')
    } finally {
      setLoading(false)
    }
  }

  const loadRecipeForClone = async (id: string) => {
    setLoading(true)
    try {
      const recipeData = await LocalDB.getById<Recipe>('recipes', id)
      if (recipeData) {
        const { id: _, recipe_no, ...rest } = recipeData
        setRecipe({ ...rest, recipe_no: '', status: 'Draft' })
        const recipeSteps = await LocalDB.getByIndex<RecipeStep>('recipe_steps', 'recipe_id', id)
        setSteps(recipeSteps.sort((a, b) => a.step_order - b.step_order).map(s => ({ 
          ...s, 
          id: undefined,
          chemicals: [] 
        } as any)))
        toast.info('Recipe cloned - edit and save as new')
      }
    } catch (error) {
      toast.error('Failed to clone recipe')
    } finally {
      setLoading(false)
    }
  }

  const addProcessToWorkflow = (process: Process) => {
    const newStep: RecipeStep = {
      id: crypto.randomUUID(),
      recipe_id: recipe.id || '',
      step_order: steps.length + 1,
      process_name: process.name,
      temperature: process.default_temperature || 60,
      time_minutes: process.default_time || 30,
      ltr: process.default_lr || '1:10',
      chemical_dosage: 0,
      water_liters: 0,
      rpm: process.default_rpm || 0,
      ph: process.default_ph || '',
      step_weight: recipe.batch_weight || 0,
      step_qty: recipe.batch_quantity || 0,
      chemicals: [],
    }
    setSteps([...steps, newStep])
  }

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= steps.length) return
    const updated = [...steps]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    // keep step_order in sync
    updated.forEach((s, i) => { s.step_order = i + 1 })
    setSteps(updated)
  }

  const updateStep = (index: number, field: keyof RecipeStep, value: any) => {
    const updated = [...steps]
    updated[index] = { ...updated[index], [field]: value }
    
    // Auto-calculate water liters when LTR, batch weight, or step weight changes
    if (field === 'ltr' || field === 'step_weight') {
      const stepWeight = value || updated[index].step_weight || recipe.batch_weight || 100
      const ltrRatio = updated[index].ltr || '1:10'
      const ratio = parseFloat(ltrRatio.split(':')[1] || '10')
      updated[index].water_liters = stepWeight * ratio
    }
    
    // Recalculate water if batch weight changes
    if (field === 'ltr') {
      const stepWeight = updated[index].step_weight || recipe.batch_weight || 100
      const ltrRatio = value || '1:10'
      const ratio = parseFloat(ltrRatio.split(':')[1] || '10')
      updated[index].water_liters = stepWeight * ratio
    }
    
    setSteps(updated)
  }

  const addChemicalToStep = (stepIndex: number) => {
    const updated = [...steps]
    if (!updated[stepIndex].chemicals) {
      updated[stepIndex].chemicals = []
    }
    updated[stepIndex].chemicals!.push({
      id: crypto.randomUUID(),
      chemical_id: '',
      chemical_name: '',
      dosage_g_per_kg: 0,
      qty_grams: 0,
    })
    setSteps(updated)
  }

  const updateStepChemical = (stepIndex: number, chemIndex: number, field: string, value: any) => {
    const updated = [...steps]
    const chem = updated[stepIndex].chemicals![chemIndex]
    ;(chem as any)[field] = value
    
    // Auto-calculate quantity based on unit
    if (field === 'dosage_g_per_kg' || field === 'dosage' || field === 'unit' || field === 'chemical_id') {
      const step = updated[stepIndex]
      const stepWeight = step.step_weight || recipe.batch_weight || 100
      const stepWater = step.water_liters || 0
      
      // Calculate based on unit
      if (chem.unit === 'g/kg' || chem.unit === 'ml/kg') {
        chem.qty_grams = ((chem.dosage_g_per_kg || 0) * stepWeight) / 1000
      } else if (chem.unit === 'g/l' || chem.unit === 'ml/l') {
        chem.qty_grams = ((chem.dosage || 0) * stepWater) / 1000
      } else if (chem.unit === '%') {
        chem.qty_grams = ((chem.dosage || 0) / 100) * stepWeight
      }
      
      if (field === 'chemical_id') {
        const selectedChem = chemicals.find(c => c.id === value)
        if (selectedChem) chem.chemical_name = selectedChem.name
      }
    }
    
    setSteps(updated)
  }

  const removeChemicalFromStep = (stepIndex: number, chemIndex: number) => {
    const updated = [...steps]
    updated[stepIndex].chemicals!.splice(chemIndex, 1)
    setSteps(updated)
  }

  const handleSave = async () => {
    if (!recipe.recipe_no || !recipe.customer_name) {
      toast.error('Please fill in Recipe No and Customer Name')
      return
    }

    setLoading(true)
    try {
      const recipeData = {
        ...recipe,
        id: recipe.id || crypto.randomUUID(),
        created_at: recipe.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Recipe

      if (recipe.id) {
        await LocalDB.update('recipes', recipeData)
        await logAudit({ table_name: 'recipes', record_id: recipeData.id, action: 'UPDATE', new_data: recipeData })
      } else {
        await LocalDB.add('recipes', recipeData)
        await logAudit({ table_name: 'recipes', record_id: recipeData.id, action: 'INSERT', new_data: recipeData })
      }

      // Save steps and chemicals
      for (const step of steps) {
        const stepData = { ...step, recipe_id: recipeData.id }
        const existingStep = await LocalDB.getById('recipe_steps', step.id)
        
        if (existingStep) {
          await LocalDB.update('recipe_steps', stepData)
        } else {
          await LocalDB.add('recipe_steps', stepData)
        }

        // Save chemicals for this step
        if (step.chemicals) {
          for (const chem of step.chemicals) {
            const chemData = { ...chem, step_id: stepData.id, recipe_id: recipeData.id }
            await LocalDB.add('recipe_step_chemicals', chemData)
          }
        }
      }

      toast.success('Recipe saved successfully!')
      navigate('/recipes')
    } catch (error) {
      console.error('Error saving recipe:', error)
      toast.error('Failed to save recipe')
    } finally {
      setLoading(false)
    }
  }

  // Listen for Ctrl+S save shortcut
  useEffect(() => {
    const handler = () => handleSave()
    window.addEventListener('shortcut:save', handler)
    return () => window.removeEventListener('shortcut:save', handler)
  }, [handleSave])

  const totalProcessTime = steps.reduce((sum, step) => sum + (step.time_minutes || 0), 0)
  const totalWaterUsage = steps.reduce((sum, step) => sum + (step.water_liters || 0), 0)

  // Load template into builder
  const loadFromTemplate = (tmpl: any) => {
    if (tmpl.wash_type) setRecipe(prev => ({ ...prev, wash_type: tmpl.wash_type }))
    const templateSteps: RecipeStep[] = (tmpl.steps || []).map((s: any, idx: number) => ({
      id: crypto.randomUUID(),
      recipe_id: '',
      step_order: idx + 1,
      process_name: s.process_name,
      temperature: s.temperature,
      time_minutes: s.time_minutes ?? s.time_min,
      non_op_time: s.non_op_time,
      ltr: s.ltr || s.liquor_ratio,
      rpm: s.rpm,
      ph: s.ph || s.ph_range || s.default_ph,
      remarks: s.remarks,
      chemicals: (s.chemicals || []).map((c: any) => ({
        id: crypto.randomUUID(),
        chemical_name: c.chemical_name,
        dosage: c.dosage,
        dosage_g_per_kg: c.dosage_g_per_kg,
        unit: c.unit,
      })),
    }))
    setSteps(templateSteps)
    toast.success(`Loaded ${templateSteps.length} steps from template "${tmpl.name}"`)
  }

  // Save current recipe as template
  const handleSaveAsTemplate = async () => {
    if (steps.length === 0) { toast.error('Add at least one step to save as template'); return }
    const name = prompt('Template name:', recipe.wash_type || 'My Template')
    if (!name) return
    const { db: dbModule } = await import('@/services/local-db')
    const template = {
      id: 'tmpl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      wash_type: recipe.wash_type || 'General',
      description: `From recipe ${recipe.recipe_no || 'new'}`,
      steps: steps.map(s => ({
        id: 'ts-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        recipe_id: '',
        step_order: s.step_order,
        process_name: s.process_name,
        temperature: s.temperature,
        time_minutes: s.time_minutes,
        non_op_time: s.non_op_time,
        ltr: s.ltr,
        rpm: s.rpm,
        ph: s.ph,
        remarks: s.remarks,
        chemicals: (s.chemicals || []).map(c => ({
          id: 'tc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          chemical_name: c.chemical_name,
          dosage: c.dosage,
          dosage_g_per_kg: (c as any).dosage_g_per_kg,
          unit: c.unit,
        })),
      })),
      created_at: new Date().toISOString(),
    }
    await dbModule.recipe_templates.add(template)
    toast.success(`Template "${name}" saved with ${steps.length} steps`)
  }

  // Open template picker
  const openTemplatePicker = async () => {
    const { db: dbModule } = await import('@/services/local-db')
    const tmpls = await dbModule.recipe_templates.toArray()
    setAvailableTemplates(tmpls)
    setShowTemplateModal(true)
  }

  const filteredProcesses = processes.filter(p => 
    p.name.toLowerCase().includes(searchProcess.toLowerCase()) ||
    p.category.toLowerCase().includes(searchProcess.toLowerCase())
  )

  // Photo Upload Handler
  const handlePhotoUploadHandler = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    try {
      const base64 = await handlePhotoUpload(file)
      setPhotos([...photos, base64])
      toast.success('Photo uploaded')
    } catch (error) {
      toast.error('Failed to upload photo')
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
    toast.info('Photo removed')
  }

  // QR Code Generator
  const handleGenerateQR = async () => {
    if (!recipe.recipe_no) {
      toast.error('Please fill in Recipe No first')
      return
    }
    
    try {
      const qrUrl = await generateQRCode(recipe as Recipe)
      setQrCodeUrl(qrUrl)
      setShowQRModal(true)
    } catch (error) {
      toast.error('Failed to generate QR code')
    }
  }

  // OCR Scanner
  const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setOcrLoading(true)
    try {
      const base64 = await handlePhotoUpload(file)
      const extractedData = await simulateOCR(base64)
      
      // Auto-fill form with extracted data
      setRecipe({ ...recipe, ...extractedData })
      toast.success('Recipe data extracted via AI!')
      setShowOCRModal(false)
    } catch (error) {
      toast.error('OCR failed')
    } finally {
      setOcrLoading(false)
    }
  }

  // Print options state
  const [printMenuOpen, setPrintMenuOpen] = useState(false)
  const [printOpts, setPrintOpts] = useState({
    includeSummary: false,
    includeChemicalSummary: true,
    includeSignatures: true,
  })

  // Print
  const handlePrint = () => {
    if (!recipe.recipe_no) {
      toast.error('Please fill in Recipe No first')
      return
    }
    printRecipe(recipe as Recipe, steps as any[], printOpts)
    setPrintMenuOpen(false)
  }

  // Share
  const handleShareWhatsApp = () => {
    if (!recipe.recipe_no) {
      toast.error('Please fill in Recipe No first')
      return
    }
    shareViaWhatsApp(recipe as Recipe)
  }

  const handleShareEmail = () => {
    if (!recipe.recipe_no) {
      toast.error('Please fill in Recipe No first')
      return
    }
    shareViaEmail(recipe as Recipe)
  }

  // Export
  const handleExportJSON = () => {
    if (!recipe.recipe_no) {
      toast.error('Please fill in Recipe No first')
      return
    }
    exportAsJSON(recipe as Recipe)
    toast.success('Exported as JSON')
  }

  const handleExportPDF = async () => {
    if (!printContentRef.current) return
    try {
      await exportToPDF('recipe-builder-content', recipe.recipe_no || 'recipe')
      toast.success('PDF exported')
    } catch (error) {
      toast.error('Failed to export PDF')
    }
  }

  // Preview
  const handlePreview = () => {
    setShowPreviewModal(true)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/recipes')} className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold">{recipeId ? 'Edit Recipe' : 'Create Recipe'}</h1>
            <p className="text-muted-foreground mt-1">Build your wash recipe with process workflow</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePreview} className="p-2 hover:bg-muted rounded-lg" title="Preview">
            <Eye className="w-5 h-5" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-muted rounded-lg" title="Upload Photo">
            <Image className="w-5 h-5" />
          </button>
          <button onClick={() => setShowOCRModal(true)} className="p-2 hover:bg-muted rounded-lg" title="AI OCR Scan">
            <Wand2 className="w-5 h-5" />
          </button>
          <button onClick={handleSaveAsTemplate} className="p-2 hover:bg-muted rounded-lg" title="Save as Template">
            <BookOpen className="w-5 h-5" />
          </button>
          <button onClick={openTemplatePicker} className="p-2 hover:bg-muted rounded-lg" title="Load Template">
            <FileText className="w-5 h-5" />
          </button>

          <button onClick={handleGenerateQR} className="p-2 hover:bg-muted rounded-lg" title="QR Code">
            <QrCode className="w-5 h-5" />
          </button>

          <button onClick={handleShareWhatsApp} className="p-2 hover:bg-muted rounded-lg text-green-600" title="Share WhatsApp">
            <Share2 className="w-5 h-5" />
          </button>

          {/* Print Dropdown */}
          <div className="relative">
            <button
              onClick={() => setPrintMenuOpen(v => !v)}
              className="flex items-center gap-1 px-3 py-2 hover:bg-muted rounded-lg border border-border"
              title="Print Options"
            >
              <Printer className="w-4 h-4" />
              <span className="text-sm">Print</span>
              <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {printMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1 border-b border-border">Print Options</div>
                {([
                  ['includeSummary', 'Include Summary Block'],
                  ['includeChemicalSummary', 'Include Chemical Summary'],
                  ['includeSignatures', 'Include Signature Lines'],
                ] as [keyof typeof printOpts, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-sm hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={printOpts[key]}
                      onChange={e => setPrintOpts(o => ({ ...o, [key]: e.target.checked }))}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    {label}
                  </label>
                ))}
                <button
                  onClick={handlePrint}
                  className="w-full mt-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Print Recipe
                </button>
              </div>
            )}
          </div>

          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
            <Save className="w-4 h-4" /> Save Recipe
          </button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUploadHandler} className="hidden" />

      <div className="space-y-6" id="recipe-builder-content" ref={printContentRef}>
        {/* Recipe Info */}
        <div className="space-y-6">
          {/* Recipe Header Form */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">📋</div>
              <h2 className="text-xl font-semibold">Recipe Information</h2>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Recipe No (Auto)</label>
                <input type="text" value={recipe.recipe_no} readOnly className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-muted-foreground" placeholder="Auto-generated" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Reference No (Auto)</label>
                <input type="text" value={recipe.recipe_ref || ''} readOnly className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-muted-foreground" placeholder="Auto-generated" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Date</label>
                <input type="date" value={recipe.recipe_date || ''} onChange={(e) => setRecipe({ ...recipe, recipe_date: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Factory Name</label>
                <input type="text" value={recipe.factory_name || ''} onChange={(e) => setRecipe({ ...recipe, factory_name: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Factory A" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Customer Name *</label>
                <input type="text" value={recipe.customer_name || ''} onChange={(e) => setRecipe({ ...recipe, customer_name: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Primark" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">PO Number</label>
                <input type="text" value={recipe.po || ''} onChange={(e) => setRecipe({ ...recipe, po: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="1177982" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Style *</label>
                <input type="text" value={recipe.style || ''} onChange={(e) => setRecipe({ ...recipe, style: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="2B BAGGY FIT DENIM" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Color *</label>
                <input type="text" value={recipe.color || ''} onChange={(e) => setRecipe({ ...recipe, color: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="BLUE" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Wash Type *</label>
                <select value={recipe.wash_type || ''} onChange={(e) => setRecipe({ ...recipe, wash_type: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Select</option>
                  <option value="Normal Wash">Normal Wash</option>
                  <option value="Heavy Wash">Heavy Wash</option>
                  <option value="Delicate Wash">Delicate Wash</option>
                  <option value="Bleach Wash">Bleach Wash</option>
                  <option value="Enzyme Wash">Enzyme Wash</option>
                  <option value="Stone Wash">Stone Wash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Machine Type</label>
                <select value={recipe.machine_type || ''} onChange={(e) => setRecipe({ ...recipe, machine_type: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">-- Select Machine --</option>
                  <option value="Washer Extractor">Washer Extractor</option>
                  <option value="Front Load">Front Load</option>
                  <option value="Top Load">Top Load</option>
                  <option value="Tunnel Washer">Tunnel Washer</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">OB No</label>
                <input type="text" value={recipe.ob_no || ''} onChange={(e) => setRecipe({ ...recipe, ob_no: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="4400/2.1" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Order Quantity</label>
                <input type="number" value={recipe.order_quantity || 0} onChange={(e) => setRecipe({ ...recipe, order_quantity: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="2400" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Item</label>
                <input type="text" value={recipe.item || ''} onChange={(e) => setRecipe({ ...recipe, item: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Denim Long Pant" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Final Wash</label>
                <input type="text" value={(recipe as any).final_wash || ''} onChange={(e) => setRecipe({ ...recipe, final_wash: e.target.value } as any)} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Enzyme + Stone Wash" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Batch Weight (KG)</label>
                <input type="number" value={recipe.batch_weight || 0} onChange={(e) => setRecipe({ ...recipe, batch_weight: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Batch Quantity (pcs)</label>
                <input type="number" value={recipe.batch_quantity || 0} onChange={(e) => setRecipe({ ...recipe, batch_quantity: parseInt(e.target.value) })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="250" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Conversion</label>
                <input type="number" value={(recipe as any).conversion || 0} onChange={(e) => setRecipe({ ...recipe, conversion: parseInt(e.target.value) } as any)} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="120" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Recipe Stage</label>
                <select value={recipe.recipe_stage || 'Sample'} onChange={(e) => setRecipe({ ...recipe, recipe_stage: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="Sample">Sample</option>
                  <option value="Bulk">Bulk</option>
                  <option value="Pilot">Pilot</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Version</label>
                <input type="text" value={recipe.recipe_version || '1.0'} onChange={(e) => setRecipe({ ...recipe, recipe_version: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="1.0" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Recipe Type</label>
                <select value={recipe.recipe_type || 'Original'} onChange={(e) => setRecipe({ ...recipe, recipe_type: e.target.value as any })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="Original">📋 Original</option>
                  <option value="Sample">🧪 Sample</option>
                  <option value="Bulk">📦 Bulk</option>
                  <option value="Revised">🔄 Revised</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Status</label>
                <select value={recipe.status || 'Draft'} onChange={(e) => setRecipe({ ...recipe, status: e.target.value as any })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Finalized">Finalized</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Recipe Time (min)</label>
                <input type="number" value={recipe.recipe_time || 0} readOnly className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-primary font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Total Water (L)</label>
                <input type="number" value={recipe.total_water || 0} readOnly className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-blue-500 font-semibold" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Cost/Batch ($)</label>
                <input type="number" value={recipe.cost_batch || 0} onChange={(e) => setRecipe({ ...recipe, cost_batch: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" step="0.01" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Cost/PC ($)</label>
                <input type="number" value={recipe.cost_pc || 0} onChange={(e) => setRecipe({ ...recipe, cost_pc: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" step="0.01" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Remarks</label>
              <textarea value={recipe.remarks || ''} onChange={(e) => setRecipe({ ...recipe, remarks: e.target.value })} rows={2} className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Additional notes..." />
            </div>
          </div>

          {/* Workflow Builder */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span>⚙️</span> Workflow & Process Sequence
              </h3>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                {steps.length} steps
              </span>
            </div>
            
            <div className="grid grid-cols-[260px_1fr] gap-6">
              {/* Left: Process Palette */}
              <div className="h-fit sticky top-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Process Palette</h4>
                  <button onClick={() => navigate('/processes')} className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90">
                    + New
                  </button>
                </div>
                <input 
                  type="text" 
                  placeholder="Search processes..." 
                  value={searchProcess} 
                  onChange={(e) => setSearchProcess(e.target.value)} 
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                />
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredProcesses.map(process => (
                    <button 
                      key={process.id} 
                      onClick={() => addProcessToWorkflow(process)} 
                      className="w-full text-left p-3 bg-muted border border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <div className="font-medium text-sm">{process.name}</div>
                      <div className="text-xs text-muted-foreground">{process.category}</div>
                      <div className="text-xs text-muted-foreground mt-1">{process.default_temperature}°C • {process.default_time}min</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Workflow Area */}
              <div className="bg-muted/30 border border-border rounded-lg p-4 min-h-[400px] overflow-y-auto">
                {steps.length === 0 && (
                  <div className="border-2 border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                    <div className="text-4xl mb-2">📝</div>
                    <p>Drag processes here or click to add</p>
                  </div>
                )}
                
                <div className="space-y-3">
                  {steps.map((step, stepIndex) => (
                    <div key={step.id || stepIndex} className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-all">
                      {/* Step Header */}
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold">
                            {stepIndex + 1}
                          </div>
                          <input 
                            type="text" 
                            value={step.process_name} 
                            onChange={(e) => updateStep(stepIndex, 'process_name', e.target.value)} 
                            className="text-base font-semibold bg-transparent border-none focus:outline-none" 
                            placeholder="Process Name" 
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Move Up */}
                          <button
                            onClick={() => moveStep(stepIndex, 'up')}
                            disabled={stepIndex === 0}
                            title="Move Up"
                            className="p-1.5 rounded transition-all text-muted-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            ▲
                          </button>
                          {/* Move Down */}
                          <button
                            onClick={() => moveStep(stepIndex, 'down')}
                            disabled={stepIndex === steps.length - 1}
                            title="Move Down"
                            className="p-1.5 rounded transition-all text-muted-foreground hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            ▼
                          </button>
                          {/* Delete */}
                          <button 
                            onClick={() => removeStep(stepIndex)} 
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Step Parameters - 7 columns */}
                      <div className="grid grid-cols-[85px_85px_95px_90px_65px_65px_95px] gap-2 mb-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Temp (°C)</label>
                          <input 
                            type="number" 
                            value={step.temperature || 0} 
                            onChange={(e) => updateStep(stepIndex, 'temperature', parseFloat(e.target.value))} 
                            className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Time (min)</label>
                          <input 
                            type="number" 
                            value={step.time_minutes || 0} 
                            onChange={(e) => updateStep(stepIndex, 'time_minutes', parseFloat(e.target.value))} 
                            className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Liquor Ratio</label>
                          <input 
                            type="text" 
                            value={step.ltr || '1:10'} 
                            onChange={(e) => updateStep(stepIndex, 'ltr', e.target.value)} 
                            className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                            placeholder="1:10" 
                          />
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-1.5 text-center">
                          <div className="text-xs text-emerald-600 dark:text-emerald-400">Water (L)</div>
                          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{step.water_liters || 0}</div>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-1.5 text-center">
                          <div className="text-xs text-emerald-600 dark:text-emerald-400">Dosage</div>
                          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{step.chemical_dosage || 0}</div>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-1.5 text-center">
                          <div className="text-xs text-emerald-600 dark:text-emerald-400">Chem</div>
                          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{step.chemicals?.length || 0}</div>
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">RPM</label>
                          <input 
                            type="number" 
                            value={(step as any).rpm || 0} 
                            onChange={(e) => updateStep(stepIndex, 'rpm' as any, parseFloat(e.target.value))} 
                            className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                          />
                        </div>
                      </div>

                      {/* Step Weight, Qty, Remarks */}
                      <div className="flex gap-3 mt-3 pt-3 border-t border-border">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Step Weight (KG)</label>
                          <input 
                            type="number" 
                            value={step.step_weight || 0} 
                            onChange={(e) => updateStep(stepIndex, 'step_weight', parseFloat(e.target.value))} 
                            className="w-20 px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                            placeholder="Default" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Step Qty (pcs)</label>
                          <input 
                            type="number" 
                            value={step.step_qty || 0} 
                            onChange={(e) => updateStep(stepIndex, 'step_qty', parseInt(e.target.value))} 
                            className="w-20 px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                            placeholder="Default" 
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-muted-foreground mb-1">Step Remarks / Notes</label>
                          <input 
                            type="text" 
                            value={(step as any).remarks || ''} 
                            onChange={(e) => updateStep(stepIndex, 'remarks' as any, e.target.value)} 
                            className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                            placeholder="Add specific notes for this process..." 
                          />
                        </div>
                      </div>

                      {/* Chemicals Section */}
                      <div className="bg-muted/50 rounded-lg p-3 border border-border">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-semibold">Chemicals</span>
                          <button 
                            onClick={() => addChemicalToStep(stepIndex)} 
                            className="px-3 py-1 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition-all"
                          >
                            + Add Chemical
                          </button>
                        </div>
                        <div className="space-y-2">
                          {step.chemicals?.map((chem, chemIndex) => (
                            <div key={chem.id || chemIndex} className="grid grid-cols-[1fr_80px_70px_60px_80px_80px_28px] gap-2 items-center">
                              <select 
                                value={chem.chemical_id} 
                                onChange={(e) => updateStepChemical(stepIndex, chemIndex, 'chemical_id', e.target.value)} 
                                className="px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="">Select Chemical</option>
                                {chemicals.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <input 
                                type="number" 
                                placeholder="g/kg" 
                                value={chem.dosage_g_per_kg || 0} 
                                onChange={(e) => updateStepChemical(stepIndex, chemIndex, 'dosage_g_per_kg', parseFloat(e.target.value))} 
                                className="px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                                step="0.1" 
                              />
                              <input 
                                type="number" 
                                placeholder="g/L" 
                                value={chem.dosage || 0} 
                                onChange={(e) => updateStepChemical(stepIndex, chemIndex, 'dosage', parseFloat(e.target.value))} 
                                className="px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                                step="0.1" 
                              />
                              <select 
                                value={chem.unit || 'g/kg'} 
                                onChange={(e) => updateStepChemical(stepIndex, chemIndex, 'unit', e.target.value)} 
                                className="px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="g/kg">g/kg</option>
                                <option value="g/l">g/L</option>
                                <option value="ml/l">ml/L</option>
                                <option value="%">%</option>
                              </select>
                              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded px-2 py-1.5 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                {chem.qty_grams?.toFixed(1) || 0}g
                              </div>
                              <input 
                                type="number" 
                                placeholder="Total" 
                                value={chem.qty_grams || 0} 
                                onChange={(e) => updateStepChemical(stepIndex, chemIndex, 'qty_grams', parseFloat(e.target.value))} 
                                className="px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                              />
                              <button 
                                onClick={() => removeChemicalFromStep(stepIndex, chemIndex)} 
                                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Gallery */}
      {photos.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Image className="w-5 h-5" />
            Recipe Photos ({photos.length})
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                <img src={photo} alt={`Recipe photo ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-border" />
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <QrCode className="w-5 h-5" /> Recipe QR Code
            </h3>
            <div className="bg-white p-4 rounded-lg flex justify-center mb-4">
              <img src={qrCodeUrl} alt="QR Code" className="max-w-full" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Scan this code on the Shop Floor to load the recipe instantly.
            </p>
            <button onClick={() => setShowQRModal(false)} className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg">
              Close
            </button>
          </div>
        </div>
      )}

      {/* OCR Scanner Modal */}
      {showOCRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-lg w-full p-6">
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Wand2 className="w-5 h-5" /> Scan Recipe (AI OCR)
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload a photo of a handwritten or printed recipe. The AI will read the text and auto-fill the form.
            </p>
            
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all mb-4"
              onClick={() => document.getElementById('ocr-file-input')?.click()}
            >
              {ocrLoading ? (
                <div className="py-8">
                  <div className="text-4xl mb-2">⏳</div>
                  <p className="text-muted-foreground">Processing with AI...</p>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-2">📄</div>
                  <p className="font-medium mb-1">Drop recipe image here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Supports: JPG, PNG, PDF</p>
                </div>
              )}
              <input
                id="ocr-file-input"
                type="file"
                accept="image/*"
                onChange={handleOCRUpload}
                className="hidden"
                disabled={ocrLoading}
              />
            </div>
            
            <button onClick={() => setShowOCRModal(false)} className="w-full px-4 py-2 bg-muted border border-border rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Recipe Preview</h3>
              <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-muted rounded">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-bold text-lg mb-2">{recipe.recipe_no || 'Draft Recipe'}</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Customer:</span> {recipe.customer_name || '-'}</div>
                  <div><span className="text-muted-foreground">Style:</span> {recipe.style || '-'}</div>
                  <div><span className="text-muted-foreground">Color:</span> {recipe.color || '-'}</div>
                  <div><span className="text-muted-foreground">Wash Type:</span> {recipe.wash_type || '-'}</div>
                  <div><span className="text-muted-foreground">Batch:</span> {recipe.batch_weight} kg</div>
                  <div><span className="text-muted-foreground">Status:</span> {recipe.status}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Process Steps ({steps.length})</h4>
                {steps.map((step, idx) => (
                  <div key={idx} className="bg-muted p-3 rounded-lg mb-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{step.process_name || 'Unnamed Step'}</span>
                      <span className="text-sm text-muted-foreground">{step.time_minutes}min @ {step.temperature}°C</span>
                    </div>
                    {step.chemicals && step.chemicals.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Chemicals: {step.chemicals.map(c => c.chemical_name).filter(Boolean).join(', ') || 'None'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 pt-4">
                <button onClick={handlePrint} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg">
                  <Printer className="w-4 h-4 inline mr-2" /> Print
                </button>
                <button onClick={handleExportPDF} className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg">
                  <FileText className="w-4 h-4 inline mr-2" /> Export PDF
                </button>
                <button onClick={handleShareWhatsApp} className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg">
                  <Share2 className="w-4 h-4 inline mr-2" /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Picker Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              Load from Template
            </h2>
            {availableTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No templates saved yet</p>
                <p className="text-xs mt-1">Save a recipe as a template from the BookOpen icon above</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableTemplates.map((tmpl: any) => (
                  <button key={tmpl.id}
                    onClick={() => { loadFromTemplate(tmpl); setShowTemplateModal(false) }}
                    className="w-full text-left p-3 bg-muted/50 hover:bg-muted border border-border rounded-lg transition-colors">
                    <div className="font-semibold text-sm">{tmpl.name}</div>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="text-indigo-400">{tmpl.wash_type}</span>
                      <span>·</span>
                      <span>{tmpl.steps?.length || 0} steps</span>
                      <span>·</span>
                      <span>{new Date(tmpl.created_at).toLocaleDateString()}</span>
                    </div>
                    {tmpl.description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{tmpl.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowTemplateModal(false)}
              className="w-full px-4 py-2 bg-muted hover:bg-muted/70 border border-border rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
