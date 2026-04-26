import QRCode from 'qrcode'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import html2canvas from 'html2canvas'
import type { Recipe } from '@/types'

// QR Code Generation
export const generateQRCode = async (recipe: Recipe): Promise<string> => {
  const recipeData = JSON.stringify({
    id: recipe.id,
    no: recipe.recipe_no,
    customer: recipe.customer_name,
    style: recipe.style,
  })
  
  return await QRCode.toDataURL(recipeData, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  })
}

// ─── Print Recipe (exact Backup-14 layout) ──────────────────────────────────
export interface PrintOptions {
  includeSummary: boolean
  includeChemicalSummary: boolean
  includeSignatures: boolean
  companyName?: string
  companyLogo?: string
}

export const printRecipe = (
  recipe: Recipe,
  steps: any[] = [],
  options: Partial<PrintOptions> = {}
) => {
  const opts: PrintOptions = {
    includeSummary: true,
    includeChemicalSummary: true,
    includeSignatures: true,
    companyName: localStorage.getItem('company_name') || recipe.factory_name || 'Laundry Division',
    companyLogo: localStorage.getItem('company_logo') || '',
    ...options,
  }

  const batchWeight = recipe.batch_weight || 0

  // ── Helper: calculate water for a step ──────────────────────────────────────
  const calcStepWater = (step: any): number => {
    const ltrRatio = step.ltr ? parseFloat(String(step.ltr).replace('1:', '').trim()) : 0
    if (!ltrRatio || ltrRatio <= 0) return 0
    const wt = step.step_weight ? parseFloat(step.step_weight) || batchWeight : batchWeight
    return ltrRatio * wt
  }

  // ── Helper: calculate one chemical qty (kg) ─────────────────────────────────
  const calcChemQty = (chem: any, water: number, weight: number): number => {
    const d = parseFloat(chem.dosage) || 0
    switch (chem.unit) {
      case 'g/l':  return d * water / 1000
      case '%':    return d * weight / 100
      case 'g/kg': return d * weight / 1000
      case 'kg':   return d
      default:     return d * weight / 1000
    }
  }

  // ── Build chemical totals ───────────────────────────────────────────────────
  const chemTotals: Record<string, number> = {}
  steps.forEach(step => {
    const water  = calcStepWater(step)
    const weight = step.step_weight ? parseFloat(step.step_weight) || batchWeight : batchWeight
    ;(step.chemicals || []).forEach((c: any) => {
      const name = c.chemical_name || c.name
      if (!name) return
      const qty = calcChemQty(c, water, weight)
      chemTotals[name] = (chemTotals[name] || 0) + qty
    })
  })

  // ── Build steps rows (exact Backup-14 columns) ──────────────────────────────
  const stepsHtml = steps.length > 0 ? steps.map((step, idx) => {
    const water  = calcStepWater(step)
    const weight = step.step_weight ? parseFloat(step.step_weight) || batchWeight : batchWeight

    const chemsNameHtml = (step.chemicals || [])
      .filter((c: any) => c.chemical_name || c.name)
      .map((c: any) => {
        const nm = c.chemical_name || c.name
        return `<div style="padding:2px 0;">${nm}${c.batch_no ? ` [${c.batch_no}]` : ''}: ${c.dosage || 0} ${c.unit || ''}</div>`
      }).join('') || '-'

    const chemsQtyHtml = (step.chemicals || [])
      .filter((c: any) => c.chemical_name || c.name)
      .map((c: any) => {
        const qty = calcChemQty(c, water, weight)
        return `<div style="padding:2px 0;font-weight:600;color:#059669;">${qty.toFixed(3)} kg</div>`
      }).join('') || '-'

    const stepExtra = (step.step_weight || step.step_qty)
      ? `<div style="font-size:9px;color:#888;">[Wt: ${weight}kg${step.step_qty ? `, Qty: ${step.step_qty}pcs` : ''}]</div>`
      : ''

    return `<tr>
      <td style="padding:6px;border:1px solid #ccc;text-align:center;vertical-align:top;">${idx + 1}</td>
      <td style="padding:6px;border:1px solid #ccc;vertical-align:top;">${step.process_name || '-'}${stepExtra}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center;vertical-align:top;">${step.temperature || '-'}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center;vertical-align:top;">${step.time_minutes || '-'}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center;vertical-align:top;background:rgba(245,158,11,0.05);">${step.non_op_time || '-'}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center;vertical-align:top;">${step.ltr || '-'}</td>
      <td style="padding:6px;border:1px solid #ccc;text-align:center;vertical-align:top;color:#0891b2;font-weight:600;">${water > 0 ? water.toFixed(1) + ' Ltr' : '-'}</td>
      <td style="padding:6px;border:1px solid #ccc;vertical-align:top;">${chemsNameHtml}</td>
      <td style="padding:6px;border:1px solid #ccc;vertical-align:top;text-align:right;">${chemsQtyHtml}</td>
      <td style="padding:6px;border:1px solid #ccc;vertical-align:top;font-size:10px;">${step.remarks || '-'}</td>
    </tr>`
  }).join('') : `<tr><td colspan="10" style="padding:8px;text-align:center;">No steps</td></tr>`

  // ── Chemical summary table (50% width like Backup-14) ───────────────────────
  const chemSummaryHtml = opts.includeChemicalSummary && Object.keys(chemTotals).length > 0
    ? `<h4 style="margin-top:20px;">Total Chemical Requirements</h4>
       <table style="width:50%;border-collapse:collapse;font-size:11px;">
         <thead>
           <tr style="background:#f0f0f0;">
             <th style="padding:6px;border:1px solid #ccc;text-align:left;">Chemical Name</th>
             <th style="padding:6px;border:1px solid #ccc;text-align:right;">Total Qty</th>
           </tr>
         </thead>
         <tbody>
           ${Object.entries(chemTotals).map(([name, qty]) =>
             `<tr>
               <td style="padding:4px;border:1px solid #ccc;">${name}</td>
               <td style="padding:4px;border:1px solid #ccc;text-align:right;font-weight:600;color:#059669;">${(qty as number).toFixed(3)} kg</td>
             </tr>`
           ).join('')}
         </tbody>
       </table>` : ''

  // ── Remarks ─────────────────────────────────────────────────────────────────
  const remarksHtml = recipe.remarks
    ? `<div style="margin-top:20px;padding:10px;border:1px solid #ccc;border-radius:4px;">
         <h4 style="margin:0 0 5px 0;">📝 Remarks</h4>
         <p style="margin:0;white-space:pre-wrap;font-size:11px;">${recipe.remarks}</p>
       </div>` : ''

  // ── Signatures (Backup-14: Prepared By / Checked By / Approved By) ──────────
  const signaturesHtml = opts.includeSignatures
    ? `<div style="margin-top:50px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:center;font-size:12px;">
         <div><div style="border-top:1.5px solid #333;padding-top:5px;margin:0 10px;"><b>Prepared By</b></div></div>
         <div><div style="border-top:1.5px solid #333;padding-top:5px;margin:0 10px;"><b>Checked By</b></div></div>
         <div><div style="border-top:1.5px solid #333;padding-top:5px;margin:0 10px;"><b>Approved By</b></div></div>
       </div>` : ''

  // ── QR data string ───────────────────────────────────────────────────────────
  const qrData = [
    'Recipe: ' + (recipe.recipe_no || '-'),
    'Ref: '    + (recipe.recipe_ref || '-'),
    'Customer: '+ (recipe.customer_name || '-'),
    'Style: '  + (recipe.style || '-'),
    'Date: '   + (recipe.recipe_date || '-'),
    'Batch: '  + batchWeight + 'KG/' + (recipe.batch_quantity || 0) + 'pcs'
  ].join(' | ')

  // ── Company logo / name ──────────────────────────────────────────────────────
  const logoHtml = opts.companyLogo
    ? `<img src="${opts.companyLogo}" style="max-height:55px;max-width:150px;object-fit:contain;" alt="logo">`
    : `<div style="font-size:18px;font-weight:900;letter-spacing:1px;">${(opts.companyName || '').toUpperCase()}</div>`

  // ── Main info table rows (exact Backup-14 five rows) ────────────────────────
  const totalWater = steps.reduce((s, st) => s + calcStepWater(st), 0)
  const totalTime  = steps.reduce((s, st) => s + (parseFloat(st.time_minutes) || 0), 0)

  const infoTableHtml = `
    <table style="width:100%;margin:15px 0;border-collapse:collapse;font-size:11px;">
      <tr>
        <td style="padding:4px;border-bottom:1px solid #eee;width:25%;"><b>Recipe No:</b> ${recipe.recipe_no || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;width:25%;"><b>Reference:</b> ${recipe.recipe_ref || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;width:25%;"><b>Customer:</b> ${recipe.customer_name || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;width:25%;"><b>Date:</b> ${recipe.recipe_date || '-'}</td>
      </tr>
      <tr>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Style:</b> ${recipe.style || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Item:</b> ${recipe.item || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Color:</b> ${recipe.color || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Wash Type:</b> ${recipe.wash_type || '-'}</td>
      </tr>
      <tr>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>PO No:</b> ${recipe.po || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>OB No:</b> ${recipe.ob_no || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Order Qty:</b> ${recipe.order_quantity || '0'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Wash Process:</b> ${recipe.final_wash || '-'}</td>
      </tr>
      <tr>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Stage:</b> ${recipe.recipe_stage || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Version:</b> ${recipe.recipe_version || 'V1'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Batch Wt:</b> ${batchWeight} KG</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Batch Qty:</b> ${recipe.batch_quantity || '0'} pcs</td>
      </tr>
      <tr>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Machine:</b> ${recipe.machine_type || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Factory:</b> ${recipe.factory_name || '-'}</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Recipe Time:</b> ${recipe.recipe_time || totalTime.toFixed(0)} min</td>
        <td style="padding:4px;border-bottom:1px solid #eee;"><b>Total Water:</b> ${recipe.total_water || totalWater.toFixed(1)} Ltr</td>
      </tr>
      <tr>
        <td style="padding:4px;border-bottom:2px solid #333;"><b>Cost/Batch:</b> ${recipe.cost_batch ? recipe.cost_batch.toFixed(2) : '-'}</td>
        <td style="padding:4px;border-bottom:2px solid #333;"><b>Cost/Pc:</b> ${recipe.cost_pc ? recipe.cost_pc.toFixed(3) : '-'}</td>
        <td style="padding:4px;border-bottom:2px solid #333;"></td>
        <td style="padding:4px;border-bottom:2px solid #333;"></td>
      </tr>
    </table>`

  // ── Open print window ────────────────────────────────────────────────────────
  const title = `${recipe.customer_name || 'Recipe'}_${recipe.style || ''}_${recipe.color || ''}`
  const w = window.open('', '_blank')
  if (!w) return

  w.document.write(`<html>
  <head>
    <title>${title}</title>
    <meta charset="UTF-8">
    <style>
      @page { size: A4 portrait; margin: 8mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
      @media print { .no-print { display: none !important; } }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
  </head>
  <body>
    <div style="max-width:1000px;margin:0 auto;padding:10px;">

      <!-- HEADER: logo left | title center | QR right -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #333;padding-bottom:8px;">
        <div style="flex:1;">${logoHtml}</div>
        <h2 style="margin:0;text-align:center;flex:2;font-size:15px;letter-spacing:1px;">LAUNDRY RECIPE SHEET</h2>
        <div style="flex:1;display:flex;justify-content:flex-end;">
          <div id="qr-code-container" style="width:60px;height:60px;"></div>
        </div>
      </div>

      <!-- INFO TABLE -->
      ${infoTableHtml}

      <!-- PROCESS WORKFLOW -->
      <h4 style="margin:8px 0 4px 0;">Process Workflow</h4>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:6px;border:1px solid #ccc;">Step</th>
            <th style="padding:6px;border:1px solid #ccc;">Process</th>
            <th style="padding:6px;border:1px solid #ccc;">Temp</th>
            <th style="padding:6px;border:1px solid #ccc;">Op. Time</th>
            <th style="padding:6px;border:1px solid #ccc;">Non-Op</th>
            <th style="padding:6px;border:1px solid #ccc;">L/R</th>
            <th style="padding:6px;border:1px solid #ccc;">Water</th>
            <th style="padding:6px;border:1px solid #ccc;">Chemicals</th>
            <th style="padding:6px;border:1px solid #ccc;">Total Qty</th>
            <th style="padding:6px;border:1px solid #ccc;">Remarks</th>
          </tr>
        </thead>
        <tbody>${stepsHtml}</tbody>
      </table>

      <!-- CHEMICAL SUMMARY -->
      ${opts.includeChemicalSummary ? chemSummaryHtml : ''}

      <!-- REMARKS -->
      ${remarksHtml}

      <!-- SIGNATURES -->
      ${opts.includeSignatures ? signaturesHtml : ''}

      <!-- FOOTER -->
      <div style="margin-top:30px;text-align:center;">
        <p style="font-size:8px;color:#aaa;letter-spacing:0.3em;">SYSTEM GENERATED DOCUMENT</p>
        <p style="font-size:9px;color:#666;margin-top:4px;">Developed by <b>Md. Asmaul Alam</b> | Mobile: 01770625848 | Email: asmaulalam87@gmail.com</p>
      </div>

    </div>

    <script>
      setTimeout(function() {
        var qrEl = document.getElementById('qr-code-container');
        if (qrEl && typeof QRCode !== 'undefined') {
          new QRCode(qrEl, {
            text: ${JSON.stringify(qrData)},
            width: 60, height: 60,
            colorDark: '#000', colorLight: '#fff',
            correctLevel: QRCode.CorrectLevel.M
          });
        }
        setTimeout(function() { window.print(); }, 350);
      }, 200);
    <\/script>
  </body>
  </html>`)
  w.document.close()
}

