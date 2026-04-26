import { useState, useEffect } from 'react'
import {
  ChevronRight, ChevronDown, Printer, Download, FileSpreadsheet,
  FileText, Share2, BarChart3, FlaskConical, DollarSign, Factory,
  BookOpen, TrendingUp, ClipboardList, Layers
} from 'lucide-react'
import { LocalDB } from '@/services/local-db'
import type { Recipe, Chemical, CostingRecord } from '@/types'
import { toast } from 'sonner'
import { WashingCostSheet } from './WashingCostSheet'
import { TechnicalSpecSheet } from './TechnicalSpecSheet'
import { LaundryRecipeSheet, LaundryRecipeSheetSimple } from './LaundryRecipeSheet'
import { A4ReportLayout } from '@/components/reports/A4ReportLayout'

// ── Tree structure ─────────────────────────────────────────────────────────────
interface ReportNode {
  id: string
  label: string
  icon?: any          // lucide component
  emoji?: string
  desc?: string
  children?: ReportNode[]
  isLeaf?: boolean    // clickable report
  component?: 'washing_cost_sheet' | 'technical_spec_sheet' | 'laundry_recipe_sheet' | 'laundry_recipe_sheet_simple'
}

const REPORT_TREE: ReportNode[] = [
  {
    id: 'recipe',
    label: 'Recipe Reports',
    emoji: '📋',
    icon: BookOpen,
    children: [
      {
        id: 'recipe_summary',
        label: 'Recipe Summary',
        emoji: '📋',
        desc: 'Complete recipe overview with status breakdown',
        isLeaf: true,
      },
      {
        id: 'recipe_detailed',
        label: 'Detailed Reports',
        emoji: '📂',
        children: [
          {
            id: 'chemical',
            label: 'Chemical Consumption',
            emoji: '🧪',
            desc: 'Chemical usage analysis per recipe',
            isLeaf: true,
          },
          {
            id: 'workflow',
            label: 'Process Workflow',
            emoji: '⚙️',
            desc: 'Step-by-step process flow report',
            isLeaf: true,
          },
          {
            id: 'laundrysheet',
            label: 'Laundry Recipe Sheet',
            emoji: '📝',
            desc: 'Printable A4 laundry recipe sheet (Backup-14 style)',
            isLeaf: true,
            component: 'laundry_recipe_sheet',
          },
          {
            id: 'laundrysheet_simple',
            label: 'Simple Recipe Sheet',
            emoji: '📄',
            desc: 'Clean process sheet — no chemical summary, company name from Settings',
            isLeaf: true,
            component: 'laundry_recipe_sheet_simple',
          },
        ],
      },
      {
        id: 'recipe_batch',
        label: 'Batch & Comparison',
        emoji: '📂',
        children: [
          {
            id: 'batch_export',
            label: 'Batch PDF Book',
            emoji: '📚',
            desc: 'Export multiple recipes as a PDF book',
            isLeaf: true,
          },
          {
            id: 'recipe_compare',
            label: 'Recipe Comparison',
            emoji: '🔄',
            desc: 'Compare two or more recipes side-by-side',
            isLeaf: true,
          },
        ],
      },
    ],
  },
  {
    id: 'costing',
    label: 'Costing Reports',
    emoji: '💰',
    icon: DollarSign,
    children: [
      {
        id: 'cost',
        label: 'Cost Analysis',
        emoji: '💰',
        desc: 'Detailed cost breakdown per recipe',
        isLeaf: true,
      },
      {
        id: 'costing_docs',
        label: 'Costing Documents',
        emoji: '📂',
        children: [
          {
            id: 'cost_sheet',
            label: 'Costing Sheet',
            emoji: '📄',
            desc: 'Professional costing document',
            isLeaf: true,
          },
          {
            id: 'washing_cost_sheet',
            label: 'Washing Cost Sheet',
            emoji: '🧾',
            desc: 'Washing cost sheet with P&L',
            isLeaf: true,
            component: 'washing_cost_sheet',
          },
          {
            id: 'technical_spec_sheet',
            label: 'Technical Spec Sheet',
            emoji: '📐',
            desc: 'Wash & dry process technical specification',
            isLeaf: true,
            component: 'technical_spec_sheet',
          },
        ],
      },
      {
        id: 'costing_summary',
        label: 'Summary & History',
        emoji: '📂',
        children: [
          {
            id: 'cost_summary',
            label: 'Costing Summary',
            emoji: '📊',
            desc: 'High-level cost overview across all recipes',
            isLeaf: true,
          },
          {
            id: 'cost_history',
            label: 'Costing History',
            emoji: '📜',
            desc: 'Historical costing data and trends',
            isLeaf: true,
          },
          {
            id: 'cost_details',
            label: 'Costing Details',
            emoji: '🔍',
            desc: 'Granular line-item cost details',
            isLeaf: true,
          },
        ],
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    emoji: '📈',
    icon: TrendingUp,
    children: [
      {
        id: 'buyer',
        label: 'Buyer-wise Report',
        emoji: '👤',
        desc: 'Performance and cost analysis by buyer/customer',
        isLeaf: true,
      },
      {
        id: 'monthly',
        label: 'Monthly Summary',
        emoji: '📅',
        desc: 'Monthly production and costing performance',
        isLeaf: true,
      },
      {
        id: 'audit_trail',
        label: 'Audit Trail',
        emoji: '📜',
        desc: 'Full change history log',
        isLeaf: true,
      },
    ],
  },
  {
    id: 'chemical_reports',
    label: 'Chemical Reports',
    emoji: '🧪',
    icon: FlaskConical,
    children: [
      {
        id: 'stock_report',
        label: 'Chemical Stock',
        emoji: '📦',
        desc: 'Current stock levels and low-stock alerts',
        isLeaf: true,
      },
      {
        id: 'chem_usage',
        label: 'Chemical Usage',
        emoji: '🧪',
        desc: 'Chemical consumption per wash type / buyer',
        isLeaf: true,
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    emoji: '🏭',
    icon: Factory,
    children: [
      {
        id: 'machine_util',
        label: 'Machine Utilization',
        emoji: '🏭',
        desc: 'Machine usage and capacity reports',
        isLeaf: true,
      },
      {
        id: 'wash_req',
        label: 'Wash Requisition',
        emoji: '🧾',
        desc: 'Summary of all wash request orders',
        isLeaf: true,
      },
    ],
  },
]

// ── Flatten to get all leaf nodes ─────────────────────────────────────────────
function flatLeaves(nodes: ReportNode[]): ReportNode[] {
  const out: ReportNode[] = []
  function walk(n: ReportNode) {
    if (n.isLeaf) out.push(n)
    n.children?.forEach(walk)
  }
  nodes.forEach(walk)
  return out
}
const ALL_LEAVES = flatLeaves(REPORT_TREE)

// ── Tree Node component ────────────────────────────────────────────────────────
function TreeNode({
  node,
  depth,
  selected,
  onSelect,
  defaultOpen,
}: {
  node: ReportNode
  depth: number
  selected: string
  onSelect: (n: ReportNode) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? depth === 0)
  const hasChildren = (node.children?.length ?? 0) > 0
  const isSelected = selected === node.id

  const indent = depth * 14

  if (node.isLeaf) {
    return (
      <button
        onClick={() => onSelect(node)}
        style={{ paddingLeft: indent + 8 }}
        className={`w-full flex items-center gap-2 py-1.5 pr-3 rounded-md text-sm transition-colors text-left ${
          isSelected
            ? 'bg-indigo-600 text-white font-semibold'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <span className="text-base leading-none shrink-0">{node.emoji}</span>
        <span className="truncate">{node.label}</span>
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ paddingLeft: indent + 4 }}
        className="w-full flex items-center gap-1.5 py-1.5 pr-3 rounded-md text-sm font-semibold text-foreground hover:bg-muted transition-colors"
      >
        <span className="w-4 h-4 shrink-0 flex items-center justify-center">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
        <span className="text-base leading-none shrink-0">{node.emoji}</span>
        <span className="truncate">{node.label}</span>
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {node.children!.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              defaultOpen={depth < 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// A4-wrapped inline report content for standard reports
// ═══════════════════════════════════════════════════════════════════════════════
function A4InlineReport({
  reportId,
  title,
  reportType,
  reportData,
  recipes,
  chemicals,
  costings,
}: {
  reportId: string
  title: string
  reportType: string
  reportData: any
  recipes: Recipe[]
  chemicals: Chemical[]
  costings: CostingRecord[]
}) {
  return (
    <A4ReportLayout
      reportId={reportId}
      title={title}
      orientation="portrait"
      showQR={false}
      statusBadge={reportType === 'recipe_summary' ? `${recipes.length} Recipes` : reportType === 'chemical' ? `${chemicals.length} Items` : undefined}
      statusColor={reportType === 'recipe_summary' ? 'indigo' : reportType === 'chemical' ? 'purple' : 'blue'}
    >
      {/* Recipe Summary */}
      {reportType === 'recipe_summary' && reportData.byStatus && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Recipes', value: reportData.totalRecipes, color: 'blue' },
              { label: 'Draft', value: reportData.byStatus.Draft, color: 'gray' },
              { label: 'Pending', value: reportData.byStatus.Pending, color: 'yellow' },
              { label: 'Finalized', value: reportData.byStatus.Finalized, color: 'green' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`p-3 bg-${color}-50 rounded-lg text-center`}>
                <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
                <div className="text-xs text-gray-600 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {Object.keys(reportData.byWashType).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">By Wash Type</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(reportData.byWashType).map(([type, count]: any) => (
                  <span key={type} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
                    {type}: <b>{count}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chemical */}
      {reportType === 'chemical' && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Chemicals', value: reportData.totalChemicals, color: 'purple' },
            { label: 'Low Stock', value: reportData.lowStock, color: 'red' },
            { label: `Total Value ($)`, value: reportData.totalValue?.toFixed(2), color: 'green' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`p-4 bg-${color}-50 rounded-lg text-center`}>
              <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Stock */}
      {reportType === 'stock_report' && reportData.chemicals && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300 text-left">
              <th className="py-2 px-3">Chemical</th>
              <th className="py-2 px-3 text-right">Stock (kg)</th>
              <th className="py-2 px-3 text-right">Min (kg)</th>
              <th className="py-2 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {reportData.chemicals.map((c: any, i: number) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 px-3">{c.name}</td>
                <td className="py-2 px-3 text-right">{c.current}</td>
                <td className="py-2 px-3 text-right">{c.minimum}</td>
                <td className="py-2 px-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    c.status === 'LOW' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Cost analysis */}
      {reportType === 'cost' && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Records', value: reportData.totalCostings, color: 'blue' },
            { label: 'Avg Cost/Piece ($)', value: reportData.avgCostPerPiece?.toFixed(2), color: 'indigo' },
            { label: 'Total Cost ($)', value: reportData.totalCost?.toFixed(2), color: 'emerald' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`p-4 bg-${color}-50 rounded-lg text-center`}>
              <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Default / other */}
      {!['recipe_summary','chemical','stock_report','cost'].includes(reportType) && (
        <div className="text-center py-10 text-gray-400">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{reportData.message || 'Report content will appear here'}</p>
          <p className="text-xs mt-1">This report type is coming soon.</p>
        </div>
      )}
    </A4ReportLayout>
  )
}

// ── Main Reports page ──────────────────────────────────────────────────────────
export const Reports = () => {
  const [selectedId, setSelectedId] = useState('recipe_summary')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [costings, setCostings] = useState<CostingRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [reportData, setReportData] = useState<any>(null)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [r, c, co] = await Promise.all([
      LocalDB.getAll<Recipe>('recipes'),
      LocalDB.getAll<Chemical>('chemicals'),
      LocalDB.getAll<CostingRecord>('costing_records'),
    ])
    setRecipes(r); setChemicals(c); setCostings(co)
  }

  const selectedNode = ALL_LEAVES.find(l => l.id === selectedId)

  const handleSelect = (node: ReportNode) => {
    setSelectedId(node.id)
    setReportData(null)
    setShowExport(false)
  }

  const handleGenerate = async () => {
    setLoading(true)
    try {
      await new Promise(r => setTimeout(r, 400))
      let data: any = {}
      switch (selectedId) {
        case 'recipe_summary':
          data = {
            title: 'Recipe Summary Report',
            totalRecipes: recipes.length,
            byStatus: {
              Draft: recipes.filter(r => r.status === 'Draft').length,
              Pending: recipes.filter(r => r.status === 'Pending').length,
              Approved: recipes.filter(r => r.status === 'Approved').length,
              Finalized: recipes.filter(r => r.status === 'Finalized').length,
            },
            byWashType: recipes.reduce((acc: any, r) => {
              acc[r.wash_type || 'Unknown'] = (acc[r.wash_type || 'Unknown'] || 0) + 1
              return acc
            }, {}),
          }
          break
        case 'chemical':
          data = {
            title: 'Chemical Consumption Report',
            totalChemicals: chemicals.length,
            lowStock: chemicals.filter(c => c.current_stock <= c.minimum_stock_threshold).length,
            totalValue: chemicals.reduce((sum, c) => sum + (c.current_stock * c.price_per_kg), 0),
          }
          break
        case 'cost':
          data = {
            title: 'Cost Analysis Report',
            totalCostings: costings.length,
            avgCostPerPiece: costings.length > 0
              ? costings.reduce((sum, c) => sum + c.cost_per_piece, 0) / costings.length : 0,
            totalCost: costings.reduce((sum, c) => sum + c.total_cost, 0),
          }
          break
        case 'stock_report':
          data = {
            title: 'Chemical Stock Report',
            chemicals: chemicals.map(c => ({
              name: c.name,
              current: c.current_stock,
              minimum: c.minimum_stock_threshold,
              status: c.current_stock <= c.minimum_stock_threshold ? 'LOW' : 'OK',
            })),
          }
          break
        default:
          data = { title: selectedNode?.label ?? 'Report', message: 'Report generated successfully' }
      }
      setReportData(data)
      setShowExport(true)
      toast.success('Report generated!')
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const isSheetComponent = selectedNode?.component === 'washing_cost_sheet'
    || selectedNode?.component === 'technical_spec_sheet'
    || selectedNode?.component === 'laundry_recipe_sheet'
    || selectedNode?.component === 'laundry_recipe_sheet_simple'

  return (
    <div className="flex gap-4 h-[calc(100vh-130px)]">

      {/* ── Left Tree Sidebar ──────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-bold text-foreground">Report Center</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Select a report type</p>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 sidebar-scroll">
          {REPORT_TREE.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selected={selectedId}
              onSelect={handleSelect}
              defaultOpen={true}
            />
          ))}
        </div>
      </aside>

      {/* ── Right Content Panel ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">

        {/* Report header */}
        <div className="bg-card border border-border rounded-xl px-5 py-4 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <span className="text-2xl">{selectedNode?.emoji ?? '📊'}</span>
                {selectedNode?.label ?? 'Reports'}
              </h1>
              {selectedNode?.desc && (
                <p className="text-sm text-muted-foreground mt-0.5">{selectedNode.desc}</p>
              )}
            </div>
            {/* Breadcrumb */}
            <div className="text-xs text-muted-foreground text-right hidden md:block">
              Reports &rsaquo; {selectedNode?.label}
            </div>
          </div>
        </div>

        {/* Sheet components (no generate needed) */}
        {isSheetComponent ? (
          <div className="bg-card border border-border rounded-xl p-5 flex-1">
            {selectedNode?.component === 'washing_cost_sheet' && <WashingCostSheet />}
            {selectedNode?.component === 'technical_spec_sheet' && <TechnicalSpecSheet />}
            {selectedNode?.component === 'laundry_recipe_sheet' && <LaundryRecipeSheet />}
            {selectedNode?.component === 'laundry_recipe_sheet_simple' && <LaundryRecipeSheetSimple />}
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-5 shrink-0 no-print">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Filters & Parameters
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Select Recipe</label>
                  <select
                    value={selectedRecipeId}
                    onChange={e => setSelectedRecipeId(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- All Recipes --</option>
                    {recipes.map(r => (
                      <option key={r.id} value={r.id}>{r.recipe_no} — {r.customer_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Date Range</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <><span className="animate-spin">⏳</span> Generating...</>
                  ) : (
                    <><BarChart3 className="w-4 h-4" /> Generate Report</>
                  )}
                </button>

                {/* Export bar */}
                {showExport && (
                  <div className="flex items-center gap-2 border-l border-border pl-3">
                    <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-muted/80 text-sm">
                      <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                    <button onClick={() => toast.info('PDF export coming soon')} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-muted/80 text-sm">
                      <FileText className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button onClick={() => toast.info('Excel export coming soon')} className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg hover:bg-muted/80 text-sm">
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                    </button>
                    <button
                      onClick={() => {
                        const text = `Report: ${reportData?.title || selectedNode?.label} — Laundry Pro`
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 border border-green-500/30 text-green-600 rounded-lg hover:bg-green-500/25 text-sm"
                    >
                      <Share2 className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Report Preview — now wrapped in A4 page */}
            {reportData && (
              <div className="flex-1">
                <A4InlineReport
                  reportId={`inline-report-${selectedId}`}
                  title={reportData.title || selectedNode?.label || 'Report'}
                  reportType={selectedId}
                  reportData={reportData}
                  recipes={recipes}
                  chemicals={chemicals}
                  costings={costings}
                />
              </div>
            )}

            {/* Empty state before generate */}
            {!reportData && !loading && (
              <div className="flex-1 bg-card border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-muted-foreground py-16 no-print">
                <div className="text-5xl mb-4">{selectedNode?.emoji ?? '📊'}</div>
                <p className="font-semibold text-lg">{selectedNode?.label}</p>
                <p className="text-sm mt-1">{selectedNode?.desc}</p>
                <button
                  onClick={handleGenerate}
                  className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-sm"
                >
                  Generate Report
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
