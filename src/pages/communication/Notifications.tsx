import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LocalDB } from '@/services/local-db'
import type { Recipe, Chemical } from '@/types'

interface Alert {
  type: 'error' | 'warning' | 'info' | 'success'
  icon: string
  title: string
  desc: string
  action?: string
  actionLabel?: string
}

export function Notifications() {
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    const alertList: Alert[] = []

    try {
      // Check for stale Draft recipes (older than 7 days)
      const recipes = await LocalDB.getAll<Recipe>('recipes')
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

      recipes.forEach((r: Recipe) => {
        const status = (r.status || 'Draft').toLowerCase()
        const created = new Date(r.created_at || 0).getTime()

        if ((status === 'draft' || status === 'pending') && created < sevenDaysAgo) {
          const daysOld = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24))
          alertList.push({
            type: 'warning',
            icon: '⏰',
            title: `Recipe "${r.recipe_no || 'Untitled'}" is still in ${r.status || 'Draft'}`,
            desc: `Created ${daysOld} days ago for ${r.customer_name || 'Unknown customer'}. Consider finalizing or deleting it.`,
            action: `/recipes/builder?id=${r.id}`,
            actionLabel: 'Open Recipe'
          })
        }
      })

      // Check for low chemical stock
      const chemicals = await LocalDB.getAll<Chemical>('chemicals')
      chemicals.forEach((c: Chemical) => {
        const stock = c.current_stock || 0
        const min = c.minimum_stock_threshold || 0

        if (min > 0 && stock <= min) {
          alertList.push({
            type: stock <= 0 ? 'error' : 'warning',
            icon: stock <= 0 ? '🚨' : '📦',
            title: `Chemical "${c.name}" ${stock <= 0 ? 'is OUT OF STOCK' : 'is running low'}`,
            desc: `Current: ${stock.toFixed(2)} kg | Minimum: ${min.toFixed(2)} kg`,
            action: '/chemicals',
            actionLabel: 'View Stock'
          })
        }
      })

      // Check for recipes finalized today (success notifications)
      const todayStr = new Date().toISOString().split('T')[0]
      recipes.forEach((r: Recipe) => {
        if ((r.status || '').toLowerCase() === 'finalized' && r.updated_at?.startsWith(todayStr)) {
          alertList.push({
            type: 'success',
            icon: '✅',
            title: `Recipe "${r.recipe_no || 'Untitled'}" finalized`,
            desc: `Customer: ${r.customer_name || '-'} | Style: ${r.style || '-'}`
          })
        }
      })

      // Load any stored notifications
      try {
        const storedNotifs = await LocalDB.getAll<{ id?: string; message?: string; type?: string; is_read?: boolean }>('notifications')
        storedNotifs.forEach(n => {
          alertList.push({
            type: (n.type as any) || 'info',
            icon: n.type === 'requisition' ? '📝' : '🔔',
            title: n.message || '',
            desc: n.is_read ? '' : '(Unread)'
          })
        })
      } catch (e) {
        // notifications store may not exist
      }

    } catch (error) {
      console.error('Error generating notifications:', error)
    }

    // Sort: errors first, then warnings, then info, then success
    const priority: Record<string, number> = { error: 0, warning: 1, info: 2, success: 3 }
    alertList.sort((a, b) => (priority[a.type] || 9) - (priority[b.type] || 9))

    setAlerts(alertList)
  }

  const markAllRead = async () => {
    try {
      const notifs = await LocalDB.getAll<{ id?: string; is_read?: boolean }>('notifications')
      for (const n of notifs) {
        if (!n.is_read && n.id) {
          await LocalDB.update('notifications', { ...n, is_read: true, id: n.id })
        }
      }
      loadNotifications()
    } catch (e) {
      console.error(e)
    }
  }

  const getColorScheme = (type: Alert['type']) => {
    switch (type) {
      case 'error': return { bg: 'bg-red-500/10', border: 'border-red-500/30', badge: 'text-red-400' }
      case 'warning': return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', badge: 'text-amber-400' }
      case 'success': return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', badge: 'text-emerald-400' }
      default: return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', badge: 'text-blue-400' }
    }
  }

  // Count by type
  const counts = { error: 0, warning: 0, info: 0, success: 0 }
  alerts.forEach(a => counts[a.type]++)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Notifications
          </h1>
          <p className="text-gray-400">Stay updated with system activities</p>
        </div>
        <button onClick={markAllRead} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">
          ✓ Mark All Read
        </button>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3">
        {counts.error > 0 && (
          <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-medium">
            🚨 {counts.error} Error{counts.error > 1 ? 's' : ''}
          </div>
        )}
        {counts.warning > 0 && (
          <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 font-medium">
            ⚠️ {counts.warning} Warning{counts.warning > 1 ? 's' : ''}
          </div>
        )}
        {counts.info > 0 && (
          <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 font-medium">
            ℹ️ {counts.info} Info
          </div>
        )}
        {counts.success > 0 && (
          <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 font-medium">
            ✅ {counts.success} Success
          </div>
        )}
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center py-16 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div className="text-5xl mb-3">✨</div>
            <h3 className="text-xl font-semibold text-white">All Clear!</h3>
            <p className="text-gray-400">No issues or notifications found. Everything is running smoothly.</p>
          </div>
        ) : (
          alerts.map((alert, i) => {
            const colors = getColorScheme(alert.type)
            return (
              <div key={i} className={`${colors.bg} border ${colors.border} rounded-xl p-4 flex items-start gap-4`}>
                <div className="text-2xl">{alert.icon}</div>
                <div className="flex-1">
                  <div className="font-semibold text-white">{alert.title}</div>
                  {alert.desc && <div className="text-sm text-gray-400 mt-1">{alert.desc}</div>}
                </div>
                {alert.action && (
                  <Link to={alert.action} className={`px-3 py-1 border rounded-lg text-sm ${colors.border} ${colors.badge} hover:bg-white/5`}>
                    {alert.actionLabel}
                  </Link>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
