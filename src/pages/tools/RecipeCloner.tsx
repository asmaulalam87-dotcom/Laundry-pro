import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/services/local-db'
import { Copy, Plus, ArrowRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export const RecipeCloner = () => {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null)
  const [steps, setSteps] = useState<any[]>([])
  const [cloneSuffix, setCloneSuffix] = useState('(Copy)')
  const [cloneCount, setCloneCount] = useState(1)
  const [modifyCustomer, setModifyCustomer] = useState('')
  const [modifyWashType, setModifyWashType] = useState('')
  const [modifyStyle, setModifyStyle] = useState('')
  const [modifyColor, setModifyColor] = useState('')
  const [recentClones, setRecentClones] = useState<any[]>([])

  useEffect(() => {
    db.recipes.toArray().then(setRecipes)
    const saved = localStorage.getItem('recent_clones')
    if (saved) setRecentClones(JSON.parse(saved))
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedId])

  const loadData = async () => {
    if (!selectedId) { setSelectedRecipe(null); setSteps([]); return }
    const recipe = await db.recipes.get(selectedId)
    if (!recipe) return
    setSelectedRecipe(recipe)
    setModifyCustomer(recipe.customer_name)
    setModifyWashType(recipe.wash_type)
    setModifyStyle(recipe.style)
    setModifyColor(recipe.color)

    const recipeSteps = await db.recipe_steps.where('recipe_id').equals(selectedId).sortBy('step_order')
    const allChemicals = await db.recipe_step_chemicals.toArray()
    const enriched = recipeSteps.map(s => ({
      ...s,
      chemicals: allChemicals.filter(c => c.recipe_step_id === s.id),
    }))
    setSteps(enriched)
  }

  const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

  const handleClone = async () => {
    if (!selectedRecipe) { toast.error('Select a recipe first'); return }

    try {
      const newRecipeNos: string[] = []

      for (let i = 0; i < cloneCount; i++) {
        const newRecipeId = generateId()
        const suffix = cloneCount > 1 ? `${cloneSuffix} ${i + 1}` : cloneSuffix

        // Create cloned recipe
        const clonedRecipe = {
          ...selectedRecipe,
          id: newRecipeId,
          recipe_no: `${selectedRecipe.recipe_no} ${suffix}`.trim(),
          customer_name: modifyCustomer || selectedRecipe.customer_name,
          wash_type: modifyWashType || selectedRecipe.wash_type,
          style: modifyStyle || selectedRecipe.style,
          color: modifyColor || selectedRecipe.color,
          status: 'draft',
          created_at: new Date().toISOString(),
        }
        delete (clonedRecipe as any).updated_at
        await db.recipes.add(clonedRecipe)
        newRecipeNos.push(clonedRecipe.recipe_no)

        // Clone steps and chemicals
        for (const step of steps) {
          const newStepId = generateId()
          const clonedStep = {
            ...step,
            id: newStepId,
            recipe_id: newRecipeId,
          }
          delete (clonedStep as any).created_at
          await db.recipe_steps.add(clonedStep)

          // Clone step chemicals
          for (const chem of (step.chemicals || [])) {
            const newChemId = generateId()
            const clonedChem = {
              ...chem,
              id: newChemId,
              recipe_step_id: newStepId,
              recipe_id: newRecipeId,
            }
            delete (clonedChem as any).created_at
            await db.recipe_step_chemicals.add(clonedChem)
          }
        }

        // Track recent clone
        const cloneRecord = {
          from: selectedRecipe.recipe_no,
          to: clonedRecipe.recipe_no,
          at: new Date().toISOString(),
          newId: newRecipeId,
        }
        const updated = [cloneRecord, ...recentClones].slice(0, 20)
        setRecentClones(updated)
        localStorage.setItem('recent_clones', JSON.stringify(updated))
      }

      toast.success(`Cloned ${cloneCount} recipe${cloneCount > 1 ? 's' : ''}: ${newRecipeNos.join(', ')}`)

      // Refresh recipes list
      db.recipes.toArray().then(setRecipes)

      // Navigate to the first clone
      if (cloneCount === 1) {
        const latest = recentClones[0]
        navigate(`/recipes/builder?id=${latest?.newId || ''}`)
      }
    } catch (err: any) {
      toast.error('Clone failed: ' + (err?.message || 'Unknown error'))
    }
  }

  const handleDeleteRecent = (idx: number) => {
    const updated = recentClones.filter((_, i) => i !== idx)
    setRecentClones(updated)
    localStorage.setItem('recent_clones', JSON.stringify(updated))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Copy className="w-8 h-8 text-indigo-400" />
          Recipe Cloner
        </h1>
        <p className="text-muted-foreground mt-1">Duplicate recipes with modifications — clone steps, chemicals & costing</p>
      </div>

      {/* Source recipe selector */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">Source Recipe</h3>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">— Select Recipe to Clone —</option>
          {recipes.map(r => (
            <option key={r.id} value={r.id}>{r.recipe_no} — {r.customer_name} · {r.style} · {r.wash_type}</option>
          ))}
        </select>

        {selectedRecipe && (
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 text-sm">
            <div className="font-semibold">{selectedRecipe.recipe_no}</div>
            <div className="text-muted-foreground mt-1">
              {selectedRecipe.customer_name} · {selectedRecipe.style} · {selectedRecipe.color} · {selectedRecipe.wash_type}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {steps.length} steps · {steps.reduce((s: number, step: any) => s + (step.chemicals?.length || 0), 0)} chemicals
            </div>
          </div>
        )}
      </div>

      {/* Clone options */}
      {selectedRecipe && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h3 className="font-semibold">Clone Options</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Recipe Number Suffix</label>
              <input type="text" value={cloneSuffix} onChange={e => setCloneSuffix(e.target.value)}
                placeholder="(Copy)" className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-[10px] text-muted-foreground mt-1">Original: {selectedRecipe.recipe_no} → New: {selectedRecipe.recipe_no} {cloneSuffix}</p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Number of Clones</label>
              <input type="number" value={cloneCount} onChange={e => setCloneCount(Math.max(1, Math.min(10, Number(e.target.value))))}
                min={1} max={10} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Override fields */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3">Override Fields (optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Customer Name</label>
                <input type="text" value={modifyCustomer} onChange={e => setModifyCustomer(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Wash Type</label>
                <input type="text" value={modifyWashType} onChange={e => setModifyWashType(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Style</label>
                <input type="text" value={modifyStyle} onChange={e => setModifyStyle(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Color</label>
                <input type="text" value={modifyColor} onChange={e => setModifyColor(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Leave fields unchanged to copy from source. Cloned recipes start as "draft".</p>
          </div>

          {/* Preview */}
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-2">Clone Preview</h4>
            {Array.from({ length: Math.min(cloneCount, 5) }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg mb-1 text-sm">
                <Copy className="w-4 h-4 text-indigo-400" />
                <span className="text-muted-foreground">{selectedRecipe.recipe_no}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className="font-semibold">
                  {selectedRecipe.recipe_no} {cloneCount > 1 ? `${cloneSuffix} ${i + 1}` : cloneSuffix}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {modifyCustomer || selectedRecipe.customer_name} · {modifyStyle || selectedRecipe.style}
                </span>
              </div>
            ))}
            {cloneCount > 5 && <p className="text-xs text-muted-foreground">...and {cloneCount - 5} more</p>}
          </div>

          <button onClick={handleClone}
            className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-2">
            <Copy className="w-5 h-5" />
            Clone Recipe{cloneCount > 1 ? ` (${cloneCount} copies)` : ''}
          </button>
        </div>
      )}

      {/* Recent clones */}
      {recentClones.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Recent Clones</h3>
            <button onClick={() => { setRecentClones([]); localStorage.removeItem('recent_clones') }}
              className="text-xs text-red-400 hover:text-red-300">Clear All</button>
          </div>
          {recentClones.map((clone: any, idx: number) => (
            <div key={idx} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg text-sm">
              <Copy className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-muted-foreground">{clone.from}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <button onClick={() => navigate(`/recipes/builder?id=${clone.newId}`)}
                className="font-semibold text-indigo-400 hover:text-indigo-300">
                {clone.to}
              </button>
              <span className="text-xs text-muted-foreground ml-auto">{new Date(clone.at).toLocaleString()}</span>
              <button onClick={() => handleDeleteRecent(idx)} className="p-1 text-red-400 hover:text-red-300">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!selectedRecipe && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-2xl font-semibold mb-2">Recipe Cloner</h2>
          <p className="text-muted-foreground">Select a recipe above to duplicate it with optional modifications</p>
        </div>
      )}
    </div>
  )
}
