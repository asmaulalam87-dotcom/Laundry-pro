import { useState } from 'react'

type Section = 'intro' | 'dashboard' | 'recipes' | 'costing' | 'chemicals' | 'reports' | 'eim' | 'admin'

export function Manual() {
  const [activeSection, setActiveSection] = useState<Section>('intro')

  const sections = {
    intro: {
      title: 'Introduction',
      content: `
        <p>Welcome to <strong>Laundry Costing Pro</strong>, the comprehensive recipe management and financial tracking system built specifically for industrial wash facilities.</p>
        <p>This system allows you to build standard operating procedures (SOPs) for washing garments, calculate precise chemical and utility costs per batch, track environmental impact, and manage your master inventory.</p>
        <h3>System Requirements</h3>
        <ul>
          <li>A modern web browser (Google Chrome, Mozilla Firefox, or Microsoft Edge recommended).</li>
          <li>An Administrator account for initial setup and master data configuration.</li>
        </ul>
      `
    },
    dashboard: {
      title: 'Dashboard Overview',
      content: `
        <p>The Dashboard acts as your central hub, providing a quick glance at system activity and health.</p>
        <ul>
          <li><strong>Overview Metrics:</strong> See total recipes, processes, chemicals, and recent costings at a glance.</li>
          <li><strong>Daily Activity:</strong> A chart displaying recipe creation numbers over the past week.</li>
          <li><strong>Low Stock Alerts:</strong> Automatically flags any chemicals where the Current Stock is at or below the Min Threshold set in the Chemical Master.</li>
          <li><strong>Recent Operations:</strong> The latest recipes logged into the system.</li>
          <li><strong>Quick Grid:</strong> Fast navigation squares to jump directly into building a new recipe or estimating a costing.</li>
        </ul>
      `
    },
    recipes: {
      title: 'Recipe Management',
      content: `
        <p>The Recipe Builder is the core of the operational system. It defines exactly how a specific garment style should be washed.</p>
        <h3>Creating a Recipe</h3>
        <ol>
          <li>Navigate to <strong>File > New Recipe</strong> or click "New Recipe" on the dashboard.</li>
          <li>Fill in the metadata: Customer, Style, Item Type, Color, etc.</li>
          <li>Click <strong>Add Process Step</strong> (e.g., Desizing, Enzyme Wash).</li>
          <li>For each step, configure the temperature, time, water ratio (L/R), and add the necessary chemicals from the master dropdown.</li>
          <li>You can drag and drop processes to reorder them using the handle on the left of each process card.</li>
          <li>Click <strong>Save Recipe</strong>. Note: Drafts can be saved, but to use them in Costing, they should ideally be finalized.</li>
        </ol>
        <h3>Comparing Recipes</h3>
        <p>Use the <strong>Compare</strong> module to view two recipes side-by-side. This highlights differences in processes, chemical quantities, and overall temperature/time.</p>
      `
    },
    costing: {
      title: 'Laundry Costing',
      content: `
        <p>The Costing module ties financial data to your operational recipes.</p>
        <h3>Generating a Costing Sheet</h3>
        <ol>
          <li>Navigate to <strong>File > New Costing</strong>.</li>
          <li>Select a <strong>Recipe</strong> from the dropdown. This automatically imports all chemical requirements and prices based on the Chemical Master.</li>
          <li>Input production details: Machine Capacity, Target Output, Order Quantity.</li>
          <li>Add any <strong>Dry Process Operations</strong> (e.g., Whisker, Scraping) which have fixed labor rates.</li>
          <li>Configure <strong>Fixed Costs & Overheads</strong> (Electricity, Water, Payroll).</li>
          <li>The <strong>P&L Summary</strong> will automatically calculate cost per garment, batch cost, and projected profit based on your markup.</li>
          <li>Save the record. It can now be viewed in <strong>View > All Costings</strong>.</li>
        </ol>
      `
    },
    chemicals: {
      title: 'Chemical Master',
      content: `
        <p>Manage your raw material inventory and pricing.</p>
        <ul>
          <li><strong>Add/Edit:</strong> Update chemical names, categories, pricing per KG, and current stock levels.</li>
          <li><strong>Bulk Upload:</strong> Use the CSV template to upload hundreds of chemicals at once. The system will skip duplicates based on names.</li>
          <li><strong>Categories:</strong> You can manage chemical categories directly from the Chemical Master view.</li>
        </ul>
      `
    },
    reports: {
      title: 'Reports & Analytics',
      content: `
        <p>The Analytics dashboard provides deep business intelligence.</p>
        <ul>
          <li><strong>Performance:</strong> Track average process times and water usage.</li>
          <li><strong>Cost Analysis:</strong> Breakdowns of chemical vs. operational costs over time.</li>
          <li><strong>Exporting:</strong> Most data tables and charts can be exported to CSV or PDF via the buttons inside the reports view.</li>
        </ul>
      `
    },
    eim: {
      title: 'EIM Score Calculator',
      content: `
        <p>Calculate the Environmental Impact Measuring (EIM) score for your recipes.</p>
        <p>The system evaluates Water Consumption, Energy Usage, Chemical Impact, and Worker Health based on the parameters set in your recipes. A lower score signifies a more environmentally friendly process.</p>
      `
    },
    admin: {
      title: 'Admin & Permissions',
      content: `
        <p>Access the Admin Panel to manage users, roles, and company settings.</p>
        <ul>
          <li><strong>User Management:</strong> Create accounts for staff. You can toggle specific menu permissions for non-admin users.</li>
          <li><strong>Company Profile:</strong> Update the company name and logo, which will appear on exported PDF reports.</li>
          <li><strong>Database Backup:</strong> Create backups of your local IndexedDB to safeguard your data.</li>
        </ul>
      `
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6">
      {/* Sidebar Navigation */}
      <aside className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 h-fit sticky top-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">Getting Started</div>
          {(['intro', 'dashboard'] as Section[]).map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                activeSection === s ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              {sections[s].title}
            </button>
          ))}

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2 mt-4">Core Modules</div>
          {(['recipes', 'costing', 'chemicals'] as Section[]).map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                activeSection === s ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              {sections[s].title}
            </button>
          ))}

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2 mt-4">Analytics</div>
          {(['reports', 'eim'] as Section[]).map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                activeSection === s ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              {sections[s].title}
            </button>
          ))}

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2 mt-4">Administration</div>
          <button
            onClick={() => setActiveSection('admin')}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              activeSection === 'admin' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
          >
            {sections.admin.title}
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-indigo-400 border-b border-gray-700 pb-2 mb-4">
          {sections[activeSection].title}
        </h2>
        <div 
          className="prose prose-invert prose-sm max-w-none
            [&>p]:text-gray-300 [&>p]:mb-4
            [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-white [&>h3]:mt-6 [&>h3]:mb-2
            [&>ul]:text-gray-300 [&>ul]:space-y-1 [&>ul>li]:text-sm
            [&>ol]:text-gray-300 [&>ol]:space-y-1 [&>ol>li]:text-sm
            [&_strong]:text-white"
          dangerouslySetInnerHTML={{ __html: sections[activeSection].content }}
        />
      </div>
    </div>
  )
}
