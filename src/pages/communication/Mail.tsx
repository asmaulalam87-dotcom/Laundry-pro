import { useState, useEffect } from 'react'
import { LocalDB } from '@/services/local-db'

interface Email {
  id?: string
  recipient: string
  subject: string
  body: string
  sender?: string
  date: string
}

export function Mail() {
  const [view, setView] = useState<'sent' | 'compose'>('sent')
  const [emails, setEmails] = useState<Email[]>([])
  const [form, setForm] = useState({ to: '', subject: '', body: '' })

  useEffect(() => {
    loadEmails()
  }, [])

  const loadEmails = async () => {
    try {
      const data = await LocalDB.getAll<Email>('sent_emails')
      setEmails(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    } catch (error) {
      console.error('Failed to load emails:', error)
    }
  }

  const sendEmail = async () => {
    if (!form.to || !form.subject || !form.body) {
      alert('Please fill all fields')
      return
    }

    const payload: Email = {
      recipient: form.to,
      subject: form.subject,
      body: form.body,
      sender: 'user@laundrypro.app',
      date: new Date().toISOString()
    }

    try {
      await LocalDB.add('sent_emails', payload)
      
      // Open default mail client
      const mailtoLink = `mailto:${encodeURIComponent(form.to)}?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(form.body)}`
      window.open(mailtoLink, '_blank')

      setForm({ to: '', subject: '', body: '' })
      setView('sent')
      loadEmails()
    } catch (error) {
      console.error('Failed to send email:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Mail System
          </h1>
          <p className="text-gray-400">Email concerns directly from the system</p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-200px)]">
        {/* Sidebar */}
        <div className="w-60 bg-gray-800/50 border border-gray-700 rounded-xl flex flex-col">
          <button
            onClick={() => { setView('compose'); setForm({ to: '', subject: '', body: '' }) }}
            className="m-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium"
          >
            Compose Email
          </button>
          <button
            onClick={() => setView('sent')}
            className={`px-4 py-2 text-left text-gray-300 hover:bg-gray-700/30 ${view === 'sent' ? 'bg-gray-700/30 border-l-2 border-indigo-500' : ''}`}
          >
            ✉️ Sent Items
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
          {view === 'sent' && (
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/50">
                <h3 className="font-semibold text-white">Sent Emails</h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {emails.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No sent emails</div>
                ) : (
                  emails.map(email => (
                    <div key={email.id} className="grid grid-cols-[200px_1fr_100px] gap-4 px-4 py-3 border-b border-gray-700/50 hover:bg-gray-700/20">
                      <div className="font-medium text-white truncate">{email.recipient}</div>
                      <div className="text-gray-300 truncate">{email.subject}</div>
                      <div className="text-gray-500 text-sm text-right">{new Date(email.date).toLocaleDateString()}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {view === 'compose' && (
            <div className="h-full flex flex-col p-6">
              <h2 className="text-xl font-semibold text-white mb-6">New Message</h2>
              <div className="space-y-4 flex-1 flex flex-col">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">To (Email Address)</label>
                  <input
                    type="email"
                    value={form.to}
                    onChange={(e) => setForm({ ...form, to: e.target.value })}
                    placeholder="recipient@example.com"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Review Wash Costing Requisition"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-400 mb-1">Message</label>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder="Type your email here..."
                    className="w-full h-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setView('sent')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">
                    Discard
                  </button>
                  <button onClick={sendEmail} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white">
                    Send Email
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
