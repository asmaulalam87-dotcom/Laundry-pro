import { useState, useEffect, type ReactNode } from 'react'
import QRCode from 'qrcode'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface A4ReportLayoutProps {
  /** Unique DOM id for the print area */
  reportId: string
  /** Report title shown in header center */
  title: string
  /** Orientation: portrait (210×297mm) or landscape (297×210mm) */
  orientation?: 'portrait' | 'landscape'
  /** Company name override (defaults to localStorage) */
  companyName?: string
  /** Company address line */
  companyAddress?: string
  /** Company phone */
  companyPhone?: string
  /** Company logo URL */
  companyLogo?: string
  /** Data to encode into QR code (auto-generated if omitted) */
  qrData?: string
  /** Whether to show the QR code box */
  showQR?: boolean
  /** Confidentiality level badge */
  confidentiality?: 'CONFIDENTIAL' | 'INTERNAL' | 'RESTRICTED' | 'PUBLIC'
  /** Recipe/document status badge */
  statusBadge?: string
  /** Status color: tailwind color key */
  statusColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'indigo'
  /** Document reference ID (auto-generated if omitted) */
  docRef?: string
  /** Prepared by text */
  preparedBy?: string
  /** Show signature block */
  showSignatures?: boolean
  /** Signature labels (default: Prepared By, Checked By, Approved By) */
  signatureLabels?: string[]
  /** Key to look up signature config from localStorage (e.g. 'laundry_recipe') */
  signatureConfigKey?: string
  /** Page content */
  children: ReactNode
  /** Extra footer items */
  extraFooter?: ReactNode
}

// ── Auto-generate a short document reference ──────────────────────────────────
const generateDocRef = (): string => {
  const now = new Date()
  const y = now.getFullYear().toString().slice(-2)
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `RPT-${y}${m}${d}-${rand}`
}

// ── Confidentiality badge colors ──────────────────────────────────────────────
const confColors: Record<string, { bg: string; text: string; border: string }> = {
  CONFIDENTIAL: { bg: 'rgba(220,38,38,0.08)', text: '#dc2626', border: 'rgba(220,38,38,0.3)' },
  RESTRICTED:   { bg: 'rgba(234,88,12,0.08)', text: '#ea580c', border: 'rgba(234,88,12,0.3)' },
  INTERNAL:     { bg: 'rgba(37,99,235,0.08)', text: '#2563eb', border: 'rgba(37,99,235,0.3)' },
  PUBLIC:       { bg: 'rgba(22,163,74,0.08)', text: '#16a34a', border: 'rgba(22,163,74,0.3)' },
}

const statusColorMap: Record<string, { bg: string; text: string }> = {
  blue:    { bg: '#dbeafe', text: '#1d4ed8' },
  green:   { bg: '#dcfce7', text: '#15803d' },
  yellow:  { bg: '#fef9c3', text: '#a16207' },
  red:     { bg: '#fee2e2', text: '#b91c1c' },
  purple:  { bg: '#f3e8ff', text: '#7c3aed' },
  gray:    { bg: '#f3f4f6', text: '#374151' },
  indigo:  { bg: '#e0e7ff', text: '#4338ca' },
}

