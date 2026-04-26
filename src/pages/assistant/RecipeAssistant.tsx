import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/services/local-db'
import { Bot, Sparkles, FlaskConical, Droplets, Thermometer, Clock, RotateCw, Zap, Plus, ArrowRight, Copy, Save, Download, BookOpen } from 'lucide-react'
import { toast } from 'sonner'

// ── Knowledge base for AI suggestions ──────────────────────────────────────────
// This is a template-based "AI" that uses domain knowledge of garment washing
// to suggest process steps and chemicals based on wash type + fabric.

interface SuggestedStep {
  process: string
  temperature: number
  time: number
  rpm: number
  ph: string
  lr: string
  chemicals: { name: string; dosage: string; unit: string }[]
  purpose: string
}

const FABRIC_TYPES = [
  'Denim', 'Cotton', 'Polyester', 'Viscose', 'Linen', 'Silk', 'Wool', 'Blend', 'Tencel', 'Nylon'
]

const WASH_TYPES = [
  'Enzyme Wash', 'Stone Wash', 'Acid Wash', 'Bleach Wash', 'Garment Dye', 'Pigment Dye',
  'Reactive Dye', 'Silicone Wash', 'Softener Wash', 'Bio-Polish', 'Desizing', 'Neutralization',
  'Sandblasting', 'Whisker', 'Destroy', 'Vintage', 'Tinting', 'Resin', 'Overdye',
  'Cold Wash', 'Mineral Wash', 'Snow Wash', 'Laser Wash', 'Potato Wash', 'Towel Wash', 'PP Spray',
]

