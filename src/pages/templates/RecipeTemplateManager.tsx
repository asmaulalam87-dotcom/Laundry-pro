import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/services/local-db'
import type { RecipeTemplate, RecipeStep, RecipeStepChemical } from '@/types'
import { FileText, Plus, Trash2, Copy, Download, Upload, Save, BookOpen, Search, FlaskConical, Thermometer, Clock, RotateCw } from 'lucide-react'
import { toast } from 'sonner'

export const RecipeTemplateManager = () => {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<RecipeTemplate[]>([])
  const [recipes, setRecipes] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterWashType, setFilterWashType] = useState('all')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [templateWashType, setTemplateWashType] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
    db.recipes.toArray().then(setRecipes)
  }, [])

  const loadTemplates = async () => {
    const t = await db.recipe_templates.toArray()
    setTemplates(t.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
  }

  const washTypes = Array.from(new Set(templates.map(t => t.wash_type).filter(Boolean)))

  let filtered = templates
  if (filterWashType !== 'all') filtered = filtered.filter(t => t.wash_type === filterWashType)
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(t => t.name.toLowerCase().includes(q) || t.wash_type?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
  }

  // Save current recipe as template
  const handleSaveFromRecipe = async () => {
    if (!selectedRecipeId) { toast.error('Select a recipe first'); return }
    if (!templateName.trim()) { toast.error('Enter a template name'); return }

    const recipe = recipes.find(r => r.id === selectedRecipeId)
    if (!recipe) { toast.error('Recipe not found'); return }

    const recipeSteps = await db.recipe_steps.where('recipe_id').equals(selectedRecipeId).sortBy('step_order')
    const allChemicals = await db.recipe_step_chemicals.where('recipe_id').equals(selectedRecipeId).toArray()

    const templateSteps: RecipeStep[] = recipeSteps.map(s => ({
      id: 'ts-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      recipe_id: '',
      step_order: s.step_order,
      process_name: s.process_name,
      temperature: s.temperature,
      time_minutes: s.time_minutes ?? (s as any).time_min,
      non_op_time: (s as any).non_op_time,
      ltr: (s as any).liquor_ratio || (s as any).ltr,
      rpm: s.rpm ?? (s as any).default_rpm,
      ph: s.ph ?? (s as any).ph_range ?? (s as any).default_ph,
      remarks: s.remarks,
      chemicals: allChemicals
        .filter(c => c.recipe_step_id === s.id)
        .map(c => ({
          id: 'tc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          chemical_name: c.chemical_name,
          dosage: c.dosage,
          dosage_g_per_kg: (c as any).dosage_g_per_kg,
          unit: c.unit,
        })) as any,
    }))

    const template: RecipeTemplate = {
      id: 'tmpl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: templateName.trim(),
      wash_type: templateWashType || recipe.wash_type || 'General',
      description: templateDesc.trim() || `Template from recipe ${recipe.recipe_no}`,
      steps: templateSteps,
      created_at: new Date().toISOString(),
    }

    await db.recipe_templates.add(template)
    toast.success(`Template "${template.name}" saved with ${templateSteps.length} steps`)
    setShowSaveModal(false)
    setTemplateName('')
    setTemplateDesc('')
    setTemplateWashType('')
    setSelectedRecipeId('')
    loadTemplates()
  }

  // Delete template
  const handleDelete = async (id: string) => {
    await db.recipe_templates.delete(id)
    toast.success('Template deleted')
    loadTemplates()
  }

  // Duplicate template
  const handleDuplicate = async (t: RecipeTemplate) => {
    const dup: RecipeTemplate = {
      ...t,
      id: 'tmpl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: t.name + ' (Copy)',
      created_at: new Date().toISOString(),
    }
    await db.recipe_templates.add(dup)
    toast.success('Template duplicated')
    loadTemplates()
  }

  // Create new recipe from template
  const handleUseTemplate = (t: RecipeTemplate) => {
    localStorage.setItem('recipe_template_to_load', JSON.stringify(t))
    navigate('/recipes/builder?from_template=1')
    toast.success(`Loading template "${t.name}" into Recipe Builder`)
  }

  // Export template as JSON
  const handleExport = (t: RecipeTemplate) => {
    const json = JSON.stringify(t, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template-${t.name.toLowerCase().replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Template exported')
  }

  // Import template from JSON
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (!data.name || !data.steps) { toast.error('Invalid template file'); return }
        const template: RecipeTemplate = {
          ...data,
          id: 'tmpl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          created_at: new Date().toISOString(),
        }
        await db.recipe_templates.add(template)
        toast.success(`Imported template "${template.name}"`)
        loadTemplates()
      } catch { toast.error('Failed to parse template file') }
    }
    input.click()
  }

  // Export all templates
  const handleExportAll = () => {
    const json = JSON.stringify(templates, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `all-templates-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${templates.length} templates`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-400" />
            Recipe Templates
          </h1>
          <p className="text-muted-foreground mt-1">Save, manage, and reuse recipe templates for faster recipe creation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold flex items-center gap-2">
            <Save className="w-4 h-4" /> Save from Recipe
          </button>
          <button onClick={handleImport}
            className="px-4 py-2 bg-muted hover:bg-muted/70 border border-border rounded-lg text-sm font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import
          </button>
          {templates.length > 0 && (
            <button onClick={handleExportAll}
              className="px-4 py-2 bg-muted hover:bg-muted/70 border border-border rounded-lg text-sm font-semibold flex items-center gap-2">
              <Download className="w-4 h-4" /> Export All
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search templates..." className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm" />
        </div>
        {washTypes.length > 0 && (
          <select value={filterWashType} onChange={e => setFilterWashType(e.target.value)}
            className="px-3 py-2 bg-muted border border-border rounded-lg text-sm">
            <option value="all">All Wash Types</option>
            {washTypes.map(wt => <option key={wt} value={wt}>{wt}</option>)}
          </select>
        )}
        <span className="text-xs text-muted-foreground">{filtered.length} template{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Template grid */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <h2 className="text-xl font-semibold mb-2">No Templates Yet</h2>
          <p className="text-muted-foreground mb-4">Save a recipe as a template or import one to get started</p>
          <button onClick={() => setShowSaveModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold">
            <Plus className="w-4 h-4 inline" /> Save from Recipe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tmpl => {
            const totalChemicals = tmpl.steps.reduce((sum, s) => sum + (s.chemicals?.length || 0), 0)
            const expanded = expandedId === tmpl.id
            return (
              <div key={tmpl.id} className="bg-card border border-border rounded-lg overflow-hidden hover:border-indigo-500/40 transition-colors">
                {/* Card header */}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{tmpl.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-semibold">
                          {tmpl.wash_type}
                        </span>
                      </div>
                    </div>
                  </div>
                  {tmpl.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{tmpl.description}</p>
                  )}

                  {/* Stats */}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{tmpl.steps.length} steps</span>
                    <span>{totalChemicals} chemicals</span>
                    <span>{new Date(tmpl.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Expand/collapse steps preview */}
                  <button onClick={() => setExpandedId(expanded ? null : tmpl.id)}
                    className="text-xs text-indigo-400 hover:text-indigo-300">
                    {expanded ? 'Hide steps ▲' : 'Show steps ▼'}
                  </button>
                </div>

                {/* Steps preview */}
                {expanded && (
                  <div className="border-t border-border px-4 py-3 space-y-2 max-h-60 overflow-y-auto bg-muted/30">
                    {tmpl.steps.map((step, idx) => (
                      <div key={step.id || idx} className="text-xs space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-semibold">{step.process_name}</span>
                        </div>
                        <div className="ml-7 flex gap-2 text-muted-foreground">
                          {step.temperature != null && <span><Thermometer className="w-3 h-3 inline" /> {step.temperature}°C</span>}
                          {step.time_minutes != null && <span><Clock className="w-3 h-3 inline" /> {step.time_minutes}m</span>}
                          {step.rpm != null && <span><RotateCw className="w-3 h-3 inline" /> {step.rpm}</span>}
                          {step.ph && <span>pH {step.ph}</span>}
                        </div>
                        {step.chemicals && step.chemicals.length > 0 && (
                          <div className="ml-7 flex flex-wrap gap-1">
                            {step.chemicals.map((c: any, ci: number) => (
                              <span key={ci} className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                <FlaskConical className="w-2.5 h-2.5 inline" /> {c.chemical_name} {c.dosage}{c.unit}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-border px-4 py-2 flex items-center gap-1.5 bg-muted/20">
                  <button onClick={() => handleUseTemplate(tmpl)}
                    className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1">
                    <FileText className="w-3 h-3" /> Use Template
                  </button>
                  <button onClick={() => handleDuplicate(tmpl)} title="Duplicate"
                    className="p-1.5 bg-muted hover:bg-muted/70 border border-border rounded text-xs">
                    <Copy className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleExport(tmpl)} title="Export"
                    className="p-1.5 bg-muted hover:bg-muted/70 border border-border rounded text-xs">
                    <Download className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleDelete(tmpl.id)} title="Delete"
                    className="p-1.5 bg-muted hover:bg-muted/70 border border-border rounded text-xs text-red-400 hover:text-red-300">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Save from Recipe Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[500] p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Save className="w-5 h-5 text-indigo-400" />
              Save as Template from Recipe
            </h2>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Select Recipe</label>
              <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm">
                <option value="">— Select a recipe —</option>
                {recipes.map(r => (
                  <option key={r.id} value={r.id}>{r.recipe_no} — {r.customer_name} · {r.style} · {r.wash_type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Template Name *</label>
              <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g. Standard Enzyme Wash"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Wash Type</label>
              <input type="text" value={templateWashType} onChange={e => setTemplateWashType(e.target.value)}
                placeholder="e.g. Enzyme Wash (auto-filled from recipe)"
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Description</label>
              <textarea value={templateDesc} onChange={e => setTemplateDesc(e.target.value)}
                rows={2} placeholder="Optional description of this template..."
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm resize-none" />
            </div>

            {selectedRecipeId && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 text-xs">
                <span className="font-semibold text-indigo-400">
                  {(() => {
                    const r = recipes.find(x => x.id === selectedRecipeId)
                    return r ? `${r.recipe_no} · ${r.customer_name} · ${r.wash_type}` : ''
                  })()}
                </span>
                <span className="text-muted-foreground block mt-0.5">All steps and chemicals will be saved as a reusable template</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2 bg-muted hover:bg-muted/70 border border-border rounded-lg text-sm">
                Cancel
              </button>
              <button onClick={handleSaveFromRecipe} disabled={!selectedRecipeId || !templateName.trim()}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
