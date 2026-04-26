import { create } from 'zustand'

interface UIState {
  theme: 'dark' | 'light'
  sidebarOpen: boolean
  sidebarHidden: boolean
  setTheme: (theme: 'dark' | 'light') => void
  toggleSidebar: () => void
  toggleSidebarHidden: () => void
  setSidebarHidden: (hidden: boolean) => void
}

export const useUIStore = create<UIState>()((set) => ({
  theme: 'dark',
  sidebarOpen: true,
  sidebarHidden: false,
  setTheme: (theme) => {
    set({ theme })
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSidebarHidden: () => set((state) => ({ sidebarHidden: !state.sidebarHidden })),
  setSidebarHidden: (hidden: boolean) => set({ sidebarHidden: hidden }),
}))

const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null
if (savedTheme) {
  useUIStore.getState().setTheme(savedTheme)
}
