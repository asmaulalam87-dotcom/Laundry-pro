import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LocalDB, db } from '@/services/local-db'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────────
interface User {
  id?: string
  username: string
  full_name: string
  email: string
  password?: string
  role: 'admin' | 'user' | 'viewer'
  status: 'active' | 'inactive'
  created_at: string
  allowed_menus?: string[]
}

interface CompanyProfile {
  id: string
  company_name: string
  company_address: string
  company_phone: string
  company_email: string
  company_logo?: string
}

interface DropdownOption {
  id?: number
  category: string
  value: string
}

interface SystemStats {
  recipes: number
  chemicals: number
  processes: number
  users: number
  costingRecords: number
  templates: number
}

type TabId = 'users' | 'company' | 'masterdata' | 'database' | 'system'

const MENU_ITEMS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'recipe_builder', label: 'Recipe Builder' },
  { value: 'recipe_list', label: 'All Recipes' },
  { value: 'eim_score', label: 'EIM Score' },
  { value: 'reports', label: 'Reports' },
  { value: 'compare', label: 'Compare' },
  { value: 'process_library', label: 'Process Library' },
  { value: 'chemical_master', label: 'Chemical Master' },
  { value: 'costing', label: 'Laundry Costing' },
  { value: 'master_data', label: 'Master Data' },
]

const MASTER_CATEGORIES = [
  { key: 'wash_type', label: 'Wash Types', icon: '🧼' },
  { key: 'machine_type', label: 'Machine Types', icon: '🏭' },
  { key: 'customer_name', label: 'Buyers', icon: '👥' },
  { key: 'recipe_stage', label: 'Recipe Stages', icon: '📈' },
  { key: 'item', label: 'Items / Garments', icon: '👕' },
  { key: 'final_wash', label: 'Final Wash', icon: '✨' },
  { key: 'chemical_category', label: 'Categories', icon: '🧪' },
  { key: 'factory_name', label: 'Factory Names', icon: '🏪' },
  { key: 'dry_process', label: 'Dry Process Operations', icon: '🎨' },
  { key: 'utility_factor', label: 'Machine Utility Factors', icon: '⚡' },
]

// ── Main Component ──────────────────────────────────────────────────────────────
export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('users')

  const TABS = [
    { id: 'users' as TabId, label: '👥 Users' },
    { id: 'company' as TabId, label: '🏢 Company Profile' },
    { id: 'masterdata' as TabId, label: '⚙️ Master Data' },
    { id: 'database' as TabId, label: '💾 Database' },
    { id: 'system' as TabId, label: '🖥️ System' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-muted-foreground hover:text-foreground text-sm">← Back to Dashboard</Link>
          <h1 className="text-2xl font-bold mt-1">Admin Panel</h1>
          <p className="text-muted-foreground text-sm">User management, master data, and system configuration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 font-medium text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-indigo-400 border-indigo-500'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'company' && <CompanyTab />}
      {activeTab === 'masterdata' && <MasterDataTab />}
      {activeTab === 'database' && <DatabaseTab />}
      {activeTab === 'system' && <SystemTab />}
    </div>
  )
}

// ── Users Tab ──────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [modal, setModal] = useState<{ open: boolean; user?: User }>({ open: false })

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    try { setUsers(await LocalDB.getAll<User>('users')) } catch { /* no users table */ }
  }

  const saveUser = async (u: User) => {
    try {
      if (u.id) {
        await LocalDB.update('users', { ...u, id: u.id })
      } else {
        await LocalDB.add('users', { ...u, id: crypto.randomUUID(), created_at: new Date().toISOString() })
      }
      toast.success(u.id ? 'User updated' : 'User created')
      setModal({ open: false })
      loadUsers()
    } catch { toast.error('Failed to save user') }
  }

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}"?`)) return
    try { await LocalDB.delete('users', id); toast.success('User deleted'); loadUsers() }
    catch { toast.error('Failed to delete') }
  }

  const toggleStatus = async (u: User) => {
    if (!u.id) return
    const updated = { ...u, id: u.id, status: u.status === 'active' ? 'inactive' : 'active' as 'active' | 'inactive' }
    await LocalDB.update('users', updated)
    loadUsers()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">User Management</h3>
        <button onClick={() => setModal({ open: true })} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm">
          + Add User
        </button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-indigo-600/10 border-b border-border">
              {['Username', 'Full Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No users found. Click "+ Add User" to create one.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-semibold">{u.username}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    u.role === 'admin' ? 'bg-red-500/20 text-red-400'
                    : u.role === 'user' ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-indigo-500/20 text-indigo-400'
                  }`}>{u.role}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleStatus(u)} className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    u.status === 'active' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/40' : 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
                  }`}>{u.status}</button>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setModal({ open: true, user: u })} className="text-indigo-400 hover:text-indigo-300 text-xs">✏️ Edit</button>
                    <button onClick={() => deleteUser(u.id!, u.username)} className="text-red-400 hover:text-red-300 text-xs">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal.open && <UserModal user={modal.user} onClose={() => setModal({ open: false })} onSave={saveUser} />}
    </div>
  )
}