// ── Knowledge base: typical process steps per wash type ─────────────────────────
const WASH_KNOWLEDGE: Record<string, SuggestedStep[]> = {
  'Enzyme Wash': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }, { name: 'Wetting Agent', dosage: '0.5', unit: 'g/l' }], purpose: 'Remove size from fabric' },
    { process: 'Bio-Polish', temperature: 55, time: 30, rpm: 28, ph: '4.5-5', lr: '1:8', chemicals: [{ name: 'Cellulase Enzyme', dosage: '2-3', unit: 'g/kg' }, { name: 'Acetic Acid', dosage: '0.5', unit: 'g/l' }], purpose: 'Remove fuzz, smooth surface' },
    { process: 'Rinse', temperature: 40, time: 5, rpm: 30, ph: '6-7', lr: '1:10', chemicals: [], purpose: 'Wash out enzymes' },
    { process: 'Neutralization', temperature: 45, time: 5, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Soda Ash', dosage: '1', unit: 'g/l' }], purpose: 'Neutralize acid' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel improvement' },
  ],
  'Stone Wash': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }, { name: 'Detergent', dosage: '1', unit: 'g/l' }], purpose: 'Remove size' },
    { process: 'Stone Wash', temperature: 50, time: 45, rpm: 25, ph: '6-7', lr: '1:6', chemicals: [{ name: 'Pumice Stone', dosage: '1:1', unit: 'ratio' }], purpose: 'Abrasion for faded look' },
    { process: 'Rinse', temperature: 40, time: 5, rpm: 30, ph: '6-7', lr: '1:10', chemicals: [], purpose: 'Remove stone dust' },
    { process: 'Bio-Polish', temperature: 55, time: 20, rpm: 28, ph: '4.5-5', lr: '1:8', chemicals: [{ name: 'Cellulase Enzyme', dosage: '1-2', unit: 'g/kg' }], purpose: 'Clean up loose fibers' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
  'Bleach Wash': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Bleaching', temperature: 50, time: 15, rpm: 25, ph: '10-11', lr: '1:8', chemicals: [{ name: 'Sodium Hypochlorite', dosage: '3-5', unit: 'g/l' }, { name: 'Soda Ash', dosage: '2', unit: 'g/l' }], purpose: 'Lighten fabric color' },
    { process: 'Anti-Chlor', temperature: 45, time: 5, rpm: 30, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Sodium Bisulfite', dosage: '1-2', unit: 'g/l' }], purpose: 'Neutralize chlorine' },
    { process: 'Rinse', temperature: 40, time: 5, rpm: 30, ph: '6-7', lr: '1:10', chemicals: [], purpose: 'Wash out chemicals' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
  'Reactive Dye': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Scouring', temperature: 80, time: 15, rpm: 28, ph: '9-10', lr: '1:8', chemicals: [{ name: 'Caustic Soda', dosage: '2', unit: 'g/l' }, { name: 'Detergent', dosage: '1', unit: 'g/l' }], purpose: 'Remove impurities' },
    { process: 'Dyeing', temperature: 60, time: 45, rpm: 25, ph: '10-11', lr: '1:8', chemicals: [{ name: 'Reactive Dye', dosage: 'As shade', unit: '%' }, { name: 'Salt (Glauber)', dosage: '40-60', unit: 'g/l' }, { name: 'Soda Ash', dosage: '10-15', unit: 'g/l' }], purpose: 'Apply reactive dye' },
    { process: 'Rinse', temperature: 40, time: 5, rpm: 30, ph: '6-7', lr: '1:10', chemicals: [], purpose: 'Wash off unfixed dye' },
    { process: 'Soaping', temperature: 90, time: 10, rpm: 28, ph: '7-8', lr: '1:8', chemicals: [{ name: 'Soaping Agent', dosage: '1-2', unit: 'g/l' }], purpose: 'Remove loose dye' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
  'Pigment Dye': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Scouring', temperature: 80, time: 15, rpm: 28, ph: '9-10', lr: '1:8', chemicals: [{ name: 'Caustic Soda', dosage: '2', unit: 'g/l' }, { name: 'Detergent', dosage: '1', unit: 'g/l' }], purpose: 'Remove impurities' },
    { process: 'Binder', temperature: 50, time: 10, rpm: 25, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Pigment Binder', dosage: '3-5', unit: 'g/l' }], purpose: 'Prepare for pigment' },
    { process: 'Pigment Dyeing', temperature: 50, time: 20, rpm: 25, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Pigment Color', dosage: 'As shade', unit: '%' }, { name: 'Urea', dosage: '5', unit: 'g/l' }], purpose: 'Apply pigment' },
    { process: 'Fixing', temperature: 60, time: 10, rpm: 25, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Fixing Agent', dosage: '1-2', unit: 'g/l' }], purpose: 'Fix pigment to fabric' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
  'Garment Dye': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Scouring & Bleaching', temperature: 80, time: 20, rpm: 28, ph: '10-11', lr: '1:8', chemicals: [{ name: 'Caustic Soda', dosage: '2', unit: 'g/l' }, { name: 'H2O2', dosage: '2', unit: 'g/l' }, { name: 'Stabilizer', dosage: '0.5', unit: 'g/l' }], purpose: 'Clean and prepare' },
    { process: 'Dyeing', temperature: 60, time: 40, rpm: 25, ph: '10-11', lr: '1:8', chemicals: [{ name: 'Reactive Dye', dosage: 'As shade', unit: '%' }, { name: 'Salt', dosage: '50-70', unit: 'g/l' }, { name: 'Soda Ash', dosage: '15', unit: 'g/l' }], purpose: 'Apply color' },
    { process: 'Soaping', temperature: 90, time: 10, rpm: 28, ph: '7-8', lr: '1:8', chemicals: [{ name: 'Soaping Agent', dosage: '2', unit: 'g/l' }], purpose: 'Wash off unfixed dye' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
  'Silicone Wash': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Washing', temperature: 50, time: 10, rpm: 28, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Detergent', dosage: '1', unit: 'g/l' }], purpose: 'Clean fabric' },
    { process: 'Silicone Wash', temperature: 40, time: 15, rpm: 22, ph: '5-6', lr: '1:6', chemicals: [{ name: 'Silicone Softener', dosage: '3-5', unit: 'g/l' }, { name: 'Micro Silicone', dosage: '1-2', unit: 'g/l' }], purpose: 'Premium soft feel' },
    { process: 'Hydro Extract', temperature: 0, time: 5, rpm: 0, ph: '-', lr: '-', chemicals: [], purpose: 'Remove excess water' },
  ],
  'Bio-Polish': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Bio-Polish', temperature: 55, time: 30, rpm: 28, ph: '4.5-5', lr: '1:8', chemicals: [{ name: 'Acid Cellulase', dosage: '2-3', unit: 'g/kg' }, { name: 'Acetic Acid', dosage: '0.5', unit: 'g/l' }], purpose: 'Remove surface fuzz' },
    { process: 'Rinse', temperature: 40, time: 5, rpm: 30, ph: '6-7', lr: '1:10', chemicals: [], purpose: 'Wash out enzymes' },
    { process: 'Neutralization', temperature: 45, time: 5, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Soda Ash', dosage: '1', unit: 'g/l' }], purpose: 'Neutralize acid' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
  'Acid Wash': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Acid Wash', temperature: 40, time: 20, rpm: 25, ph: '2-3', lr: '1:6', chemicals: [{ name: 'Potassium Permanganate', dosage: '3-5', unit: 'g/l' }, { name: 'Phosphoric Acid', dosage: '1-2', unit: 'g/l' }], purpose: 'Acid etching for contrast' },
    { process: 'Neutralization', temperature: 50, time: 10, rpm: 30, ph: '7-8', lr: '1:8', chemicals: [{ name: 'Sodium Bisulfite', dosage: '2', unit: 'g/l' }, { name: 'Soda Ash', dosage: '1', unit: 'g/l' }], purpose: 'Neutralize acid' },
    { process: 'Rinse', temperature: 40, time: 5, rpm: 30, ph: '6-7', lr: '1:10', chemicals: [], purpose: 'Wash out chemicals' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
  'Softener Wash': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Washing', temperature: 50, time: 10, rpm: 28, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Detergent', dosage: '1', unit: 'g/l' }], purpose: 'Clean fabric' },
    { process: 'Softener', temperature: 40, time: 15, rpm: 22, ph: '5-6', lr: '1:6', chemicals: [{ name: 'Cationic Softener', dosage: '3-5', unit: 'g/l' }], purpose: 'Soft hand feel' },
    { process: 'Hydro Extract', temperature: 0, time: 5, rpm: 0, ph: '-', lr: '-', chemicals: [], purpose: 'Remove water' },
  ],
  'Tinting': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Washing', temperature: 50, time: 10, rpm: 28, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Detergent', dosage: '1', unit: 'g/l' }], purpose: 'Clean' },
    { process: 'Tinting', temperature: 60, time: 15, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Direct Dye', dosage: 'As shade', unit: '%' }, { name: 'Salt', dosage: '10-20', unit: 'g/l' }], purpose: 'Apply tint color' },
    { process: 'Fixing', temperature: 50, time: 10, rpm: 25, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Fixing Agent', dosage: '1-2', unit: 'g/l' }], purpose: 'Fix tint' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
  'Resin': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Resin Application', temperature: 30, time: 15, rpm: 20, ph: '4-5', lr: '1:6', chemicals: [{ name: 'Resin (DMDHEU)', dosage: '8-12', unit: 'g/l' }, { name: 'Catalyst (MgCl2)', dosage: '2-3', unit: 'g/l' }, { name: 'Softener', dosage: '1-2', unit: 'g/l' }], purpose: 'Apply wrinkle-free resin' },
    { process: 'Drying', temperature: 80, time: 15, rpm: 0, ph: '-', lr: '-', chemicals: [], purpose: 'Dry fabric' },
    { process: 'Curing', temperature: 150, time: 3, rpm: 0, ph: '-', lr: '-', chemicals: [], purpose: 'Cross-link resin' },
  ],
  'Vintage': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Enzyme Wash', temperature: 55, time: 30, rpm: 28, ph: '4.5-5', lr: '1:8', chemicals: [{ name: 'Cellulase Enzyme', dosage: '2-3', unit: 'g/kg' }, { name: 'Pumice Stone', dosage: '1:2', unit: 'ratio' }], purpose: 'Abrasion + bio-fade' },
    { process: 'Bleach Touch', temperature: 45, time: 8, rpm: 25, ph: '10-11', lr: '1:8', chemicals: [{ name: 'Sodium Hypochlorite', dosage: '1-2', unit: 'g/l' }], purpose: 'Light bleach for vintage' },
    { process: 'Neutralization', temperature: 50, time: 5, rpm: 30, ph: '7', lr: '1:8', chemicals: [{ name: 'Sodium Bisulfite', dosage: '1', unit: 'g/l' }], purpose: 'Neutralize' },
    { process: 'Tinting', temperature: 55, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Direct Dye', dosage: 'As shade', unit: '%' }], purpose: 'Vintage tint' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
  'Cold Wash': [
    { process: 'Cold Wash', temperature: 25, time: 10, rpm: 30, ph: '6-7', lr: '1:10', chemicals: [{ name: 'Detergent', dosage: '1', unit: 'g/l' }], purpose: 'Light cold wash' },
    { process: 'Rinse', temperature: 25, time: 5, rpm: 30, ph: '6-7', lr: '1:10', chemicals: [], purpose: 'Rinse' },
    { process: 'Softener', temperature: 30, time: 8, rpm: 22, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2', unit: 'g/l' }], purpose: 'Soft feel' },
  ],
  'Mineral Wash': [
    { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size' },
    { process: 'Bleach', temperature: 50, time: 15, rpm: 25, ph: '10-11', lr: '1:8', chemicals: [{ name: 'Sodium Hypochlorite', dosage: '3-5', unit: 'g/l' }], purpose: 'Lighten base' },
    { process: 'Mineral Wash', temperature: 50, time: 20, rpm: 25, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Potassium Permanganate', dosage: '5-10', unit: 'g/l' }, { name: 'Pumice Stone', dosage: '1:1', unit: 'ratio' }], purpose: 'Mineral effect' },
    { process: 'Neutralization', temperature: 50, time: 10, rpm: 30, ph: '7', lr: '1:8', chemicals: [{ name: 'Sodium Bisulfite', dosage: '2', unit: 'g/l' }], purpose: 'Neutralize' },
    { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Cationic Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
  ],
}

// Fabric-specific adjustments
const FABRIC_ADJUSTMENTS: Record<string, { tempMod: number; rpmMod: number; notes: string }> = {
  'Denim':    { tempMod: 0,   rpmMod: 0,  notes: 'Standard denim processes apply' },
  'Cotton':   { tempMod: 0,   rpmMod: 0,  notes: 'Most common fabric for washing' },
  'Polyester': { tempMod: -10, rpmMod: -5, notes: 'Lower temp to avoid setting creases' },
  'Viscose':  { tempMod: -15, rpmMod: -5, notes: 'Delicate — reduce temp & mechanical action' },
  'Linen':    { tempMod: 5,   rpmMod: 0,  notes: 'Can handle higher temperatures' },
  'Silk':     { tempMod: -20, rpmMod: -10, notes: 'Very delicate — minimal mechanical action' },
  'Wool':     { tempMod: -15, rpmMod: -8, notes: 'Felting risk — low temp, low RPM' },
  'Tencel':   { tempMod: -10, rpmMod: -5, notes: 'Fibrillation risk — gentle process' },
  'Nylon':    { tempMod: -10, rpmMod: 0,  notes: 'Heat sensitive — reduce temperature' },
  'Blend':    { tempMod: -5,  rpmMod: -3, notes: 'Adjust for most sensitive component' },
}

export const RecipeAssistant = () => {
  const navigate = useNavigate()
  const [washType, setWashType] = useState('')
  const [fabric, setFabric] = useState('')
  const [batchWeight, setBatchWeight] = useState(100)
  const [suggestions, setSuggestions] = useState<SuggestedStep[]>([])
  const [showResults, setShowResults] = useState(false)
  const [availableChemicals, setAvailableChemicals] = useState<string[]>([])
  const [savedTemplates, setSavedTemplates] = useState<any[]>([])

  // Load chemical names from DB for cross-referencing
  useEffect(() => {
    db.chemicals.toArray().then(chems => {
      setAvailableChemicals(chems.map(c => c.name))
    }).catch(() => {})
    // Load saved templates
    try {
      const saved = localStorage.getItem('ai_saved_templates')
      if (saved) setSavedTemplates(JSON.parse(saved))
    } catch {}
  }, [])

  const generateSuggestions = () => {
    if (!washType) {
      toast.error('Please select a wash type')
      return
    }

    // Get base process from knowledge base
    let baseSteps: SuggestedStep[] = WASH_KNOWLEDGE[washType] ?? []
    if (baseSteps.length === 0) {
      // Try partial match
      const key = Object.keys(WASH_KNOWLEDGE).find(k => washType.includes(k) || k.includes(washType))
      baseSteps = key ? (WASH_KNOWLEDGE[key] ?? []) : []
    }

    if (baseSteps.length === 0) {
      // Generate generic recipe
      baseSteps = [
        { process: 'Desizing', temperature: 60, time: 15, rpm: 30, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Alpha Amylase', dosage: '1-2', unit: 'g/kg' }], purpose: 'Remove size from fabric' },
        { process: 'Washing', temperature: 50, time: 10, rpm: 28, ph: '6-7', lr: '1:8', chemicals: [{ name: 'Detergent', dosage: '1', unit: 'g/l' }], purpose: 'Clean fabric' },
        { process: 'Rinse', temperature: 40, time: 5, rpm: 30, ph: '6-7', lr: '1:10', chemicals: [], purpose: 'Wash out chemicals' },
        { process: 'Softener', temperature: 40, time: 10, rpm: 25, ph: '5-6', lr: '1:8', chemicals: [{ name: 'Softener', dosage: '2-3', unit: 'g/l' }], purpose: 'Hand feel' },
      ]
    }

    // Apply fabric-specific adjustments
    const fabricAdj = FABRIC_ADJUSTMENTS[fabric]
    if (fabricAdj) {
      baseSteps = baseSteps.map(step => ({
        ...step,
        temperature: Math.max(20, step.temperature + fabricAdj.tempMod),
        rpm: Math.max(5, step.rpm + fabricAdj.rpmMod),
      }))
    }

    setSuggestions(baseSteps)
    setShowResults(true)
    toast.success(`Generated ${baseSteps.length} process steps for ${washType}`)
  }

  // Calculate estimated totals
  const totalTime = suggestions.reduce((s, step) => s + step.time, 0)
  const totalChemicals = suggestions.reduce((s, step) => s + step.chemicals.length, 0)
  const avgTemp = suggestions.length > 0
    ? Math.round(suggestions.reduce((s, step) => s + step.temperature, 0) / suggestions.length)
    : 0

  // Create a new recipe from suggestions
  const createRecipeFromSuggestions = () => {
    const template = {
      washType,
      fabric,
      batchWeight,
      steps: suggestions,
    }
    localStorage.setItem('ai_recipe_template', JSON.stringify(template))
    navigate('/recipes/builder?from_ai=1')
    toast.success('Recipe template loaded in builder')
  }

  // Copy recipe as text
  const handleCopyRecipe = () => {
    const lines = [
      `Wash Type: ${washType}`,
      `Fabric: ${fabric || 'N/A'}`,
      `Batch: ${batchWeight} KG`,
      '',
      ...suggestions.map((s, i) => [
        `Step ${i + 1}: ${s.process}`,
        `  Temp: ${s.temperature}°C | Time: ${s.time}min | RPM: ${s.rpm} | pH: ${s.ph} | LR: ${s.lr}`,
        `  Purpose: ${s.purpose}`,
        ...(s.chemicals.length > 0 ? [`  Chemicals: ${s.chemicals.map(c => `${c.name} ${c.dosage}${c.unit}`).join(', ')}`] : []),
      ].join('\n')),
    ]
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      toast.success('Recipe copied to clipboard')
    }).catch(() => toast.error('Failed to copy'))
  }

  // Save as template
  const handleSaveTemplate = () => {
    const template = {
      id: Date.now().toString(36),
      name: `${washType}${fabric ? ` - ${fabric}` : ''}`,
      washType,
      fabric,
      batchWeight,
      steps: suggestions,
      savedAt: new Date().toISOString(),
    }
    const updated = [template, ...savedTemplates].slice(0, 20)
    setSavedTemplates(updated)
    localStorage.setItem('ai_saved_templates', JSON.stringify(updated))
    toast.success('Template saved')
  }

  // Load template
  const handleLoadTemplate = (tpl: any) => {
    setWashType(tpl.washType)
    setFabric(tpl.fabric || '')
    setBatchWeight(tpl.batchWeight || 100)
    setSuggestions(tpl.steps)
    setShowResults(true)
    toast.success(`Loaded template: ${tpl.name}`)
  }

  // Export recipe
  const handleExport = () => {
    const lines = [
      `AI-GENERATED RECIPE`,
      `Generated: ${new Date().toLocaleString()}`,
      `Wash Type: ${washType}`,
      `Fabric: ${fabric || 'N/A'}`,
      `Batch Weight: ${batchWeight} KG`,
      `Total Time: ${totalTime} min`,
      '',
      ...suggestions.map((s, i) => [
        `--- Step ${i + 1}: ${s.process} ---`,
        `  Temperature: ${s.temperature}°C`,
        `  Time: ${s.time} min`,
        `  RPM: ${s.rpm}`,
        `  pH: ${s.ph}`,
        `  Liquor Ratio: ${s.lr}`,
        `  Purpose: ${s.purpose}`,
        ...(s.chemicals.length > 0 ? ['', '  Chemicals:', ...s.chemicals.map(c => `    - ${c.name}: ${c.dosage} ${c.unit}`)] : []),
      ].join('\n')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-recipe-${washType.toLowerCase().replace(/\s+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Recipe exported')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="w-8 h-8 text-indigo-500" />
          Recipe AI Assistant
        </h1>
        <p className="text-muted-foreground mt-1">
          Smart recipe suggestions based on wash type and fabric. Powered by domain knowledge base.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Input Panel ─────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Configuration
          </h2>

          <div>
            <label className="block text-sm font-medium mb-1.5">Wash Type *</label>
            <select
              value={washType}
              onChange={e => setWashType(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select wash type…</option>
              {WASH_TYPES.map(wt => (
                <option key={wt} value={wt}>{wt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Fabric Type</label>
            <select
              value={fabric}
              onChange={e => setFabric(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select fabric…</option>
              {FABRIC_TYPES.map(ft => (
                <option key={ft} value={ft}>{ft}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Batch Weight (KG)</label>
            <input
              type="number"
              value={batchWeight}
              onChange={e => setBatchWeight(Number(e.target.value) || 100)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {fabric && FABRIC_ADJUSTMENTS[fabric] && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs">
              <p className="font-semibold text-amber-400 mb-1">Fabric Adjustment: {fabric}</p>
              <p className="text-muted-foreground">{FABRIC_ADJUSTMENTS[fabric].notes}</p>
              <p className="text-muted-foreground mt-1">
                Temp: {FABRIC_ADJUSTMENTS[fabric].tempMod > 0 ? '+' : ''}{FABRIC_ADJUSTMENTS[fabric].tempMod}°C &middot;
                RPM: {FABRIC_ADJUSTMENTS[fabric].rpmMod > 0 ? '+' : ''}{FABRIC_ADJUSTMENTS[fabric].rpmMod}
              </p>
            </div>
          )}

          <button
            onClick={generateSuggestions}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
          >
            <Zap className="w-4 h-4" />
            Generate Recipe
          </button>
        </div>

        {/* ── Results Panel ───────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {!showResults ? (
            <div className="bg-card border border-border rounded-lg p-12 flex flex-col items-center justify-center text-muted-foreground">
              <Bot className="w-20 h-20 mb-4 opacity-20" />
              <p className="text-lg font-medium">AI Recipe Assistant</p>
              <p className="text-sm mt-1 text-center max-w-md">
                Select a wash type and fabric to get intelligent process step suggestions with chemical recommendations, 
                temperature, time, and pH parameters optimized for your specific requirements.
              </p>
            </div>
          ) : (
            <>
              {/* Quick stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <FlaskConical className="w-5 h-5 mx-auto text-blue-400 mb-1" />
                  <div className="text-xl font-bold">{suggestions.length}</div>
                  <div className="text-[10px] text-muted-foreground">Process Steps</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <Droplets className="w-5 h-5 mx-auto text-cyan-400 mb-1" />
                  <div className="text-xl font-bold">{totalChemicals}</div>
                  <div className="text-[10px] text-muted-foreground">Chemicals</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <Thermometer className="w-5 h-5 mx-auto text-red-400 mb-1" />
                  <div className="text-xl font-bold">{avgTemp}°C</div>
                  <div className="text-[10px] text-muted-foreground">Avg Temperature</div>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 text-center">
                  <Clock className="w-5 h-5 mx-auto text-amber-400 mb-1" />
                  <div className="text-xl font-bold">{totalTime}m</div>
                  <div className="text-[10px] text-muted-foreground">Total Time</div>
                </div>
              </div>

              {/* Process steps */}
              {suggestions.map((step, idx) => (
                <div key={idx} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div>
                        <h3 className="font-semibold text-sm">{step.process}</h3>
                        <p className="text-xs text-muted-foreground">{step.purpose}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" />{step.temperature}°C</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{step.time}min</span>
                      <span className="flex items-center gap-1"><RotateCw className="w-3 h-3" />{step.rpm} RPM</span>
                      <span>pH: {step.ph}</span>
                      <span>LR: {step.lr}</span>
                    </div>
                  </div>

                  {step.chemicals.length > 0 && (
                    <div className="ml-10 flex flex-wrap gap-2">
                      {step.chemicals.map((chem, ci) => {
                        const inStock = availableChemicals.includes(chem.name)
                        return (
                          <span
                            key={ci}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                              inStock
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            <FlaskConical className="w-3 h-3" />
                            {chem.name} — {chem.dosage} {chem.unit}
                            {!inStock && ' (not in stock)'}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* Action buttons */}
              <div className="flex justify-between gap-3 flex-wrap">
                <div className="flex gap-2">
                  <button onClick={handleCopyRecipe}
                    className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 border border-border rounded-lg text-xs font-medium">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                  <button onClick={handleSaveTemplate}
                    className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 border border-border rounded-lg text-xs font-medium">
                    <Save className="w-3.5 h-3.5" /> Save Template
                  </button>
                  <button onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 border border-border rounded-lg text-xs font-medium">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResults(false)}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 border border-border rounded-lg text-sm font-medium"
                  >
                    Start Over
                  </button>
                  <button
                    onClick={createRecipeFromSuggestions}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Recipe
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Saved Templates */}
              {savedTemplates.length > 0 && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    Saved Templates ({savedTemplates.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {savedTemplates.map((tpl: any) => (
                      <button key={tpl.id} onClick={() => handleLoadTemplate(tpl)}
                        className="text-left p-2 bg-muted/50 hover:bg-muted border border-border rounded-lg text-xs">
                        <div className="font-semibold">{tpl.name}</div>
                        <div className="text-muted-foreground mt-0.5">{tpl.steps?.length || 0} steps · {tpl.batchWeight}kg</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
