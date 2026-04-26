import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LocalDB } from '@/services/local-db'
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  loadGDriveConfig,
  uploadToGDrive,
  listGDriveBackups,
  downloadFromGDrive,
  deleteFromGDrive,
  checkGDriveConnection,
  type GDriveConfig,
  type GDriveFile,
} from '@/services/gdrive-service'
import { db } from '@/services/local-db'
import { Cloud, CloudOff, Upload, Download, Trash2, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface UserProfile {
  id?: string
  username: string
  full_name: string
  email: string
  role: string
  designation?: string
  department?: string
  profile_photo?: string
  created_at: string
}

export function Profile() {
  const [profile, setProfile] = useState<UserProfile>({
    username: '',
    full_name: '',
    email: '',
    role: 'user',
    designation: '',
    department: '',
    created_at: ''
  })
  const [passwords, setPasswords] = useState({ new: '', confirm: '' })
  const [gdriveConfig, setGdriveConfig] = useState<GDriveConfig>(loadGDriveConfig())
  const [gdriveLoading, setGdriveLoading] = useState(false)
  const [gdriveError, setGdriveError] = useState<string | null>(null)
  const [gdriveFiles, setGdriveFiles] = useState<GDriveFile[]>([])
  const [gdriveUploading, setGdriveUploading] = useState(false)
  const [gdriveRestoring, setGdriveRestoring] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  // Refresh GDrive connection status on mount
  useEffect(() => {
    const check = async () => {
      const isValid = await checkGDriveConnection()
      if (!isValid && gdriveConfig.connected) {
        setGdriveConfig(prev => ({ ...prev, connected: false }))
      }
    }
    check()
  }, [])

  const loadProfile = async () => {
    try {
      // Get current user from auth store or default
      const users = await LocalDB.getAll<UserProfile>('users')
      if (users.length > 0) {
        setProfile(users[0])
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
    }
  }

  const saveProfile = async () => {
    if (passwords.new && passwords.new !== passwords.confirm) {
      alert('Passwords do not match')
      return
    }

    try {
      if (profile.id) {
        await LocalDB.update('users', { ...profile, id: profile.id })
      }
      alert('Profile updated successfully!')
      setPasswords({ new: '', confirm: '' })
    } catch (error) {
      console.error('Failed to save profile:', error)
    }
  }

  const getInitial = () => {
    return profile.full_name?.charAt(0).toUpperCase() || '?'
  }

  // ── Google Drive actions ─────────────────────────────────────────────────
  const handleConnect = async () => {
    setGdriveLoading(true)
    setGdriveError(null)
    const result = await connectGoogleDrive()
    if (result.success) {
      setGdriveConfig(loadGDriveConfig())
      // Load backups after connecting
      const listResult = await listGDriveBackups()
      if (listResult.success && listResult.files) setGdriveFiles(listResult.files)
    } else {
      setGdriveError(result.error || 'Connection failed')
    }
    setGdriveLoading(false)
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect from Google Drive? Your files on Drive will NOT be deleted.')) return
    await disconnectGoogleDrive()
    setGdriveConfig(loadGDriveConfig())
    setGdriveFiles([])
  }

  const handleUploadBackup = async () => {
    setGdriveUploading(true)
    setGdriveError(null)
    try {
      // Export all data from IndexedDB
      const data: Record<string, any[]> = {}
      const tables = ['recipes', 'chemicals', 'processes', 'costingRecords', 'users', 'app_settings', 'buyer_master', 'fabric_master', 'garment_type_master', 'process_group_master', 'wash_type_master'] as const
      for (const table of tables) {
        try {
          data[table] = await (db as any)[table].toArray()
        } catch {}
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const fileName = `laundry-pro-backup-${timestamp}.json`
      const content = JSON.stringify(data, null, 2)

      const result = await uploadToGDrive(fileName, content)
      if (result.success) {
        setGdriveConfig(loadGDriveConfig())
        // Refresh file list
        const listResult = await listGDriveBackups()
        if (listResult.success && listResult.files) setGdriveFiles(listResult.files)
      } else {
        setGdriveError(result.error || 'Upload failed')
      }
    } catch (err: any) {
      setGdriveError(err?.message || 'Upload failed')
    }
    setGdriveUploading(false)
  }

  const handleRestore = async (fileId: string, fileName: string) => {
    if (!confirm(`Restore from "${fileName}"? This will REPLACE all current data.`)) return
    setGdriveRestoring(fileId)
    setGdriveError(null)
    try {
      const result = await downloadFromGDrive(fileId)
      if (result.success && result.content) {
        const data = JSON.parse(result.content)
        // Import into IndexedDB
        for (const [tableName, rows] of Object.entries(data)) {
          try {
            const table = (db as any)[tableName]
            if (table) {
              await table.clear()
              if (Array.isArray(rows) && rows.length > 0) {
                await table.bulkAdd(rows)
              }
            }
          } catch (err) {
            console.warn(`[Restore] Failed to restore ${tableName}:`, err)
          }
        }
        alert('Data restored successfully! The page will reload.')
        window.location.reload()
      } else {
        setGdriveError(result.error || 'Download failed')
      }
    } catch (err: any) {
      setGdriveError(err?.message || 'Restore failed')
    }
    setGdriveRestoring(null)
  }

  const handleDeleteBackup = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}" from Google Drive?`)) return
    const result = await deleteFromGDrive(fileId)
    if (result.success) {
      setGdriveFiles(prev => prev.filter(f => f.id !== fileId))
    } else {
      setGdriveError(result.error || 'Delete failed')
    }
  }

  const handleRefreshFiles = async () => {
    setGdriveLoading(true)
    const result = await listGDriveBackups()
    if (result.success && result.files) {
      setGdriveFiles(result.files)
    } else {
      setGdriveError(result.error || 'Failed to list files')
    }
    setGdriveLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to="/" className="text-gray-400 hover:text-white text-sm">← Back to Dashboard</Link>
        <h1 className="text-2xl font-bold text-white mt-1">My Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        {/* Header with Avatar */}
        <div className="flex items-center gap-6 pb-6 border-b border-gray-700 mb-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center text-4xl font-bold text-white border-4 border-gray-600">
              {getInitial()}
            </div>
            <button
              className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white hover:bg-indigo-500"
              title="Upload Photo"
            >
              📷
            </button>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{profile.full_name || 'Unknown User'}</h2>
            <span className="inline-block mt-1 px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-sm font-medium border border-indigo-500/30">
              {profile.role?.toUpperCase() || 'USER'}
            </span>
            <div className="text-sm text-gray-400 mt-2">
              Joined: {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="space-y-4">
          <h3 className="font-semibold text-white">Personal Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Full Name</label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={profile.username}
                disabled
                className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Office Designation</label>
              <input
                type="text"
                value={profile.designation || ''}
                onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                placeholder="e.g., Wash Manager"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Department</label>
              <input
                type="text"
                value={profile.department || ''}
                onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                placeholder="e.g., R&D, Production"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
              />
            </div>
          </div>
        </div>

        {/* Security & Integrations */}
        <div className="space-y-4 mt-6 pt-6 border-t border-gray-700">
          <h3 className="font-semibold text-white">Security & Integrations</h3>

          {/* Google Drive Integration */}
          <div className="bg-gray-900/50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {gdriveConfig.connected ? (
                  <Cloud className="w-5 h-5 text-blue-400" />
                ) : (
                  <CloudOff className="w-5 h-5 text-gray-500" />
                )}
                <div>
                  <div className="font-medium text-white">Google Drive Integration</div>
                  <div className="text-sm text-gray-400">
                    {gdriveConfig.connected
                      ? <>Connected as <span className="text-blue-400">{gdriveConfig.userEmail}</span>
                        {gdriveConfig.lastSyncAt && (
                          <span className="text-gray-500"> · Last sync: {new Date(gdriveConfig.lastSyncAt).toLocaleString()}</span>
                        )}
                      </>
                      : 'Not connected — set Client ID in Admin Panel first'
                    }
                  </div>
                </div>
              </div>
              <div>
                {gdriveConfig.connected ? (
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={gdriveLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {gdriveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                    Connect Drive
                  </button>
                )}
              </div>
            </div>

            {/* Error message */}
            {gdriveError && (
              <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <span className="text-sm text-red-300">{gdriveError}</span>
                <button onClick={() => setGdriveError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
              </div>
            )}

            {/* Connected: show backup controls */}
            {gdriveConfig.connected && (
              <>
                {/* Upload backup */}
                <div className="flex items-center gap-3 pt-2 border-t border-gray-700/50">
                  <button
                    onClick={handleUploadBackup}
                    disabled={gdriveUploading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {gdriveUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {gdriveUploading ? 'Uploading...' : 'Backup to Drive'}
                  </button>
                  <button
                    onClick={handleRefreshFiles}
                    disabled={gdriveLoading}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${gdriveLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {/* File list */}
                {gdriveFiles.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-700/50">
                    <p className="text-xs text-gray-500">Cloud Backups ({gdriveFiles.length})</p>
                    {gdriveFiles.map(file => (
                      <div key={file.id} className="flex items-center justify-between p-2.5 bg-gray-800/50 rounded-lg">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white truncate">{file.name}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(file.modifiedTime).toLocaleString()}
                            {file.size > 0 && ` · ${(file.size / 1024).toFixed(1)} KB`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3">
                          <button
                            onClick={() => handleRestore(file.id, file.name)}
                            disabled={!!gdriveRestoring}
                            className="p-1.5 rounded hover:bg-emerald-600/20 text-emerald-400 disabled:opacity-50"
                            title="Restore this backup"
                          >
                            {gdriveRestoring === file.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteBackup(file.id, file.name)}
                            disabled={!!gdriveRestoring}
                            className="p-1.5 rounded hover:bg-red-600/20 text-red-400 disabled:opacity-50"
                            title="Delete from Drive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {gdriveFiles.length === 0 && !gdriveLoading && (
                  <p className="text-xs text-gray-500 text-center py-2">No backups found on Google Drive. Click "Backup to Drive" to create one.</p>
                )}
              </>
            )}
          </div>

          {/* Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">New Password</label>
              <input
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-700">
          <button onClick={() => loadProfile()} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">
            Reset
          </button>
          <button onClick={saveProfile} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
