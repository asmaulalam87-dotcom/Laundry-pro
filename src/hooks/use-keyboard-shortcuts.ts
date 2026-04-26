import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/stores/ui-store'

interface ShortcutDef {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
  global?: boolean
}

/**
 * Hook that registers global keyboard shortcuts.
 * Returns the list of shortcuts for display in the command palette.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const { toggleSidebarHidden } = useUIStore()

  const shortcuts: ShortcutDef[] = [
    {
      key: 'n',
      ctrl: true,
      description: 'New Recipe',
      action: () => navigate('/recipes/builder'),
    },
    {
      key: 's',
      ctrl: true,
      description: 'Save (context-dependent)',
      action: () => {
        // Dispatch custom event that RecipeBuilder can listen to
        window.dispatchEvent(new CustomEvent('shortcut:save'))
      },
    },
    {
      key: '/',
      ctrl: true,
      description: 'Toggle Sidebar',
      action: () => toggleSidebarHidden(),
    },
    {
      key: 'p',
      ctrl: true,
      description: 'Print',
      action: () => window.print(),
    },
  ]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Allow Ctrl+S even in inputs (prevent browser default)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('shortcut:save'))
          return
        }
        return
      }

      for (const sc of shortcuts) {
        const ctrlMatch = sc.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey
        const shiftMatch = sc.shift ? e.shiftKey : true
        const altMatch = sc.alt ? e.altKey : true
        const keyMatch = e.key.toLowerCase() === sc.key.toLowerCase()

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          e.preventDefault()
          sc.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts]) // eslint-disable-line

  return shortcuts
}

/**
 * All keyboard shortcuts for display purposes (static list).
 */
export const SHORTCUT_LIST = [
  { keys: 'Ctrl+N', description: 'New Recipe' },
  { keys: 'Ctrl+S', description: 'Save Current Work' },
  { keys: 'Ctrl+K', description: 'Search / Command Palette' },
  { keys: 'Ctrl+/', description: 'Toggle Sidebar' },
  { keys: 'Ctrl+P', description: 'Print' },
  { keys: 'Esc', description: 'Close Dialog / Palette' },
]