// ─── Print Costing Report (A4 professional sheet) ──────────────────────────
export interface CostingPrintData {
  recipeNo: string
  customerName: string
  style: string
  color: string
  washType: string
  batchWeight: number
  garmentQty: number
  efficiency: number
  reprocess: number
  convRate: number
  utilityFactors: { name: string; rate_per_min: number }[]
  dryProcesses: { process_name: string; smv: number; rate_per_min: number; total: number }[]
  wetChemicalCost: number
  wetMachineCost: number
  wetTotalTime: number
  dryProcessTotal: number
  totalWashCost: number
  costPerGarment: number
  costPerKg: number
  costPerDozen: number
}

export const printCostingReport = (data: CostingPrintData) => {
  const companyName = localStorage.getItem('company_name') || 'Laundry Division'
  const companyLogo = localStorage.getItem('company_logo') || ''
  const rate = data.convRate || 120

  const logoHtml = companyLogo
    ? `<img src="${companyLogo}" style="max-height:55px;max-width:150px;object-fit:contain;" alt="logo">`
    : `<div style="font-size:18px;font-weight:900;letter-spacing:1px;">${companyName.toUpperCase()}</div>`

  const bdt = (v: number) => `৳${v.toFixed(2)}`
  const usd = (v: number) => `$${(rate > 0 ? v / rate : 0).toFixed(3)}`

  const utilityRowsHtml = data.utilityFactors.map(u =>
    `<tr>
      <td style="padding:6px 10px;border:1px solid #ddd;">${u.name}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">৳${u.rate_per_min.toFixed(4)}</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${data.wetTotalTime} min</td>
      <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;font-weight:600;color:#059669;">৳${(u.rate_per_min * data.wetTotalTime).toFixed(2)}</td>
    </tr>`
  ).join('')

  const dryRowsHtml = data.dryProcesses.length > 0
    ? data.dryProcesses.map(dp =>
        `<tr>
          <td style="padding:6px 10px;border:1px solid #ddd;">${dp.process_name || '-'}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${dp.smv.toFixed(1)}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">৳${dp.rate_per_min.toFixed(4)}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;font-weight:600;color:#059669;">৳${dp.total.toFixed(2)}</td>
        </tr>`
      ).join('')
    : `<tr><td colspan="4" style="padding:8px;text-align:center;color:#888;">No dry process operations</td></tr>`

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const title = `Costing_${data.recipeNo || 'Report'}_${data.customerName || ''}`
  const w = window.open('', '_blank')
  if (!w) return

  w.document.write(`<html>
  <head>
    <title>${title}</title>
    <meta charset="UTF-8">
    <style>
      @page { size: A4 portrait; margin: 8mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; }
      @media print {
        .no-print { display: none !important; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <div style="max-width:1000px;margin:0 auto;padding:10px;">

      <!-- HEADER -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px double #333;padding-bottom:10px;margin-bottom:15px;">
        <div style="flex:1;">${logoHtml}</div>
        <div style="text-align:center;flex:2;">
          <h2 style="margin:0;font-size:16px;letter-spacing:2px;">LAUNDRY COSTING SHEET</h2>
          <p style="font-size:9px;color:#888;letter-spacing:1px;margin-top:2px;">Official Financial Assessment & Analysis</p>
        </div>
        <div style="flex:1;text-align:right;font-size:10px;color:#666;">
          <div>${dateStr}</div>
          <div>${timeStr}</div>
        </div>
      </div>

      <!-- META INFORMATION -->
      <table style="width:100%;margin:10px 0 15px;border-collapse:collapse;font-size:11px;">
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;width:25%;"><b>Recipe No:</b> ${data.recipeNo || '-'}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;width:25%;"><b>Customer:</b> ${data.customerName || '-'}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;width:25%;"><b>Style:</b> ${data.style || '-'}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;width:25%;"><b>Color:</b> ${data.color || '-'}</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;"><b>Wash Type:</b> ${data.washType || '-'}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;"><b>Batch Weight:</b> ${data.batchWeight} KG</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;"><b>Garment Qty:</b> ${data.garmentQty} Pcs</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;"><b>Efficiency:</b> ${data.efficiency}%</td>
        </tr>
        <tr>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;"><b>Reprocess:</b> ${data.reprocess}%</td>
          <td style="padding:4px 8px;border-bottom:1px solid #eee;"><b>Conv Rate:</b> 1 USD = ৳${rate}</td>
          <td style="padding:4px 8px;border-bottom:2px solid #333;"></td>
          <td style="padding:4px 8px;border-bottom:2px solid #333;"></td>
        </tr>
      </table>

      <!-- FINANCIAL SUMMARY -->
      <h4 style="margin:12px 0 6px;font-size:12px;">Cost Breakdown</h4>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:15px;">
        <thead>
          <tr style="background:#1e293b;color:#fff;font-size:10px;letter-spacing:0.5px;">
            <th style="padding:8px 10px;text-align:left;">Cost Element</th>
            <th style="padding:8px 10px;text-align:right;">Batch Total (BDT)</th>
            <th style="padding:8px 10px;text-align:right;">Per PC (BDT)</th>
            <th style="padding:8px 10px;text-align:right;">Per PC (USD)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px 10px;">Wet Process — Chemicals & Dyes</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;">${bdt(data.wetChemicalCost)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#059669;">${bdt(data.garmentQty > 0 ? data.wetChemicalCost / data.garmentQty : 0)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#2563eb;">${usd(data.garmentQty > 0 ? data.wetChemicalCost / data.garmentQty : 0)}</td>
          </tr>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px 10px;">Machine Utility Cost (${data.wetTotalTime} min)</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;">${bdt(data.wetMachineCost)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#059669;">${bdt(data.garmentQty > 0 ? data.wetMachineCost / data.garmentQty : 0)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#2563eb;">${usd(data.garmentQty > 0 ? data.wetMachineCost / data.garmentQty : 0)}</td>
          </tr>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px 10px;">Dry Process Operations</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;">${bdt(data.dryProcessTotal)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#059669;">${bdt(data.garmentQty > 0 ? data.dryProcessTotal / data.garmentQty : 0)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#2563eb;">${usd(data.garmentQty > 0 ? data.dryProcessTotal / data.garmentQty : 0)}</td>
          </tr>
          <tr style="background:#1e293b;color:#fff;">
            <td style="padding:10px;font-weight:900;letter-spacing:0.5px;">GRAND TOTAL</td>
            <td style="padding:10px;text-align:right;font-size:14px;font-weight:900;">${bdt(data.totalWashCost)}</td>
            <td style="padding:10px;text-align:right;font-size:14px;font-weight:900;">${bdt(data.costPerGarment)}</td>
            <td style="padding:10px;text-align:right;font-size:14px;font-weight:900;">${usd(data.costPerGarment)}</td>
          </tr>
        </tbody>
      </table>

      <!-- COST PER KG / DOZEN -->
      <div style="margin:15px 0;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;display:flex;justify-content:space-between;">
          <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Cost per KG (BDT)</span>
          <span style="font-size:14px;font-weight:900;color:#059669;">${bdt(data.costPerKg)}</span>
        </div>
        <div style="padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;display:flex;justify-content:space-between;">
          <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Cost per Dozen (BDT)</span>
          <span style="font-size:14px;font-weight:900;color:#059669;">${bdt(data.costPerDozen)}</span>
        </div>
        <div style="padding:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;display:flex;justify-content:space-between;">
          <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Cost per KG (USD)</span>
          <span style="font-size:14px;font-weight:900;color:#2563eb;">${usd(data.costPerKg)}</span>
        </div>
        <div style="padding:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;display:flex;justify-content:space-between;">
          <span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Cost per Dozen (USD)</span>
          <span style="font-size:14px;font-weight:900;color:#2563eb;">${usd(data.costPerDozen)}</span>
        </div>
      </div>

      <!-- UTILITY FACTORS DETAIL -->
      <h4 style="margin:12px 0 6px;font-size:12px;">Machine Utility Factors</h4>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:15px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Utility</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:right;">Rate (BDT/min)</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:right;">Cycle Time</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:right;">Cost</th>
          </tr>
        </thead>
        <tbody>${utilityRowsHtml}</tbody>
      </table>

      <!-- DRY PROCESS DETAIL -->
      <h4 style="margin:12px 0 6px;font-size:12px;">Dry Process Operations</h4>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:15px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Process</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:right;">SMV</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:right;">Rate (BDT/min)</th>
            <th style="padding:6px 10px;border:1px solid #ddd;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${dryRowsHtml}</tbody>
      </table>

      <!-- SIGNATURES -->
      <div style="margin-top:60px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:center;font-size:12px;">
        <div><div style="border-top:1.5px solid #333;padding-top:5px;margin:0 10px;"><b>Prepared By</b></div></div>
        <div><div style="border-top:1.5px solid #333;padding-top:5px;margin:0 10px;"><b>Checked By</b></div></div>
        <div><div style="border-top:1.5px solid #333;padding-top:5px;margin:0 10px;"><b>Approved By</b></div></div>
      </div>

      <!-- FOOTER -->
      <div style="margin-top:30px;text-align:center;">
        <p style="font-size:8px;color:#aaa;letter-spacing:0.3em;">SYSTEM GENERATED DOCUMENT</p>
        <p style="font-size:9px;color:#666;margin-top:4px;">Developed by <b>Md. Asmaul Alam</b> | Mobile: 01770625848 | Email: asmaulalam87@gmail.com</p>
      </div>

    </div>

    <script>
      setTimeout(function() { window.print(); }, 300);
    <\/script>
  </body>
  </html>`)
  w.document.close()
}