// ═══════════════════════════════════════════════════════════════════════════════
// A4ReportLayout — Shared A4 page wrapper for ALL reports
// ═══════════════════════════════════════════════════════════════════════════════
export function A4ReportLayout({
  reportId,
  title,
  orientation = 'portrait',
  companyName: companyNameProp,
  companyAddress: companyAddressProp,
  companyPhone: companyPhoneProp,
  companyLogo: companyLogoProp,
  qrData,
  showQR = true,
  confidentiality,
  statusBadge,
  statusColor = 'blue',
  docRef: docRefProp,
  preparedBy,
  showSignatures = false,
  signatureLabels,
  signatureConfigKey,
  children,
  extraFooter,
}: A4ReportLayoutProps) {
  const [qrUrl, setQrUrl] = useState<string>('')
  const companyName    = companyNameProp    || localStorage.getItem('company_name') || 'LAUNDRY DIVISION'
  const companyAddress = companyAddressProp || localStorage.getItem('company_address') || ''
  const companyPhone   = companyPhoneProp   || localStorage.getItem('company_phone') || ''
  const companyLogo    = companyLogoProp    || localStorage.getItem('company_logo') || ''
  const docRef         = docRefProp         || generateDocRef()

  // ── Resolve signature config from localStorage ───────────────────────────
  // If signatureConfigKey is provided, read labels + names from Settings.
  // Otherwise fall back to signatureLabels prop or defaults.
  interface SigSlot { label: string; name: string }
  let resolvedSigs: SigSlot[] = (signatureLabels || ['Prepared By', 'Checked By', 'Approved By']).map(label => ({ label, name: '' }))
  if (signatureConfigKey) {
    try {
      const raw = localStorage.getItem('report_signature_config')
      if (raw) {
        const config = JSON.parse(raw) as Record<string, SigSlot[]>
        if (config[signatureConfigKey] && config[signatureConfigKey].length > 0) {
          resolvedSigs = config[signatureConfigKey]
        }
      }
    } catch {}
  }
  const sigLabels = resolvedSigs.map(s => s.label)
  const sigNames  = resolvedSigs.map(s => s.name)

  const isLandscape = orientation === 'landscape'
  const pageW = isLandscape ? '297mm' : '210mm'
  const pageH = isLandscape ? '210mm' : '297mm'
  const padMM = isLandscape ? '8mm' : '12mm'

  // Generate QR code
  useEffect(() => {
    if (!showQR) return
    const data = qrData || JSON.stringify({ doc: docRef, title, company: companyName, ts: new Date().toISOString() })
    QRCode.toDataURL(data, { width: 200, margin: 1, color: { dark: '#000000', light: '#FFFFFF' } })
      .then(url => setQrUrl(url))
      .catch(() => setQrUrl(''))
  }, [showQR, qrData, title, companyName, docRef])

  const confStyle = confidentiality ? confColors[confidentiality] : null
  const stColor = statusColorMap[statusColor] || statusColorMap.blue

  const now = new Date()
  const generatedTs = now.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  })

  return (
    <div
      id={reportId}
      className="print-area a4-report-page bg-white text-black mx-auto shadow-lg"
      style={{
        fontFamily: 'Arial, sans-serif',
        fontSize: 11,
        color: '#000',
        width: pageW,
        minHeight: pageH,
        padding: padMM,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Watermark ── */}
      <div
        className="report-watermark"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-35deg)',
          fontSize: isLandscape ? 60 : 72,
          fontWeight: 900,
          color: 'rgba(0,0,0,0.025)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          letterSpacing: isLandscape ? 6 : 8,
          zIndex: 0,
        }}
      >
        {companyName}
      </div>

      {/* ── Confidentiality diagonal band (top-right) ── */}
      {confidentiality && confidentiality !== 'PUBLIC' && (
        <div style={{
          position: 'absolute',
          top: 16,
          right: -32,
          transform: 'rotate(45deg)',
          background: confStyle?.border,
          color: '#fff',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 2,
          padding: '2px 40px',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          {confidentiality}
        </div>
      )}

      {/* ── Page content ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Header bar ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #333',
          paddingBottom: 10,
          marginBottom: 14,
        }}>
          {/* Left: company info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" style={{ maxHeight: 48, maxWidth: 150, objectFit: 'contain' }} />
            ) : (
              <>
                <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' }}>{companyName}</div>
                {companyAddress && <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{companyAddress}</div>}
                {companyPhone && <div style={{ fontSize: 9, color: '#555' }}>{companyPhone}</div>}
              </>
            )}
          </div>

          {/* Center: title + badges */}
          <div style={{ flex: 2, textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: isLandscape ? 15 : 17, fontWeight: 900, letterSpacing: 1 }}>
              {title}
            </h2>
            {/* Status + Confidentiality badges */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {statusBadge && (
                <span style={{
                  display: 'inline-block',
                  padding: '1px 8px',
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  background: stColor.bg,
                  color: stColor.text,
                  letterSpacing: 0.5,
                }}>
                  {statusBadge}
                </span>
              )}
              {confidentiality && (
                <span style={{
                  display: 'inline-block',
                  padding: '1px 8px',
                  borderRadius: 4,
                  fontSize: 9,
                  fontWeight: 700,
                  background: confStyle?.bg,
                  color: confStyle?.text,
                  border: `1px solid ${confStyle?.border}`,
                  letterSpacing: 0.5,
                }}>
                  {confidentiality}
                </span>
              )}
            </div>
          </div>

          {/* Right: QR Code */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {showQR && qrUrl ? (
              <img src={qrUrl} alt="QR Code" style={{ width: 56, height: 56 }} />
            ) : showQR ? (
              <div style={{
                width: 56, height: 56,
                border: '1px dashed #ccc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, color: '#aaa', textAlign: 'center',
              }}>
                QR Code
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Document meta strip ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9,
          color: '#888',
          marginBottom: 10,
          padding: '0 2px',
        }}>
          <span>Doc Ref: <strong style={{ color: '#555' }}>{docRef}</strong></span>
          {preparedBy && <span>Prepared: <strong style={{ color: '#555' }}>{preparedBy}</strong></span>}
        </div>

        {/* ── Main content (children) ── */}
        {children}

        {/* ── Signatures ── */}
        {showSignatures && (
          <div style={{
            marginTop: 48,
            display: 'grid',
            gridTemplateColumns: `repeat(${sigLabels.length}, 1fr)`,
            gap: 20,
            textAlign: 'center',
            fontSize: 12,
          }}>
            {sigLabels.map((label, idx) => (
              <div key={label + idx}>
                {sigNames[idx] && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#333', marginBottom: 4 }}>{sigNames[idx]}</div>
                )}
                <div style={{ borderTop: '1.5px solid #333', paddingTop: 5, margin: '0 20px', fontWeight: 700 }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>{/* end page content wrapper */}

      {/* ── Footer with page number, timestamp, doc ref ── */}
      <div
        className="report-footer"
        style={{
          position: 'absolute',
          bottom: isLandscape ? '5mm' : '8mm',
          left: padMM,
          right: padMM,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 9,
          color: '#999',
          borderTop: '1px solid #ddd',
          paddingTop: 6,
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        <span style={{ whiteSpace: 'nowrap' }}>Doc: {docRef} | {generatedTs}</span>
        <span className="report-page-number">Page 1</span>
        <span style={{ whiteSpace: 'nowrap' }}>Developed by Md. Asmaul Alam | 01770625848</span>
      </div>

      {extraFooter}

      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          @page { size: A4 ${orientation}; margin: ${isLandscape ? '8mm' : '10mm'}; }
          #${reportId} {
            width: ${pageW} !important;
            min-height: ${pageH} !important;
            overflow: visible !important;
            box-shadow: none !important;
            margin: 0 !important;
            ${!isLandscape ? 'padding: 0 !important;' : ''}
          }
          .report-watermark { color: rgba(0,0,0,0.03) !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}
