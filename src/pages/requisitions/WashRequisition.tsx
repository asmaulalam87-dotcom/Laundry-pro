import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LocalDB } from '@/services/local-db'

interface Requisition {
  id?: string
  customer: string
  style: string
  qty?: number
  target_price?: number
  notes: string
  status: 'Pending' | 'Approved' | 'Rejected'
  requester_id?: string
  requester_name?: string
  created_at: string
}

export function WashRequisition() {
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    customer: '',
    style: '',
    qty: '',
    target_price: '',
    notes: '',
    status: 'Pending' as Requisition['status']
  })

  useEffect(() => {
    loadRequisitions()
  }, [])

  const loadRequisitions = async () => {
    try {
      const data = await LocalDB.getAll<Requisition>('wash_requisitions')
      setRequisitions(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    } catch (error) {
      console.error('Failed to load requisitions:', error)
    }
  }

  const openModal = (item?: Requisition) => {
    if (item) {
      setEditingId(item.id || null)
      setFormData({
        customer: item.customer,
        style: item.style,
        qty: item.qty?.toString() || '',
        target_price: item.target_price?.toString() || '',
        notes: item.notes,
        status: item.status
      })
    } else {
      setEditingId(null)
      setFormData({ customer: '', style: '', qty: '', target_price: '', notes: '', status: 'Pending' })
    }
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
  }

  const handleSubmit = async () => {
    if (!formData.customer || !formData.style || !formData.notes) {
      alert('Please fill all required fields')
      return
    }

    const payload: Requisition = {
      customer: formData.customer,
      style: formData.style,
      qty: parseFloat(formData.qty) || 0,
      target_price: parseFloat(formData.target_price) || 0,
      notes: formData.notes,
      status: formData.status,
      requester_id: 'current-user',
      requester_name: 'Current User',
      created_at: new Date().toISOString()
    }

    try {
      if (editingId) {
        const existing = requisitions.find(r => r.id === editingId)
        if (existing && existing.id) {
          await LocalDB.update('wash_requisitions', { ...existing, ...payload, id: existing.id })
        }
      } else {
        await LocalDB.add('wash_requisitions', payload)
      }
      closeModal()
      loadRequisitions()
    } catch (error) {
      console.error('Failed to save requisition:', error)
    }
  }

  const deleteRequisition = async (id: string) => {
    if (confirm('Delete this requisition?')) {
      await LocalDB.delete('wash_requisitions', id)
      loadRequisitions()
    }
  }

  const getStatusClass = (status: Requisition['status']) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'Rejected': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Wash Costing Requisition
          </h1>
          <p className="text-gray-400">Submit and manage wash costing requests</p>
        </div>
        <button onClick={() => openModal()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">
          + New Requisition
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Customer</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Style</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Qty</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Target Price</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Requested By</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {requisitions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-500">
                  <div className="text-4xl mb-2">📋</div>
                  <div>No requisitions found</div>
                </td>
              </tr>
            ) : (
              requisitions.map((req) => (
                <tr key={req.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 text-gray-300">{new Date(req.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-medium text-white">{req.customer}</td>
                  <td className="px-4 py-3 text-gray-300">{req.style}</td>
                  <td className="px-4 py-3 text-gray-300">{req.qty || '-'}</td>
                  <td className="px-4 py-3 text-gray-300">{req.target_price ? `$${req.target_price.toFixed(2)}` : '-'}</td>
                  <td className="px-4 py-3 text-gray-300">{req.requester_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusClass(req.status)}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openModal(req)} className="text-indigo-400 hover:text-indigo-300 mr-3">Edit</button>
                    <button onClick={() => deleteRequisition(req.id!)} className="text-red-400 hover:text-red-300">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h3 className="font-semibold text-white">{editingId ? 'Edit Requisition' : 'New Requisition'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Customer / Buyer *</label>
                  <input
                    type="text"
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    placeholder="e.g. H&M"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Style / Fit *</label>
                  <input
                    type="text"
                    value={formData.style}
                    onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                    placeholder="e.g. SLIM FIT DENIM"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Order Target Quantity</label>
                  <input
                    type="number"
                    value={formData.qty}
                    onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                    placeholder="1000"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Target Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.target_price}
                    onChange={(e) => setFormData({ ...formData, target_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Wash Reference / Notes *</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Describe the wash finish or reference sample..."
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>
              {editingId && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Requisition['status'] })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-4 py-3 border-t border-gray-700">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">Cancel</button>
              <button onClick={handleSubmit} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white">
                {editingId ? 'Update' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
