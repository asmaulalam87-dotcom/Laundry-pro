import { create } from 'zustand'
import type { Chemical } from '@/types'
import { LocalDB } from '@/services/local-db'

interface ChemicalState {
  chemicals: Chemical[]
  loading: boolean
  setChemicals: (chemicals: Chemical[]) => void
  setLoading: (loading: boolean) => void
  loadChemicals: () => Promise<void>
  saveChemical: (chemical: Chemical) => Promise<void>
  deleteChemical: (id: string) => Promise<void>
  getLowStockChemicals: () => Chemical[]
}

export const useChemicalStore = create<ChemicalState>()((set, get) => ({
  chemicals: [],
  loading: false,
  setChemicals: (chemicals) => set({ chemicals }),
  setLoading: (loading) => set({ loading }),

  loadChemicals: async () => {
    set({ loading: true })
    try {
      const chemicals = await LocalDB.getAll<Chemical>('chemicals')
      set({ chemicals: chemicals.sort((a, b) => a.name.localeCompare(b.name)) })
    } catch (error) {
      console.error('Error loading chemicals:', error)
    } finally {
      set({ loading: false })
    }
  },

  saveChemical: async (chemical) => {
    const existing = await LocalDB.getById<Chemical>('chemicals', chemical.id)
    if (existing) {
      await LocalDB.update('chemicals', chemical)
    } else {
      await LocalDB.add('chemicals', chemical)
    }
    await get().loadChemicals()
  },

  deleteChemical: async (id) => {
    await LocalDB.delete('chemicals', id)
    await get().loadChemicals()
  },

  getLowStockChemicals: () => {
    return get().chemicals.filter(
      (c) => c.current_stock <= c.minimum_stock_threshold
    )
  },
}))
