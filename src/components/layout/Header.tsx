import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Moon, Sun, Search, User, PanelLeft, LogOut, ChevronDown, X, ArrowRight, FlaskConical, FileText, Keyboard, BarChart3 } from 'lucide-react'
import { useUIStore } from '@/stores/ui-store'
import { useAuthStore } from '@/stores/auth-store'
import { OfflineIndicator } from './OfflineIndicator'
import { SyncIndicator } from './SyncIndicator'
import { db } from '@/services/local-db'
import { useKeyboardShortcuts, SHORTCUT_LIST } from '@/hooks/use-keyboard-shortcuts'

// ── Menu bar definition ───────────────────────────────────────────────────────
type MenuAction = { label: string; shortcut?: string; separator?: false; path?: string; action?: string }
type MenuSep    = { separator: true }
type MenuItem   = MenuAction | MenuSep

interface MenuDef {
  label: string
  items: MenuItem[]
}

const MENU_BAR: MenuDef[] = [
  {
    label: 'File',
    items: [
      { label: 'New Recipe',           shortcut: 'Ctrl+N', path: '/recipes/new' },
      { label: 'Open Recipe List',     path: '/recipes' },
      { separator: true },
      { label: 'New Costing',          path: '/costing' },
      { label: 'Costing List',         path: '/costing-list' },
      { separator: true },
      { label: 'Recipe Templates',      path: '/templates' },
      { separator: true },
      { label: 'Wash Requisition',     path: '/wash-requisition' },
      { separator: true },
      { label: 'Print',                shortcut: 'Ctrl+P', action: 'print' },
      { separator: true },
      { label: 'Logout',               action: 'logout' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Dashboard',            path: '/' },
      { label: 'Shop Floor',           path: '/shop-floor' },
      { label: 'Analytics',            path: '/analytics' },
      { label: 'Data Analytics',       path: '/data-analytics' },
      { separator: true },
      { label: 'Toggle Sidebar',       action: 'toggleSidebar' },
      { label: 'Toggle Dark Mode',     action: 'toggleTheme' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Chemical Master',      path: '/chemicals' },
      { label: 'Process Library',      path: '/processes' },
      { label: 'EIM Score Calculator', path: '/eim-score' },
      { label: 'Recipe Compare',       path: '/compare' },
      { separator: true },
      { label: '🧮 Batch Calculator',   path: '/batch-calculator' },
      { label: '⚠️ Stock Alerts',       path: '/stock-alerts' },
      { label: '📋 Recipe Cloner',       path: '/recipe-cloner' },
      { label: '💰 Cost Estimator',      path: '/cost-estimator' },
      { separator: true },
      { label: '🤖 AI Assistant',       path: '/ai-assistant' },
      { label: '📷 Photo Scanner',       path: '/recipe-scanner' },
      { label: '📱 Barcode Scanner',   path: '/scanner' },
      { label: '✅ Approval Workflow', path: '/approval' },
      { separator: true },
      { label: 'Schedule',             path: '/scheduling' },
      { separator: true },
      { label: 'Admin Panel',          path: '/admin' },
      { label: 'Settings',             path: '/settings' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { label: '📊 Open Report Center',          path: '/reports' },
      { separator: true },
      { label: '📋 Recipe Summary',              path: '/reports' },
      { label: '🧪 Chemical Consumption',        path: '/reports' },
      { label: '⚙️ Process Workflow',             path: '/reports' },
      { label: '📝 Laundry Recipe Sheet',        path: '/reports' },
      { label: '📄 Simple Recipe Sheet',          path: '/reports' },
      { separator: true },
      { label: '💰 Cost Analysis',               path: '/reports' },
      { label: '🧾 Washing Cost Sheet',       path: '/reports' },
      { label: '📐 Technical Spec Sheet',        path: '/reports' },
      { label: '📊 Costing Summary',             path: '/reports' },
      { separator: true },
      { label: '📦 Chemical Stock',              path: '/reports' },
      { label: '👤 Buyer-wise Report',           path: '/reports' },
      { label: '📅 Monthly Summary',             path: '/reports' },
      { separator: true },
      { label: '📈 Analytics',                   path: '/analytics' },
      { label: '🌿 EIM Score',                   path: '/eim-score' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Chat',                 path: '/chat' },
      { label: 'Mail',                 path: '/mail' },
      { label: 'Notifications',        path: '/notifications' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'Help Center',          path: '/help' },
      { label: 'User Manual',          path: '/manual' },
      { separator: true },
      { label: 'About Laundry Pro',    action: 'about' },
    ],
  },
]

// ── Single dropdown ────────────────────────────────────────────────────────────
function MenuDropdown({
  menu,
  open,
  onOpen,
  onClose,
}: {
  menu: MenuDef
  open: boolean
  onOpen: () => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { toggleSidebar, theme, setTheme } = useUIStore()
  const { logout } = useAuthStore()
  const ref = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  const handleItem = (item: MenuItem) => {
    if ('separator' in item && item.separator) return
    const mi = item as MenuAction
    onClose()
    if (mi.path) { navigate(mi.path); return }
    switch (mi.action) {
      case 'logout':      logout(); navigate('/login'); break
      case 'print':       window.print(); break
      case 'toggleSidebar': toggleSidebar(); break
      case 'toggleTheme': setTheme(theme === 'dark' ? 'light' : 'dark'); break
      case 'about':
        alert('Laundry Pro — Wash Recipe Management System v2.0\n© 2025 All rights reserved.')
        break
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={open ? onClose : onOpen}
        className={`px-3 py-1 text-[13px] font-medium rounded transition-colors select-none ${
          open
            ? 'bg-indigo-600 text-white'
            : 'text-foreground/80 hover:bg-muted hover:text-foreground'
        }`}
      >
        {menu.label}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-0.5 min-w-[210px] bg-popover border border-border rounded-md shadow-lg z-[200] py-1 animate-in fade-in slide-in-from-top-1 duration-100">
          {menu.items.map((item, i) => {
            if ('separator' in item && item.separator) {
              return <div key={i} className="my-1 border-t border-border/60" />
            }
            const mi = item as MenuAction
            return (
              <button
                key={i}
                onClick={() => handleItem(mi)}
                className="w-full flex items-center justify-between px-4 py-1.5 text-[13px] text-left text-foreground hover:bg-indigo-600 hover:text-white transition-colors"
              >
                <span>{mi.label}</span>
                {mi.shortcut && (
                  <span className="ml-6 text-[11px] text-muted-foreground group-hover:text-white/70 shrink-0">
                    {mi.shortcut}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Search result types ──────────────────────────────────────────────────────
interface SearchResult {
  type: 'recipe' | 'chemical'
  id: string
  title: string
  subtitle: string
  path: string
}

// ── Header ─────────────────────────────────────────────────────────────────────
export const Header = () => {
  const { theme, setTheme, toggleSidebarHidden, sidebarHidden } = useUIStore()
  const { user } = useAuthStore()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Register global keyboard shortcuts
  useKeyboardShortcuts()

  // ── Universal search ────────────────────────────────────────────────────────
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }

    setSearchLoading(true)
    setSearchOpen(true)
    const lowerQ = query.toLowerCase().trim()
    const results: SearchResult[] = []

    try {
      // Search recipes
      const recipes = await db.recipes.toArray()
      for (const r of recipes) {
        const fields = [
          r.recipe_no, r.customer_name, r.style, r.color,
          r.wash_type, r.factory_name, r.recipe_ref, r.remarks,
          (r as any).po, (r as any).ob_no, (r as any).final_wash,
        ].filter(Boolean).join(' ').toLowerCase()

        if (fields.includes(lowerQ)) {
          results.push({
            type: 'recipe',
            id: r.id,
            title: r.recipe_no,
            subtitle: `${r.customer_name} · ${r.style} · ${r.wash_type}`,
            path: `/recipes/builder?id=${r.id}`,
          })
        }
      }

      // Search chemicals
      const chemicals = await db.chemicals.toArray()
      for (const c of chemicals) {
        const fields = [c.name, c.category, c.supplier, c.remarks].filter(Boolean).join(' ').toLowerCase()
        if (fields.includes(lowerQ)) {
          results.push({
            type: 'chemical',
            id: c.id,
            title: c.name,
            subtitle: `${c.category} · Stock: ${c.current_stock} ${c.unit} · ${c.supplier || ''}`,
            path: '/chemicals',
          })
        }
      }

      // Search processes
      const processes = await db.processes.toArray()
      for (const p of processes) {
        const fields = [p.name, p.category, p.description].filter(Boolean).join(' ').toLowerCase()
        if (fields.includes(lowerQ)) {
          results.push({
            type: 'chemical', // reuse type styling
            id: p.id,
            title: p.name,
            subtitle: `Process · ${p.category}`,
            path: '/processes',
          })
        }
      }
    } catch (err) {
      console.error('[Search]', err)
    }

    setSearchResults(results.slice(0, 15))
    setSearchLoading(false)
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) performSearch(searchQuery)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery, performSearch])

  // Close search dropdown on outside click
  useEffect(() => {
    if (!searchOpen) return
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [searchOpen])

  // Keyboard shortcut: Ctrl+K to focus search / open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const navigate = useNavigate()

  const handleSearchSelect = (result: SearchResult) => {
    setSearchOpen(false)
    setPaletteOpen(false)
    setSearchQuery('')
    navigate(result.path)
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-[100] select-none">
      {/* ── Row 1: Menu bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-3 py-0.5 border-b border-border/60 bg-card/95 backdrop-blur-sm">
        {/* Sidebar show/hide toggle (visible always) */}
        <button
          onClick={toggleSidebarHidden}
          title={sidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
          className="p-1.5 rounded hover:bg-muted transition-colors mr-2 text-muted-foreground hover:text-foreground"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Menu items */}
        {MENU_BAR.map((menu) => (
          <MenuDropdown
            key={menu.label}
            menu={menu}
            open={openMenu === menu.label}
            onOpen={() => setOpenMenu(menu.label)}
            onClose={() => setOpenMenu(null)}
          />
        ))}
      </div>

      {/* ── Row 2: Toolbar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Universal Search */}
        <div ref={searchRef} className="flex items-center gap-4 flex-1 max-w-lg relative">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search recipes, chemicals, processes... (Ctrl+K)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setSearchOpen(true)}
              className="w-full pl-9 pr-9 py-1.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchOpen(false); searchInputRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search dropdown results */}
          {searchOpen && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-[300] max-h-80 overflow-y-auto">
              {searchLoading && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto mb-2" />
                  Searching...
                </div>
              )}
              {!searchLoading && searchResults.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No results for "{searchQuery}"
                </div>
              )}
              {!searchLoading && searchResults.map(result => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSearchSelect(result)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-600 hover:text-white transition-colors"
                >
                  <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                    result.type === 'recipe'
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {result.type === 'recipe'
                      ? <FileText className="w-3.5 h-3.5" />
                      : <FlaskConical className="w-3.5 h-3.5" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{result.title}</div>
                    <div className="text-[11px] text-muted-foreground group-hover:text-white/70 truncate">{result.subtitle}</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Supabase Sync Indicator */}
          <SyncIndicator />

          {/* Offline / Online indicator */}
          <OfflineIndicator />

          {/* Keyboard shortcuts hint */}
          <button
            onClick={() => setPaletteOpen(true)}
            title="Keyboard shortcuts (Ctrl+K)"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors hidden md:block"
          >
            <Keyboard className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <button className="p-1.5 rounded-lg hover:bg-muted transition-colors relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
          </button>

          {/* User */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-border">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            {user && (
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium max-w-[100px] truncate">{user.name}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Command Palette Overlay ───────────────────────────────────────── */}
      {paletteOpen && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
          onClick={() => { setPaletteOpen(false); setSearchQuery(''); setSearchResults([]) }}
        >
          <div className="w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search recipes, chemicals, processes... or type > for commands"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
              />
              <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded border border-border font-mono">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {searchQuery.startsWith('>') ? (
                /* ── Command mode ── */
                <div className="py-2">
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Commands</p>
                  {SHORTCUT_LIST.map((sc, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2 hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors"
                      onClick={() => { setPaletteOpen(false); setSearchQuery(''); setSearchResults([]) }}
                    >
                      <span className="text-sm">{sc.description}</span>
                      <kbd className="px-1.5 py-0.5 text-[10px] bg-black/20 rounded font-mono">{sc.keys}</kbd>
                    </div>
                  ))}
                </div>
              ) : searchLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto mb-2" />
                  Searching...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map(result => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSearchSelect(result)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-600 hover:text-white transition-colors"
                  >
                    <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                      result.type === 'recipe'
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {result.type === 'recipe'
                        ? <FileText className="w-3.5 h-3.5" />
                        : <FlaskConical className="w-3.5 h-3.5" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{result.title}</div>
                      <div className="text-[11px] text-muted-foreground group-hover:text-white/70 truncate">{result.subtitle}</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </button>
                ))
              ) : searchQuery ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No results for "{searchQuery}"
                </div>
              ) : (
                <div className="py-3">
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Quick Actions</p>
                  {[
                    { label: 'New Recipe', path: '/recipes/builder', icon: FileText, shortcut: 'Ctrl+N' },
                    { label: 'Chemical Master', path: '/chemicals', icon: FlaskConical },
                    { label: 'Reports', path: '/reports', icon: BarChart3 },
                  ].map(item => (
                    <button key={item.path}
                      onClick={() => { navigate(item.path); setPaletteOpen(false); setSearchQuery('') }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm flex-1">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="px-1.5 py-0.5 text-[10px] bg-black/20 rounded font-mono">{item.shortcut}</kbd>
                      )}
                    </button>
                  ))}
                  <div className="my-1.5 border-t border-border/50" />
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Tip</p>
                  <p className="px-4 py-2 text-[11px] text-muted-foreground">
                    Type <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">&gt;</kbd> to see all keyboard shortcuts
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
