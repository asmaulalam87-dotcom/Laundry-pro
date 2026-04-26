import { type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/stores/ui-store'

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { sidebarOpen, sidebarHidden } = useUIStore()

  // Calculate left margin for main content based on sidebar state
  const marginLeft = sidebarHidden ? 'ml-0' : sidebarOpen ? 'ml-56' : 'ml-14'

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={`transition-all duration-300 ${marginLeft}`}>
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