function UserModal({ user, onClose, onSave }: { user?: User; onClose: () => void; onSave: (u: User) => void }) {
  const [form, setForm] = useState<User>({
    username: user?.username || '',
    full_name: user?.full_name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'user',
    status: user?.status || 'active',
    created_at: user?.created_at || new Date().toISOString(),
    id: user?.id,
    allowed_menus: user?.allowed_menus || MENU_ITEMS.map(m => m.value),
  })

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-base">{user?.id ? '✏️ Edit User' : '+ Add User'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Username *</label>
              <input type="text" value={form.username} disabled={!!user?.id}
                onChange={e => setForm({ ...form, username: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Full Name *</label>
              <input type="text" value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{user?.id ? 'Password (leave blank to keep)' : 'Password *'}</label>
              <input type="password" value={form.password || ''}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm"
                placeholder={user?.id ? 'Leave blank to keep current' : 'Enter password'} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as User['role'] })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm">
                <option value="admin">Administrator</option>
                <option value="user">User</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as User['status'] })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          {form.role !== 'admin' && (
            <div>
              <label className="block text-xs text-muted-foreground mb-2">Menu Access</label>
              <div className="grid grid-cols-2 gap-1 p-3 bg-muted/50 rounded-lg border border-border max-h-40 overflow-y-auto">
                {MENU_ITEMS.map(m => (
                  <label key={m.value} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={form.allowed_menus?.includes(m.value) ?? true}
                      onChange={e => {
                        const menus = e.target.checked
                          ? [...(form.allowed_menus || []), m.value]
                          : (form.allowed_menus || []).filter(x => x !== m.value)
                        setForm({ ...form, allowed_menus: menus })
                      }}
                      className="w-3.5 h-3.5 accent-indigo-600" />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 bg-muted hover:bg-muted/70 rounded-lg text-sm">Cancel</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">Save User</button>
        </div>
      </div>
    </div>
  )
}

// ── Company Tab ────────────────────────────────────────────────────────────────
function CompanyTab() {
  const [company, setCompany] = useState<CompanyProfile>({
    id: 'company_profile', company_name: '', company_address: '',
    company_phone: '', company_email: '', company_logo: ''
  })
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    LocalDB.getById<{ id: string; data: CompanyProfile }>('app_settings', 'company_profile').then(r => {
      if (r?.data) setCompany(r.data)
    }).catch(() => {})
  }, [])

  const save = async () => {
    await LocalDB.update('app_settings', { id: 'company_profile', data: company })
    localStorage.setItem('company_name', company.company_name)
    if (company.company_logo) localStorage.setItem('company_logo', company.company_logo)
    toast.success('Company profile saved!')
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Max 2MB logo file'); return }
    const reader = new FileReader()
    reader.onload = ev => setCompany({ ...company, company_logo: ev.target!.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Details */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-base mb-2">Company Details</h3>
        {([
          ['Company Name', 'company_name', 'text', 'e.g. Laundry Pro Bangladesh'],
          ['Address', 'company_address', 'text', 'Full company address'],
          ['Email', 'company_email', 'email', 'contact@example.com'],
          ['Phone', 'company_phone', 'text', '+880 1234 567890'],
        ] as [string, keyof CompanyProfile, string, string][]).map(([label, field, type, ph]) => (
          <div key={field}>
            <label className="block text-xs text-muted-foreground mb-1">{label}</label>
            <input type={type} value={(company[field] as string) || ''}
              onChange={e => setCompany({ ...company, [field]: e.target.value })}
              placeholder={ph}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        ))}
        <button onClick={save} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold mt-2">
          💾 Save Company Profile
        </button>
      </div>

      {/* Logo */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4">
        <h3 className="font-semibold text-base self-start">Company Logo</h3>
        <p className="text-xs text-muted-foreground self-start">Upload a logo to display on all generated reports. Max 2MB.</p>
        <div className="w-64 h-40 border-2 border-dashed border-border rounded-xl flex items-center justify-center bg-muted/30 overflow-hidden">
          {company.company_logo
            ? <img src={company.company_logo} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
            : <span className="text-muted-foreground text-sm">No Logo Uploaded</span>
          }
        </div>
        <div className="flex gap-3">
          <button onClick={() => logoRef.current?.click()} className="px-4 py-2 bg-muted hover:bg-muted/70 rounded-lg text-sm">
            📁 Browse Image
          </button>
          {company.company_logo && (
            <button onClick={() => setCompany({ ...company, company_logo: '' })} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm">
              🗑️ Remove
            </button>
          )}
        </div>
        <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} />
      </div>
    </div>
  )
}

// ── Master Data Tab ────────────────────────────────────────────────────────────
function MasterDataTab() {
  const [activeCat, setActiveCat] = useState('wash_type')
  const [options, setOptions] = useState<DropdownOption[]>([])
  const [newVal, setNewVal] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadOptions() }, [activeCat])

  const loadOptions = async () => {
    try {
      // Use Dexie index directly for reliability
      const all = await db.dropdown_options.where('category').equals(activeCat).toArray()
      setOptions(all)
    } catch (err) {
      console.error('loadOptions error:', err)
      setOptions([])
    }
  }

  const addOption = async () => {
    const v = newVal.trim()
    if (!v) return
    if (options.some(o => o.value.toLowerCase() === v.toLowerCase())) {
      toast.error('Option already exists'); return
    }
    setSaving(true)
    try {
      // Do NOT include id — Dexie auto-increments it
      await db.dropdown_options.add({ category: activeCat, value: v })
      setNewVal('')
      toast.success('✅ Option added')
      await loadOptions()
    } catch (err: any) {
      console.error('addOption error:', err)
      toast.error('Failed to add: ' + (err?.message || 'unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (opt: DropdownOption) => {
    if (!editVal.trim() || opt.id == null) return
    setSaving(true)
    try {
      // update() uses primary key (numeric id)
      await db.dropdown_options.update(opt.id, { value: editVal.trim() })
      setEditingId(null)
      toast.success('✅ Updated')
      await loadOptions()
    } catch (err: any) {
      console.error('saveEdit error:', err)
      toast.error('Failed to update: ' + (err?.message || 'unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const deleteOption = async (id: number) => {
    if (!confirm('Remove this option?')) return
    try {
      await db.dropdown_options.delete(id)
      toast.success('Removed')
      await loadOptions()
    } catch (err: any) {
      console.error('deleteOption error:', err)
      toast.error('Failed to delete')
    }
  }

  const activeCatInfo = MASTER_CATEGORIES.find(c => c.key === activeCat)

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-52 shrink-0 bg-card border border-border rounded-xl overflow-hidden">
        {MASTER_CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => { setActiveCat(cat.key); setEditingId(null) }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors border-b border-border last:border-0 ${
              activeCat === cat.key ? 'bg-indigo-600/20 text-indigo-400 font-semibold' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
            }`}>
            <span>{cat.icon}</span>{cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base">{activeCatInfo?.icon} {activeCatInfo?.label}</h3>
          <span className="text-xs text-muted-foreground">{options.length} options</span>
        </div>

        {/* Add Option */}
        <div className="flex gap-2 mb-5">
          <input
            type="text"
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && addOption()}
            placeholder={`Add new ${activeCatInfo?.label.toLowerCase() ?? 'option'}...`}
            className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={addOption}
            disabled={saving || !newVal.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '...' : '+ Add'}
          </button>
        </div>

        {/* Table */}
        {options.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-3xl mb-2">📭</div>
            <p>No options for this category yet.</p>
            <p className="text-xs mt-1">Type a name above and click + Add.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {options.map((opt, idx) => (
                <tr key={opt.id ?? idx} className="hover:bg-muted/30">
                  <td className="py-2 px-3 text-muted-foreground text-xs w-10">{idx + 1}</td>
                  <td className="py-2 px-3">
                    {editingId === opt.id ? (
                      <input
                        type="text"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(opt)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="w-full px-2 py-1 bg-muted border border-indigo-500 rounded text-sm focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium">{opt.value}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex justify-end gap-2">
                      {editingId === opt.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(opt)}
                            disabled={saving}
                            className="text-emerald-400 hover:text-emerald-300 text-xs px-2 py-1 bg-emerald-500/10 rounded disabled:opacity-50"
                          >✓ Save</button>
                          <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground text-xs px-2 py-1">✗</button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingId(opt.id!); setEditVal(opt.value) }}
                            className="text-indigo-400 hover:text-indigo-300 text-xs px-2 py-1 bg-indigo-500/10 rounded"
                          >✏️ Edit</button>
                          <button
                            onClick={() => deleteOption(opt.id!)}
                            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-500/10 rounded"
                          >🗑️ Del</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Database Tab ───────────────────────────────────────────────────────────────
function DatabaseTab() {
  const importRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const DB_TABLES = ['processes', 'chemicals', 'recipes', 'recipe_steps', 'recipe_step_chemicals',
    'dropdown_options', 'costing_records', 'users', 'templates']

  const exportDatabase = async () => {
    try {
      toast.loading('Preparing backup...', { id: 'export' })
      const data: Record<string, any[]> = {}
      for (const table of DB_TABLES) {
        try { data[table] = await LocalDB.getAll(table) } catch { data[table] = [] }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recipe_db_backup_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded!', { id: 'export' })
    } catch { toast.error('Export failed', { id: 'export' }) }
  }

  const importDatabase = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!confirm('WARNING: Importing will overwrite existing data. Continue?')) { e.target.value = ''; return }
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      toast.loading('Importing data...', { id: 'import' })
      for (const table of DB_TABLES) {
        if (data[table] && Array.isArray(data[table])) {
          try {
            const existing = await LocalDB.getAll(table)
            for (const item of existing) { try { await LocalDB.delete(table, (item as any).id) } catch {} }
            for (const item of data[table]) { try { await LocalDB.add(table, item) } catch {} }
          } catch {}
        }
      }
      toast.success('Import successful! Reloading...', { id: 'import' })
      setTimeout(() => window.location.reload(), 1500)
    } catch { toast.error('Invalid backup file', { id: 'import' }) }
    finally { setImporting(false); e.target.value = '' }
  }

  const clearDatabase = async () => {
    if (!confirm('CRITICAL: This will permanently delete ALL data. Are you absolutely sure?')) return
    const text = prompt('Type "DELETE" to confirm:')
    if (text !== 'DELETE') { toast('Cancelled'); return }
    try {
      toast.loading('Clearing...', { id: 'clear' })
      for (const table of DB_TABLES) {
        try {
          const all = await LocalDB.getAll(table)
          for (const item of all) { try { await LocalDB.delete(table, (item as any).id) } catch {} }
        } catch {}
      }
      toast.success('Database cleared! Reloading...', { id: 'clear' })
      setTimeout(() => window.location.reload(), 1500)
    } catch { toast.error('Failed to clear', { id: 'clear' }) }
  }

  const cards = [
    {
      title: 'Export Database (Backup)',
      desc: 'Download a JSON file of all data: recipes, chemicals, processes, users.',
      btn: '📥 Backup Now', color: 'indigo', action: exportDatabase
    },
    {
      title: 'Import Database (Restore)',
      desc: 'Restore data from a previously downloaded JSON backup file.',
      btn: '📤 Restore Backup', color: 'emerald', action: () => importRef.current?.click()
    },
    {
      title: 'Clear Database',
      desc: 'Wipe all data permanently. This action cannot be undone.',
      btn: '🗑️ Clear All Data', color: 'red', action: clearDatabase
    },
  ]

  return (
    <div className="space-y-4 max-w-2xl">
      {cards.map(c => (
        <div key={c.title} className={`bg-card border rounded-xl p-5 flex items-center justify-between ${
          c.color === 'red' ? 'border-red-500/30' : 'border-border'
        }`}>
          <div>
            <h4 className={`font-semibold ${c.color === 'red' ? 'text-red-400' : ''}`}>{c.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{c.desc}</p>
          </div>
          <button onClick={c.action} disabled={importing}
            className={`ml-6 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
              c.color === 'red' ? 'bg-red-600 hover:bg-red-500 text-white'
              : c.color === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}>
            {c.btn}
          </button>
        </div>
      ))}
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={importDatabase} />
    </div>
  )
}

// ── System Tab ─────────────────────────────────────────────────────────────────
function SystemTab() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [supabaseUrl, setSupabaseUrl] = useState(localStorage.getItem('supabase_url') || '')
  const [supabaseKey, setSupabaseKey] = useState(localStorage.getItem('supabase_anon_key') || '')
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_key') || '')
  const [gdriveClientId, setGdriveClientId] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gdrive_config') || '{}').clientId || '' } catch { return '' }
  })

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    const fetch = async (t: string) => { try { return (await LocalDB.getAll(t)).length } catch { return 0 } }
    setStats({
      recipes: await fetch('recipes'),
      chemicals: await fetch('chemicals'),
      processes: await fetch('processes'),
      users: await fetch('users'),
      costingRecords: await fetch('costing_records'),
      templates: await fetch('templates'),
    })
  }

  const saveSupabase = () => {
    localStorage.setItem('supabase_url', supabaseUrl)
    localStorage.setItem('supabase_anon_key', supabaseKey)
    // Reinitialize dynamic Supabase client
    import('@/services/supabase').then(({ saveSupabaseConfig }) => {
      saveSupabaseConfig({ url: supabaseUrl, anonKey: supabaseKey })
    })
    toast.success('Supabase config saved!')
  }

  const saveGemini = () => {
    localStorage.setItem('gemini_key', geminiKey)
    toast.success('Gemini API key saved!')
  }

  const saveGDriveConfig = () => {
    try {
      const config = JSON.parse(localStorage.getItem('gdrive_config') || '{}')
      config.clientId = gdriveClientId
      localStorage.setItem('gdrive_config', JSON.stringify(config))
      toast.success('Google Drive Client ID saved!')
    } catch {
      localStorage.setItem('gdrive_config', JSON.stringify({ clientId: gdriveClientId, connected: false, userEmail: null, lastSyncAt: null }))
      toast.success('Google Drive Client ID saved!')
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">System Information</h3>
        {stats ? (
          <div className="grid grid-cols-3 gap-4">
            {[
              ['📋 Recipes', stats.recipes, 'indigo'],
              ['🧪 Chemicals', stats.chemicals, 'cyan'],
              ['⚙️ Processes', stats.processes, 'violet'],
              ['👥 Users', stats.users, 'emerald'],
              ['💰 Costing Records', stats.costingRecords, 'amber'],
              ['📄 Templates', stats.templates, 'pink'],
            ].map(([label, val, color]) => (
              <div key={label as string} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-lg p-4 text-center`}>
                <div className="text-2xl font-bold">{val as number}</div>
                <div className="text-xs text-muted-foreground mt-1">{label as string}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-muted-foreground text-sm">Loading stats...</div>}
      </div>

      {/* Supabase Config */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-indigo-400 mb-1 flex items-center gap-2">☁️ Supabase Cloud Sync</h3>
        <p className="text-xs text-muted-foreground mb-4">Enter credentials from Supabase Project Settings › API to enable cloud sync.</p>
        <div className="space-y-3 max-w-lg">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Project URL</label>
            <input type="text" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Anon Key</label>
            <input type="password" value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)}
              placeholder="eyJh..."
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3">
            <button onClick={saveSupabase} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm">💾 Save Connection</button>
            <button onClick={async () => {
              saveSupabase()
              const { testConnection } = await import('@/services/supabase')
              const result = await testConnection()
              if (result.success) toast.success('Connection successful!')
              else toast.error(result.error || 'Connection failed')
            }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">🔄 Test Connection</button>
          </div>
        </div>
      </div>

      {/* Google Drive Config */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-blue-400 mb-1 flex items-center gap-2">☁️ Google Drive Integration</h3>
        <p className="text-xs text-muted-foreground mb-4">Backup recipes & data to Google Drive. Create an OAuth 2.0 Client ID at <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Google Cloud Console</a>.</p>
        <div className="space-y-3 max-w-lg">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Google Drive OAuth Client ID</label>
            <input type="text" value={gdriveClientId} onChange={e => setGdriveClientId(e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[10px] text-muted-foreground mt-1">1. Create project → 2. Enable Drive API → 3. Create OAuth Web Client → 4. Add your domain to Authorized Origins → 5. Paste Client ID here</p>
          </div>
          <button onClick={saveGDriveConfig} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm">💾 Save Client ID</button>
        </div>
      </div>

      {/* AI Config */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold text-emerald-400 mb-1 flex items-center gap-2">🤖 AI Configuration (Google Gemini)</h3>
        <p className="text-xs text-muted-foreground mb-4">Enable automated recipe suggestions from photos via Google Vision AI.</p>
        <div className="space-y-3 max-w-lg">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Google Gemini API Key</label>
            <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button onClick={saveGemini} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm">💾 Save API Key</button>
        </div>
      </div>

      {/* App Links */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Quick Links</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/chemicals" className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded-lg text-sm">🧪 Chemical Master</Link>
          <Link to="/processes" className="px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg text-sm">⚙️ Process Library</Link>
          <Link to="/settings" className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-sm">⚙️ App Settings</Link>
        </div>
      </div>
    </div>
  )
}
