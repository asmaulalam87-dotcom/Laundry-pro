import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SyncQueueItem {
  id: string
  table: string
  action: 'create' | 'update' | 'delete'
  data: any
  timestamp: string
  synced: boolean
}

interface SyncState {
  isOnline: boolean
  lastSyncAt: string | null
  syncQueue: SyncQueueItem[]
  pendingCount: number
  setOnline: (online: boolean) => void
  setLastSync: (ts: string) => void
  addToQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'synced'>) => void
  removeFromQueue: (id: string) => void
  clearQueue: () => void
  markSynced: (id: string) => void
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      lastSyncAt: null,
      syncQueue: [],
      pendingCount: 0,

      setOnline: (online) => set({ isOnline: online }),

      setLastSync: (ts) => set({ lastSyncAt: ts }),

      addToQueue: (item) => {
        const queueItem: SyncQueueItem = {
          ...item,
          id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          synced: false,
        }
        const newQueue = [...get().syncQueue, queueItem]
        set({ syncQueue: newQueue, pendingCount: newQueue.filter(q => !q.synced).length })
      },

      removeFromQueue: (id) => {
        const newQueue = get().syncQueue.filter(q => q.id !== id)
        set({ syncQueue: newQueue, pendingCount: newQueue.filter(q => !q.synced).length })
      },

      clearQueue: () => set({ syncQueue: [], pendingCount: 0 }),

      markSynced: (id) => {
        const newQueue = get().syncQueue.map(q => q.id === id ? { ...q, synced: true } : q)
        set({ syncQueue: newQueue, pendingCount: newQueue.filter(q => !q.synced).length })
      },
    }),
    { name: 'sync-storage' }
  )
)
