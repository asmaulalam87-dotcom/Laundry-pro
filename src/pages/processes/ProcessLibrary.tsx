import { useState, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import { LocalDB } from '@/services/local-db'
import type { Process, Chemical } from '@/types'
import { toast } from 'sonner'

ModuleRegistry.registerModules([AllCommunityModule])

interface ProcessChemical {
  chemical_id: string
  chemical_name: string
  dosage: number
  unit: 'g/l' | 'ml/l' | '%' | 'g/kg'
}

export const ProcessLibrary = () => {
  const [processes, setProcesses] = useState<(Process & { chemicals?: ProcessChemical[] })[]>([])
  const [chemicals, setChemicals] = useState<Chemical[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProcess, setEditingProcess] = useState<Process | null>(null)
  const [filterText, setFilterText] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [categories, setCategories] = useState<string[]>([])

  const [formData, setFormData] = useState({
    name: '',
    category: 'Washing',
    default_temperature: '',
    default_time: '',
    default_non_op: '',
    default_lr: '',
    default_rpm: '',
    default_ph: '',
    default_remark: '',
  })

  const [processChemicals, setProcessChemicals] = useState<ProcessChemical[]>([])
  const [newChemical, setNewChemical] = useState({
    chemical_id: '',
    chemical_name: '',
    dosage: 0,
    unit: 'g/l' as const,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const chemicalsData = await LocalDB.getAll<Chemical>('chemicals')
      setChemicals(chemicalsData.sort((a, b) => a.name.localeCompare(b.name)))

      const processesData = await LocalDB.getAll<Process>('processes')
      
      // Load chemicals for each process
      const processesWithChemicals = await Promise.all(
        processesData.map(async (process) => {
          const chems = await LocalDB.getByIndex<any>('process_chemicals', 'process_id', process.id)
          return { ...process, chemicals: chems }
        })
      )

      setProcesses(processesWithChemicals.sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0)))

      // Extract unique categories
      const uniqueCats = [...new Set(processesData.map(p => p.category).filter(Boolean))]
      setCategories(uniqueCats)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Process name is required')
      return
    }

    try {
      const processData: any = {
        ...formData,
        id: editingProcess?.id || crypto.randomUUID(),
        default_temperature: parseFloat(formData.default_temperature) || 0,
        default_time: parseFloat(formData.default_time) || 0,
        default_non_op: parseFloat(formData.default_non_op) || 0,
        created_at: editingProcess?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (editingProcess) {
        await LocalDB.update('processes', processData)
        toast.success('Process updated')
      } else {
        await LocalDB.add('processes', processData)
        toast.success('Process added')
      }

      // Save process chemicals
      if (processChemicals.length > 0) {
        // Delete existing chemicals
        const existingChems = await LocalDB.getByIndex<any>('process_chemicals', 'process_id', processData.id)
        for (const chem of existingChems) {
          await LocalDB.delete('process_chemicals', chem.id)
        }

        // Add new chemicals
        for (const chem of processChemicals) {
          await LocalDB.add('process_chemicals', {
            id: crypto.randomUUID(),
            process_id: processData.id,
            ...chem,
          })
        }
      }

      setShowModal(false)
      resetForm()
      await loadData()
    } catch (error) {
      toast.error('Failed to save process')
    }
  }

  const handleEdit = (process: Process & { chemicals?: ProcessChemical[] }) => {
    setEditingProcess(process)
    setFormData({
      name: process.name,
      category: process.category,
      default_temperature: process.default_temperature?.toString() || '',
      default_time: process.default_time?.toString() || '',
      default_non_op: (process as any).default_non_op?.toString() || '',
      default_lr: process.default_lr || '',
      default_rpm: (process as any).default_rpm || '',
      default_ph: (process as any).default_ph || '',
      default_remark: process.description || '',
    })
    setProcessChemicals(process.chemicals || [])
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this process and its default chemicals?')) return
    try {
      const existingChems = await LocalDB.getByIndex<any>('process_chemicals', 'process_id', id)
      for (const chem of existingChems) {
        await LocalDB.delete('process_chemicals', chem.id)
      }
      await LocalDB.delete('processes', id)
      toast.success('Process deleted')
      await loadData()
    } catch (error) {
      toast.error('Failed to delete process')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Washing',
      default_temperature: '',
      default_time: '',
      default_non_op: '',
      default_lr: '',
      default_rpm: '',
      default_ph: '',
      default_remark: '',
    })
    setProcessChemicals([])
    setEditingProcess(null)
  }

  const addChemicalToProcess = () => {
    if (!newChemical.chemical_id) {
      toast.error('Select a chemical')
      return
    }

    if (processChemicals.some(c => c.chemical_id === newChemical.chemical_id)) {
      toast.error('Chemical already added')
      return
    }

    const selectedChem = chemicals.find(c => c.id === newChemical.chemical_id)
    if (!selectedChem) return

    setProcessChemicals([...processChemicals, {
      chemical_id: newChemical.chemical_id,
      chemical_name: selectedChem.name,
      dosage: newChemical.dosage,
      unit: newChemical.unit,
    }])

    setNewChemical({ chemical_id: '', chemical_name: '', dosage: 0, unit: 'g/l' })
  }

  const removeChemicalFromProcess = (index: number) => {
    setProcessChemicals(processChemicals.filter((_, i) => i !== index))
  }

  const filteredProcesses = processes.filter(process => {
    const matchText = !filterText || process.name.toLowerCase().includes(filterText.toLowerCase())
    const matchCat = !filterCategory || process.category === filterCategory
    return matchText && matchCat
  })

  const columnDefs = [
    { 
      field: 'name', 
      headerName: 'Name', 
      minWidth: 180,
      cellStyle: { fontWeight: 'bold' }
    },
    { 
      field: 'category', 
      headerName: 'Category', 
      minWidth: 130,
      cellRenderer: (params: any) => `<span class="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-semibold">${params.value || '-'}</span>`
    },
    { 
      field: 'default_temperature', 
      headerName: 'Temp', 
      minWidth: 80,
      align: 'center',
      valueFormatter: (params: any) => params.value ? `${params.value}°C` : '-'
    },
    { 
      field: 'default_time', 
      headerName: 'Op. Time', 
      minWidth: 90,
      align: 'center',
      valueFormatter: (params: any) => params.value ? `${params.value} min` : '-'
    },
    { 
      field: 'default_non_op', 
      headerName: 'Non-Op', 
      minWidth: 90,
      align: 'center',
      cellRenderer: (params: any) => {
        const nonOp = params.data.default_non_op || (params.data as any).non_op_time
        return nonOp ? `${nonOp} min` : '-'
      }
    },
    { 
      field: 'default_lr', 
      headerName: 'L/R', 
      minWidth: 80,
      align: 'center',
      valueFormatter: (params: any) => params.value || '-'
    },
    { 
      field: 'default_ph', 
      headerName: 'Ph', 
      minWidth: 70,
      align: 'center',
      cellRenderer: (params: any) => (params.data as any).default_ph || '-'
    },
    { 
      field: 'default_rpm', 
      headerName: 'RPM', 
      minWidth: 80,
      align: 'center',
      cellRenderer: (params: any) => (params.data as any).default_rpm || '-'
    },
    {
      headerName: 'Chemicals',
      minWidth: 140,
      cellRenderer: (params: any) => {
        const chems = params.data.chemicals || []
        if (chems.length === 0) return '<span class="text-muted-foreground">None</span>'
        return `<span class="px-2 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-semibold">🧪 ${chems.length} chemical${chems.length > 1 ? 's' : ''}</span>`
      }
    },
    {
      headerName: 'Actions',
      minWidth: 120,
      cellRenderer: (params: any) => {
        const process = params.data
        return `
          <div style="display: flex; gap: 4px;">
            <button onclick="window.editProcess('${process.id}')" class="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">Edit</button>
            <button onclick="window.deleteProcess('${process.id}')" class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">Delete</button>
          </div>
        `
      }
    }
  ]

  ;(window as any).editProcess = (id: string) => {
    const process = processes.find(p => p.id === id)
    if (process) handleEdit(process as any)
  }
  ;(window as any).deleteProcess = (id: string) => handleDelete(id)

  const defaultColDef = {
    flex: 1,
    sortable: true,
    filter: true,
    resizable: true,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <a href="/" className="text-sm text-muted-foreground hover:text-primary">← Back to Dashboard</a>
          <h1 className="text-3xl font-bold mt-2">Process Library</h1>
          <p className="text-muted-foreground mt-1">Manage washing processes with default chemicals</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" /> Add Process
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search</label>
            <input
              type="text"
              placeholder="Search processes..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setFilterText(''); setFilterCategory('') }}
              className="w-full px-4 py-2 bg-muted border border-border rounded-lg hover:bg-muted/80"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* AG Grid Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="ag-theme-alpine" style={{ height: 600 }}>
          <AgGridReact
            rowData={filteredProcesses}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-2xl font-bold">{editingProcess ? 'Edit Process' : 'Add Process'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Process Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Enzyme Wash"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  list="category-list"
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Washing, Finishing..."
                />
                <datalist id="category-list">
                  <option value="Pre-Treatment" />
                  <option value="Washing" />
                  <option value="Bleaching" />
                  <option value="Finishing" />
                  <option value="Drying" />
                  <option value="Dry Process" />
                  <option value="Other" />
                </datalist>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Default Temp</label>
                  <input
                    type="text"
                    value={formData.default_temperature}
                    onChange={(e) => setFormData({ ...formData, default_temperature: e.target.value })}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
                    placeholder="e.g., 60°C"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Default Time</label>
                  <input
                    type="text"
                    value={formData.default_time}
                    onChange={(e) => setFormData({ ...formData, default_time: e.target.value })}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
                    placeholder="e.g., 20 min"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Non-Op Time</label>
                  <input
                    type="text"
                    value={formData.default_non_op}
                    onChange={(e) => setFormData({ ...formData, default_non_op: e.target.value })}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
                    placeholder="e.g., 5 min"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Default Ltr</label>
                  <input
                    type="text"
                    value={formData.default_lr}
                    onChange={(e) => setFormData({ ...formData, default_lr: e.target.value })}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
                    placeholder="e.g., 1:8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Default RPM</label>
                  <input
                    type="text"
                    value={formData.default_rpm}
                    onChange={(e) => setFormData({ ...formData, default_rpm: e.target.value })}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
                    placeholder="e.g., 400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Default Ph</label>
                  <input
                    type="text"
                    value={formData.default_ph}
                    onChange={(e) => setFormData({ ...formData, default_ph: e.target.value })}
                    className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
                    placeholder="e.g., 6.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Default Remark / Process Note</label>
                <input
                  type="text"
                  value={formData.default_remark}
                  onChange={(e) => setFormData({ ...formData, default_remark: e.target.value })}
                  className="w-full px-4 py-2 bg-muted border border-border rounded-lg"
                  placeholder="e.g., Add enzyme slowly, Slow agitation..."
                />
              </div>

              {/* Chemical Section */}
              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-lg font-semibold mb-2">🧪 Default Chemicals</h3>
                <p className="text-sm text-muted-foreground mb-4">These chemicals will be auto-added when this process is used in a recipe.</p>

                {/* Chemical List */}
                <div className="mb-4 max-h-48 overflow-y-auto space-y-2">
                  {processChemicals.length === 0 && (
                    <p className="text-center py-4 text-muted-foreground">No chemicals added yet</p>
                  )}
                  {processChemicals.map((chem, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <span className="flex-1 font-medium">{chem.chemical_name}</span>
                      <span className="text-sm text-muted-foreground">{chem.dosage} {chem.unit}</span>
                      <button onClick={() => removeChemicalFromProcess(idx)} className="p-1 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500/30">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Chemical */}
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Chemical</label>
                    <select
                      value={newChemical.chemical_id}
                      onChange={(e) => setNewChemical({ ...newChemical, chemical_id: e.target.value, chemical_name: chemicals.find(c => c.id === e.target.value)?.name || '' })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                    >
                      <option value="">Select Chemical</option>
                      {chemicals.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Dosage</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newChemical.dosage || ''}
                      onChange={(e) => setNewChemical({ ...newChemical, dosage: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Unit</label>
                    <select
                      value={newChemical.unit}
                      onChange={(e) => setNewChemical({ ...newChemical, unit: e.target.value as any })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg"
                    >
                      <option value="g/l">g/l</option>
                      <option value="%">%</option>
                      <option value="ml/l">ml/l</option>
                      <option value="g/kg">g/kg</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={addChemicalToProcess}
                      className="w-full px-4 py-2 bg-green-500/20 text-green-600 border border-green-500/40 rounded-lg hover:bg-green-500/30 font-medium"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-border flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-muted border border-border rounded-lg hover:bg-muted/80">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                Save Process
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
