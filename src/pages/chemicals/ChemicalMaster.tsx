import { useEffect, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { Plus, Edit, Trash2, AlertTriangle } from 'lucide-react'
import { LocalDB } from '@/services/local-db'
import type { Chemical } from '@/types'
import { toast } from 'sonner'

ModuleRegistry.registerModules([AllCommunityModule])

export const ChemicalMaster = () => {
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingChemical, setEditingChemical] = useState<Chemical | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: 'kg',
    price_per_kg: 0,
    current_stock: 0,
    minimum_stock_threshold: 50,
    supplier: '',
    remarks: '',
  })

  useEffect(() => {
    loadChemicals()
  }, [])

  const loadChemicals = async () => {
    setLoading(true)
    try {
      const data = await LocalDB.getAll<Chemical>('chemicals')
      setChemicals(data.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (error) {
      toast.error('Failed to load chemicals')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Chemical name is required')
      return
    }

    try {
      const chemicalData = {
        ...formData,
        id: editingChemical?.id || crypto.randomUUID(),
        created_at: editingChemical?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Chemical

      if (editingChemical) {
        await LocalDB.update('chemicals', chemicalData)
        toast.success('Chemical updated')
      } else {
        await LocalDB.add('chemicals', chemicalData)
        toast.success('Chemical added')
      }

      setShowModal(false)
      resetForm()
      await loadChemicals()
    } catch (error) {
      toast.error('Failed to save chemical')
    }
  }

  const handleEdit = (chemical: Chemical) => {
    setEditingChemical(chemical)
    setFormData({
      name: chemical.name,
      category: chemical.category,
      unit: chemical.unit,
      price_per_kg: chemical.price_per_kg,
      current_stock: chemical.current_stock,
      minimum_stock_threshold: chemical.minimum_stock_threshold,
      supplier: chemical.supplier || '',
      remarks: chemical.remarks || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this chemical?')) return
    try {
      await LocalDB.delete('chemicals', id)
      toast.success('Chemical deleted')
      await loadChemicals()
    } catch (error) {
      toast.error('Failed to delete chemical')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      unit: 'kg',
      price_per_kg: 0,
      current_stock: 0,
      minimum_stock_threshold: 50,
      supplier: '',
      remarks: '',
    })
    setEditingChemical(null)
  }

  const lowStockCount = chemicals.filter(c => c.current_stock <= c.minimum_stock_threshold).length

  const columnDefs = [
    { field: 'name', headerName: 'Chemical Name', minWidth: 180, cellStyle: { fontWeight: 'bold' } },
    { field: 'category', headerName: 'Category', minWidth: 130 },
    { 
      field: 'current_stock', 
      headerName: 'Current Stock', 
      minWidth: 130,
      cellRenderer: (params: any) => {
        const chem = params.data
        const isLow = chem.current_stock <= chem.minimum_stock_threshold
        return `<span class="${isLow ? 'text-red-600 font-bold' : ''}">${chem.current_stock} ${chem.unit}</span>`
      }
    },
    { 
      field: 'minimum_stock_threshold', 
      headerName: 'Min Threshold', 
      minWidth: 130,
      valueFormatter: (params: any) => `${params.value} kg`
    },
    { 
      field: 'price_per_kg', 
      headerName: 'Price/kg', 
      minWidth: 100,
      valueFormatter: (params: any) => `$${params.value.toFixed(2)}`
    },
    { field: 'supplier', headerName: 'Supplier', minWidth: 150 },
    {
      headerName: 'Actions',
      minWidth: 150,
      cellRenderer: (params: any) => {
        const chem = params.data
        return `
          <div style="display: flex; gap: 4px;">
            <button onclick="window.editChemical('${chem.id}')" class="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">Edit</button>
            <button onclick="window.deleteChemical('${chem.id}')" class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">Delete</button>
          </div>
        `
      }
    }
  ]

  ;(window as any).editChemical = (id: string) => {
    const chem = chemicals.find(c => c.id === id)
    if (chem) handleEdit(chem)
  }
  ;(window as any).deleteChemical = (id: string) => handleDelete(id)

  const defaultColDef = {
    flex: 1,
    sortable: true,
    filter: true,
    resizable: true,
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Chemical Master</h1>
          <p className="text-muted-foreground mt-1">Manage chemical inventory and stock</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Add Chemical
        </button>
      </div>

      {lowStockCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          <span className="text-yellow-700 dark:text-yellow-400 font-medium">
            {lowStockCount} chemical(s) are running low on stock!
          </span>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="ag-theme-alpine" style={{ height: 600 }}>
          <AgGridReact
            rowData={chemicals}
            columnDefs={columnDefs as any}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={20}
            loading={loading}
            rowHeight={50}
            headerHeight={45}
          />
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-2xl font-bold">{editingChemical ? 'Edit Chemical' : 'Add Chemical'}</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Chemical Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Caustic Soda"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Alkali"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Unit</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="kg">Kilogram (kg)</option>
                  <option value="ltr">Liter (ltr)</option>
                  <option value="pcs">Pieces (pcs)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Price per kg</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_per_kg}
                  onChange={(e) => setFormData({ ...formData, price_per_kg: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Current Stock</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Min Stock Threshold</label>
                <input
                  type="number"
                  value={formData.minimum_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, minimum_stock_threshold: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Supplier</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Remarks</label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Save
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