// Export to Excel
export const exportToExcel = (data: any[], filename: string, sheetName: string = 'Sheet1') => {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// Export to PDF
export const exportToPDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId)
  if (!element) return

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  
  const imgWidth = canvas.width
  const imgHeight = canvas.height
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
  
  const imgX = (pdfWidth - imgWidth * ratio) / 2
  const imgY = 0

  pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio)
  pdf.save(`${filename}.pdf`)
}

// Share via WhatsApp
export const shareViaWhatsApp = (recipe: Recipe) => {
  const text = `*Recipe: ${recipe.recipe_no}*
Customer: ${recipe.customer_name}
Style: ${recipe.style || '-'}
Color: ${recipe.color || '-'}
Wash Type: ${recipe.wash_type || '-'}
Batch: ${recipe.batch_weight} kg

_View full recipe in Laundry Pro System_`

  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}

// Share via Email
export const shareViaEmail = (recipe: Recipe) => {
  const subject = `Recipe: ${recipe.recipe_no} - ${recipe.customer_name}`
  const body = `Recipe Details:
  
Recipe No: ${recipe.recipe_no}
Customer: ${recipe.customer_name}
Style: ${recipe.style || '-'}
Color: ${recipe.color || '-'}
Wash Type: ${recipe.wash_type || '-'}
Batch Weight: ${recipe.batch_weight} kg
Status: ${recipe.status}

Please review the attached recipe.

---
Sent from Laundry Pro Recipe System`

  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// Download as JSON
export const exportAsJSON = (recipe: Recipe) => {
  const dataStr = JSON.stringify(recipe, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  saveAs(dataBlob, `${recipe.recipe_no}.json`)
}

// Photo Upload
export const handlePhotoUpload = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// AI OCR Simulation (In production, use Tesseract.js or cloud OCR API)
export const simulateOCR = async (imageData: string): Promise<Partial<Recipe>> => {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Return mock extracted data
  // In production, integrate with Tesseract.js or Google Vision API
  return {
    customer_name: 'Extracted Customer',
    style: 'EXTRACTED STYLE',
    color: 'Blue',
    wash_type: 'Normal Wash',
    batch_weight: 100,
    remarks: 'Auto-extracted via OCR',
  }
}
