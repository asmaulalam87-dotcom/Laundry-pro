import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LocalDB } from '@/services/local-db'
import type { CostingRecord } from '@/types'

interface CostingItem extends CostingRecord {
  style?: string
  recipe_no?: string
  customer?: string
  total_cost_per_garment?: number
  batch_total_cost?: number
}

interface Stats {
  total: number
  avgCostPc: number
  highestBatch: number
  latestStyle: string
}

export function CostingList() {
  const [costings, setCostings] = useState<CostingItem[]>([])
  const [filteredCostings, setFilteredCostings] = useState<CostingItem[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, avgCostPc: 0, highestBatch: 0, latestStyle: '-' })
  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [customers, setCustomers] = useState<string[]>([])
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id: string; info: string }>({ open: false, id: '', info: '' })

  useEffect(() => {
    loadCostings()
  }, [])

  useEffect(() => {
    filterData()
  }, [costings, search, customerFilter, sortOrder])

  const loadCostings = async () => {
    try {
      const data = await LocalDB.getAll<CostingItem>('costing_records')
      const sorted = data.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      setCostings(sorted)
      
      // Extract unique customers
      const uniqueCustomers = [...new Set(data.map(c => c.customer_name).filter(Boolean))] as string[]
      setCustomers(uniqueCustomers.sort())
    } catch (error) {
      console.error('Failed to load costings:', error)
    }
  }

  const filterData = () => {
    let filtered = costings.filter(c => {
      const matchSearch = (c.style || c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.id || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.recipe_no || '').toLowerCase().includes(search.toLowerCase())
      const matchCustomer = !customerFilter || c.customer_name === customerFilter
      return matchSearch && matchCustomer
    })

    if (sortOrder === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    } else {
      filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    }

    setFilteredCostings(filtered)
    updateStats(filtered)
  }

  const updateStats = (data: CostingItem[]) => {
    const total = data.length
    const avg = total > 0 ? data.reduce((sum, c) => sum + (c.cost_per_piece || 0), 0) / total : 0
    const highest = total > 0 ? Math.max(...data.map(c => c.total_cost || 0)) : 0
    const latest = total > 0 ? data[0]?.style || data[0]?.name || '-' : '-'

    setStats({ total, avgCostPc: avg, highestBatch: highest, latestStyle: latest })
  }

  const resetFilters = () => {
    setSearch('')
    setCustomerFilter('')
    setSortOrder('newest')
  }

  const confirmDelete = (id: string, info: string) => {
    setDeleteModal({ open: true, id, info })
  }

  const handleDelete = async () => {
    if (deleteModal.id) {
      await LocalDB.delete('costing_records', deleteModal.id)
      setDeleteModal({ open: false, id: '', info: '' })
      loadCostings()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-gray-400 hover:text-white text-sm">← Back to Dashboard</Link>
          <h1 className="text-2xl font-bold text-white mt-1">All Costing Records</h1>
          <p className="text-gray-400">Manage industrial financial models</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadCostings} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors">
            🔄 Refresh
          </button>
          <Link to="/costing" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">
            💰 Laundry Costing
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4 hover:border-indigo-500 transition-colors">
          <div className="text-3xl">📜</div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Total Costings</div>
            <div className="text-xl font-bold text-white">{stats.total}</div>
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4 hover:border-emerald-500 transition-colors">
          <div className="text-3xl">💰</div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Avg Cost/Pc</div>
            <div className="text-xl font-bold text-emerald-400">${stats.avgCostPc.toFixed(2)}</div>
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4 hover:border-amber-500 transition-colors">
          <div className="text-3xl">🚀</div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Highest Batch</div>
            <div className="text-xl font-bold text-amber-400">${stats.highestBatch.toLocaleString()}</div>
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-center gap-4 hover:border-pink-500 transition-colors">
          <div className="text-3xl">🕒</div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Latest Entry</div>
            <div className="text-lg font-bold text-white truncate">{stats.latestStyle}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Style, ID, Recipe..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Customer</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Customers</option>
              {customers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Sort Date</label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={resetFilters} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Costing ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cost/Pc</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Cost</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredCostings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="text-gray-500">
                      <div className="text-4xl mb-2">💰</div>
                      <div className="font-semibold">No Costings Found</div>
                      <div className="text-sm">Save your first costing from the Studio to see it here.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCostings.map((costing) => (
                  <tr key={costing.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{costing.id?.substring(0, 8)}...</td>
                    <td className="px-4 py-3 text-gray-300">{new Date(costing.created_at || 0).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-semibold text-white">{costing.name || '-'}</td>
                    <td className="px-4 py-3 text-gray-300">{costing.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">${(costing.cost_per_piece || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400">${(costing.total_cost || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/reports?recipe_id=${costing.recipe_id}`} className="text-indigo-400 hover:text-indigo-300 mr-3">View</Link>
                      <button onClick={() => confirmDelete(costing.id!, `${costing.name} (${costing.id})`)} className="text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">Confirm Delete</h3>
              <p className="text-gray-400">Delete this costing record permanently?</p>
              <p className="text-sm text-gray-500 mt-2">{deleteModal.info}</p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDeleteModal({ open: false, id: '', info: '' })} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
