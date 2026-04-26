import { Link } from 'react-router-dom'

export function Help() {
  const faqs = [
    {
      q: 'How do I reset my password?',
      a: 'If you are an administrator, you can change passwords from the Admin Panel. Regular users should contact their system administrator to request a password reset.'
    },
    {
      q: 'Why is my data not syncing?',
      a: 'Ensure you have an active internet connection. The system works offline using IndexedDB, but requires connectivity and valid Supabase credentials to sync to the cloud.'
    },
    {
      q: 'How do I add a new chemical category?',
      a: 'Go to Edit > Categories & Master Data. From there, you can add new process categories, chemical categories, and other dropdown options used throughout the system.'
    },
    {
      q: 'I accidentally deleted a recipe. Can I recover it?',
      a: 'Currently, deletions are permanent in the local database. If the system was synced to the cloud prior to deletion, an administrator might be able to restore it.'
    },
    {
      q: 'How does the Costing Calculator work?',
      a: 'Select a finalized recipe, set batch weight, garment quantity, efficiency, reprocess %, and overhead. The calculator automatically computes chemical costs from recipe steps, machine/utility costs, and dry process operations. You can adjust profit margin to see selling price. Master data for Dry Process Operations and Machine Utility Factors can be configured in Admin Panel → Master Data.'
    }
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
          Application Help & Support
        </h1>
        <p className="text-gray-400 mt-2">Frequently Asked Questions and System Support</p>
      </div>

      {/* FAQ Card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-xl font-bold text-white border-b-2 border-indigo-500 pb-2 inline-block mb-6">
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-gray-700 pb-4 last:border-0">
              <div className="font-semibold text-white flex items-center gap-2 mb-2">
                <span>❓</span> {faq.q}
              </div>
              <div className="text-gray-400 text-sm pl-6">{faq.a}</div>
            </div>
          ))}
        </div>

        {/* Contact Box */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">Need more help?</h3>
          <p className="text-gray-400 mb-4">
            If you encounter a bug or need administrative assistance, please use the internal Mailing System to contact support.
          </p>
          <Link to="/mail" className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white">
            ✉️ Contact Support
          </Link>
        </div>
      </div>
    </div>
  )
}
