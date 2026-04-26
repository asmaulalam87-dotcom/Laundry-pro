import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useUIStore } from '@/stores/ui-store'
import {
  LayoutDashboard,
  FileText,
  Calculator,
  FlaskConical,
  Settings,
  BarChart3,
  Calendar,
  Monitor,
  GitCompare,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  Database,
  Leaf,
  ClipboardList,
  Shield,
  Mail,
  Bell,
  User,
  HelpCircle,
  BookOpen,
  Workflow,
  ScanLine,
  Bot,
  ShieldCheck,
  Camera,
  AlertTriangle,
  Copy,
  DollarSign,
  History,
} from 'lucide-react'

// ── Menu Groups ────────────────────────────────────────────────────────────────
const menuGroups = [
  {
    label: 'Main',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard',        path: '/' },
      { icon: FileText,        label: 'Recipes',          path: '/recipes' },
      { icon: Calculator,      label: 'Costing',          path: '/costing' },
      { icon: Database,        label: 'Costing List',     path: '/costing-list' },
      { icon: BookOpen,        label: 'Templates',        path: '/templates' },
    ],
  },
  {
    label: 'Smart Tools',
    items: [
      { icon: Bot,             label: 'AI Assistant',     path: '/ai-assistant' },
      { icon: Camera,          label: 'Photo Scanner',    path: '/recipe-scanner' },
      { icon: ScanLine,        label: 'Barcode Scanner',  path: '/scanner' },
      { icon: ShieldCheck,     label: 'Approval',         path: '/approval' },
      { icon: Calculator,      label: 'Batch Calc',       path: '/batch-calculator' },
      { icon: AlertTriangle,   label: 'Stock Alerts',     path: '/stock-alerts' },
      { icon: Copy,            label: 'Recipe Cloner',    path: '/recipe-cloner' },
      { icon: DollarSign,      label: 'Cost Estimator',   path: '/cost-estimator' },
    ],
  },
  {
    label: 'Lab & Quality',
    items: [
      { icon: FlaskConical,    label: 'Chemicals',        path: '/chemicals' },
      { icon: Workflow,        label: 'Processes',        path: '/processes' },
      { icon: Leaf,            label: 'EIM Score',        path: '/eim-score' },
    ],
  },
  {
    label: 'Production',
    items: [
      { icon: Calendar,        label: 'Schedule',         path: '/scheduling' },
      { icon: Monitor,         label: 'Shop Floor',       path: '/shop-floor' },
      { icon: ClipboardList,   label: 'Wash Requisition', path: '/wash-requisition' },
      { icon: GitCompare,      label: 'Compare',          path: '/compare' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { icon: BarChart3,       label: 'Analytics',        path: '/analytics' },
      { icon: BarChart3,       label: 'Data Analytics',   path: '/data-analytics' },
      { icon: BarChart3,       label: 'Reports',          path: '/reports' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { icon: MessageSquare,   label: 'Chat',             path: '/chat' },
      { icon: Mail,            label: 'Mail',             path: '/mail' },
      { icon: Bell,            label: 'Notifications',    path: '/notifications' },
    ],
  },
  {
    label: 'System',
    items: [
      { icon: Shield,          label: 'Admin Panel',      path: '/admin' },
      { icon: History,        label: 'Version History', path: '/version-history' },
      { icon: User,            label: 'Profile',          path: '/profile' },
      { icon: Settings,        label: 'Settings',          path: '/settings' },
      { icon: HelpCircle,      label: 'Help',              path: '/help' },
      { icon: BookOpen,        label: 'User Manual',       path: '/manual' },
    ],
  },
]

// ── Collapsed sections state key ──
const COLLAPSED_KEY = 'sidebar_collapsed_sections'

function loadCollapsed(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(COLLAPSED_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch { return {} }
}

function saveCollapsed(state: Record<string, boolean>) {
  localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state))
}

export const Sidebar = () => {
  const { sidebarOpen, sidebarHidden, toggleSidebar, toggleSidebarHidden, setSidebarHidden } = useUIStore()
  const navigate = useNavigate()
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(loadCollapsed)

  // Persist collapsed state
  useEffect(() => {
    saveCollapsed(collapsedSections)
  }, [collapsedSections])

  if (sidebarHidden) return null

  const handleNavClick = (path: string) => {
    navigate(path)
    // Auto-hide sidebar on mobile/small screens (width < 1024)
    if (window.innerWidth < 1024) {
      setSidebarHidden(true)
    }
  }

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {}
    menuGroups.forEach(g => { allExpanded[g.label] = false })
    setCollapsedSections(allExpanded)
  }

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {}
    menuGroups.forEach(g => { allCollapsed[g.label] = true })
    setCollapsedSections(allCollapsed)
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-card border-r border-border transition-all duration-300 z-50 flex flex-col ${
        sidebarOpen ? 'w-56' : 'w-14'
      }`}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
        {sidebarOpen && (
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 min-w-0"
          >
            <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground truncate leading-tight">
              Laundry Pro
            </span>
          </button>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0 ml-auto"
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* ── Section expand/collapse controls ── */}
      {sidebarOpen && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50 shrink-0">
          <button onClick={expandAll}
            className="text-[9px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Expand All
          </button>
          <span className="text-[9px] text-muted-foreground/40">|</span>
          <button onClick={collapseAll}
            className="text-[9px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Collapse All
          </button>
        </div>
      )}

      {/* ── Scrollable Nav ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1.5 space-y-1 sidebar-scroll">
        {menuGroups.map((group) => {
          const isCollapsed = collapsedSections[group.label] === true
          return (
            <div key={group.label}>
              {/* Group header — clickable to toggle */}
              {sidebarOpen ? (
                <button
                  onClick={() => toggleSection(group.label)}
                  className="w-full flex items-center justify-between px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none hover:text-muted-foreground transition-colors group-header"
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
              ) : (
                <div className="border-t border-border/40 mx-1 my-1" />
              )}

              {/* Items — hidden when section is collapsed */}
              {(!isCollapsed || !sidebarOpen) && (
                <div className={`space-y-0.5 ${isCollapsed && sidebarOpen ? 'hidden' : ''}`}>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      onClick={() => handleNavClick(item.path)}
                      title={!sidebarOpen ? item.label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-2 py-2 rounded-md transition-all text-sm group ${
                          isActive
                            ? 'bg-indigo-600 text-white font-semibold shadow'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        } ${!sidebarOpen ? 'justify-center' : ''}`
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {sidebarOpen && (
                        <span className="truncate leading-tight">{item.label}</span>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Footer: Hide Sidebar button ──────────────────────────────── */}
      <div className="shrink-0 border-t border-border px-1.5 py-2">
        <button
          onClick={toggleSidebarHidden}
          title="Hide sidebar"
          className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm ${
            !sidebarOpen ? 'justify-center' : ''
          }`}
        >
          <PanelLeftClose className="w-4 h-4 shrink-0" />
          {sidebarOpen && <span className="truncate">Hide Sidebar</span>}
        </button>
      </div>
    </aside>
  )
}
