/**
 * Google Drive Integration Service
 * 
 * Uses the Google Identity Services (GIS) library for authentication
 * and the Google Drive API v3 for file operations.
 * 
 * Setup: Go to https://console.cloud.google.com/
 * 1. Create a project
 * 2. Enable Google Drive API
 * 3. Create OAuth 2.0 Client ID (Web application)
 * 4. Add your domain to Authorized JavaScript Origins
 * 5. Copy the Client ID into Settings → Admin Panel → Google Drive Client ID
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GDriveConfig {
  clientId: string
  connected: boolean
  userEmail: string | null
  lastSyncAt: string | null
}

export interface GDriveFile {
  id: string
  name: string
  modifiedTime: string
  size: number
}

const GDRIVE_CONFIG_KEY = 'gdrive_config'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'

// ── Config helpers ─────────────────────────────────────────────────────────────

export function loadGDriveConfig(): GDriveConfig {
  try {
    const raw = localStorage.getItem(GDRIVE_CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { clientId: '', connected: false, userEmail: null, lastSyncAt: null }
}

export function saveGDriveConfig(config: GDriveConfig): void {
  localStorage.setItem(GDRIVE_CONFIG_KEY, JSON.stringify(config))
}

// ── Google API script loader ───────────────────────────────────────────────────

let gapiLoaded = false
let gisLoaded = false

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

async function loadGapi(): Promise<void> {
  if (gapiLoaded) return
  await loadScript('https://apis.google.com/js/api.js')
  await new Promise<void>((resolve) => {
    ;(window as any).gapi.load('client', () => resolve())
  })
  gapiLoaded = true
}

async function loadGis(): Promise<void> {
  if (gisLoaded) return
  await loadScript('https://accounts.google.com/gsi/client')
  gisLoaded = true
}

// ── Token management ───────────────────────────────────────────────────────────

let accessToken: string | null = null

function getAccessToken(): string | null {
  return accessToken || sessionStorage.getItem('gdrive_access_token')
}

function setAccessToken(token: string | null) {
  accessToken = token
  if (token) {
    sessionStorage.setItem('gdrive_access_token', token)
  } else {
    sessionStorage.removeItem('gdrive_access_token')
  }
}

// ── Connect / Authenticate ─────────────────────────────────────────────────────

/**
 * Initialize Google API client and authenticate the user.
 * Returns the user's email on success.
 */
export async function connectGoogleDrive(): Promise<{ success: boolean; email?: string; error?: string }> {
  const config = loadGDriveConfig()
  if (!config.clientId) {
    return { success: false, error: 'Google Drive Client ID not configured. Set it in Admin Panel → Google Drive.' }
  }

  try {
    // Load both libraries
    await Promise.all([loadGapi(), loadGis()])

    // Initialize gapi client
    await (window as any).gapi.client.init({
      discoveryDocs: [DISCOVERY_DOC],
    })

    // Use GIS token client to get access token
    const tokenClient = await new Promise<any>((resolve, reject) => {
      try {
        const tc = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: config.clientId,
          scope: SCOPES,
          callback: (response: any) => {
            if (response.error) {
              reject(new Error(response.error))
              return
            }
            setAccessToken(response.access_token)
            resolve(tc)
          },
          error_callback: (error: any) => {
            reject(new Error(error.message || 'Authentication failed'))
          },
        })
        // Request access token (shows popup)
        tc.requestAccessToken({ prompt: '' })
      } catch (err) {
        reject(err)
      }
    })

    // Get user info
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    }).then(r => r.json())

    // Save connected state
    config.connected = true
    config.userEmail = userInfo.email || null
    saveGDriveConfig(config)

    return { success: true, email: userInfo.email }
  } catch (err: any) {
    console.error('[GDrive] Connection failed:', err)
    return { success: false, error: err?.message || 'Failed to connect to Google Drive' }
  }
}

/**
 * Disconnect from Google Drive (revoke token).
 */
export async function disconnectGoogleDrive(): Promise<void> {
  const token = getAccessToken()
  if (token) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`)
    } catch {}
  }
  setAccessToken(null)
  const config = loadGDriveConfig()
  config.connected = false
  config.userEmail = null
  config.lastSyncAt = null
  saveGDriveConfig(config)
}

// ── File operations ────────────────────────────────────────────────────────────

/**
 * Upload a JSON backup file to Google Drive.
 * Creates in appDataFolder or root based on visibility.
 */
export async function uploadToGDrive(
  fileName: string,
  content: string,
  folderId?: string
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  const token = getAccessToken()
  if (!token) {
    return { success: false, error: 'Not connected to Google Drive' }
  }

  try {
    // Check if file already exists (update instead of create)
    const existingFile = await findFileByName(fileName)

    const metadata: any = {
      name: fileName,
      mimeType: 'application/json',
    }

    if (folderId) {
      metadata.parents = [folderId]
    }

    const boundary = '-------314159265358979323846'
    const body = [
      `--${boundary}`,
      `Content-Type: application/json; charset=UTF-8`,
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: application/json`,
      '',
      content,
      `--${boundary}--`,
    ].join('\r\n')

    let response: Response

    if (existingFile) {
      // Update existing file
      response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: body,
        }
      )
    } else {
      // Create new file
      response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: body,
        }
      )
    }

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Upload failed')
    }

    const result = await response.json()

    // Update last sync time
    const config = loadGDriveConfig()
    config.lastSyncAt = new Date().toISOString()
    saveGDriveConfig(config)

    return { success: true, fileId: result.id }
  } catch (err: any) {
    console.error('[GDrive] Upload failed:', err)
    return { success: false, error: err?.message || 'Upload failed' }
  }
}

/**
 * List backup files from Google Drive.
 */
export async function listGDriveBackups(): Promise<{ success: boolean; files?: GDriveFile[]; error?: string }> {
  const token = getAccessToken()
  if (!token) {
    return { success: false, error: 'Not connected to Google Drive' }
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name contains 'laundry-pro-backup' and trashed=false&spaces=drive&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Failed to list files')
    }

    const result = await response.json()
    return {
      success: true,
      files: (result.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        size: parseInt(f.size || '0'),
      })),
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to list files' }
  }
}

/**
 * Download a file from Google Drive by ID.
 */
export async function downloadFromGDrive(fileId: string): Promise<{ success: boolean; content?: string; error?: string }> {
  const token = getAccessToken()
  if (!token) {
    return { success: false, error: 'Not connected to Google Drive' }
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || 'Download failed')
    }

    const content = await response.text()
    return { success: true, content }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Download failed' }
  }
}

/**
 * Delete a file from Google Drive by ID.
 */
export async function deleteFromGDrive(fileId: string): Promise<{ success: boolean; error?: string }> {
  const token = getAccessToken()
  if (!token) {
    return { success: false, error: 'Not connected to Google Drive' }
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!response.ok && response.status !== 204) {
      throw new Error('Delete failed')
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Delete failed' }
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function findFileByName(name: string): Promise<{ id: string } | null> {
  const token = getAccessToken()
  if (!token) return null

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${name}' and trashed=false&spaces=drive&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    if (!response.ok) return null

    const result = await response.json()
    const files = result.files || []
    return files.length > 0 ? files[0] : null
  } catch {
    return null
  }
}

/**
 * Check if Google Drive is connected and token is valid.
 */
export async function checkGDriveConnection(): Promise<boolean> {
  const token = getAccessToken()
  if (!token) return false

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.ok
  } catch {
    return false
  }
}
