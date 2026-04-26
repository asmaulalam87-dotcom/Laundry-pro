import { create } from 'zustand'
import type { Recipe, RecipeTemplate } from '@/types'
import { LocalDB } from '@/services/local-db'

interface RecipeState {
  recipes: Recipe[]
  templates: RecipeTemplate[]
  loading: boolean
  selectedRecipe: Recipe | null
  setRecipes: (recipes: Recipe[]) => void
  setTemplates: (templates: RecipeTemplate[]) => void
  setLoading: (loading: boolean) => void
  setSelectedRecipe: (recipe: Recipe | null) => void
  loadRecipes: () => Promise<void>
  loadTemplates: () => Promise<void>
  saveRecipe: (recipe: Recipe) => Promise<void>
  deleteRecipe: (id: string) => Promise<void>
}

export const useRecipeStore = create<RecipeState>()((set, get) => ({
  recipes: [],
  templates: [],
  loading: false,
  selectedRecipe: null,
  setRecipes: (recipes) => set({ recipes }),
  setTemplates: (templates) => set({ templates }),
  setLoading: (loading) => set({ loading }),
  setSelectedRecipe: (recipe) => set({ selectedRecipe: recipe }),
  
  loadRecipes: async () => {
    set({ loading: true })
    try {
      const recipes = await LocalDB.getAll<Recipe>('recipes')
      set({ recipes: recipes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) })
    } catch (error) {
      console.error('Error loading recipes:', error)
    } finally {
      set({ loading: false })
    }
  },

  loadTemplates: async () => {
    try {
      const templates = await LocalDB.getAll<RecipeTemplate>('recipe_templates')
      set({ templates })
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  },

  saveRecipe: async (recipe) => {
    const existing = await LocalDB.getById<Recipe>('recipes', recipe.id)
    if (existing) {
      await LocalDB.update('recipes', recipe)
    } else {
      await LocalDB.add('recipes', recipe)
    }
    await get().loadRecipes()
  },

  deleteRecipe: async (id) => {
    await LocalDB.delete('recipes', id)
    await get().loadRecipes()
  },
}))
