import { db } from './local-db'
import type { Recipe, RecipeStep, RecipeStepChemical, RecipeTemplate, Chemical, Process, CostingRecord } from '@/types'

// ─── Seed Chemicals ────────────────────────────────────────────────────────────
const CHEMICALS: Chemical[] = [
  { id: 'chem-01', name: 'Enzyme (Neutral)', category: 'Enzyme', unit: 'kg', price_per_kg: 4.50, current_stock: 280, minimum_stock_threshold: 50, supplier: 'Clariant BD', remarks: 'Bio-polishing enzyme', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-02', name: 'Sodium Hypochlorite', category: 'Bleach', unit: 'ltr', price_per_kg: 1.20, current_stock: 450, minimum_stock_threshold: 80, supplier: 'BSRM Chem', remarks: 'Bleaching agent 12%', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-03', name: 'Acetic Acid', category: 'Acid', unit: 'ltr', price_per_kg: 2.80, current_stock: 320, minimum_stock_threshold: 60, supplier: 'Linde BD', remarks: 'pH neutralizer', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-04', name: 'Sodium Carbonate (Soda Ash)', category: 'Alkali', unit: 'kg', price_per_kg: 0.85, current_stock: 600, minimum_stock_threshold: 100, supplier: 'Beximco Chem', remarks: 'Fixation alkali', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-05', name: 'Reactive Dye (Black B)', category: 'Dye', unit: 'kg', price_per_kg: 18.50, current_stock: 45, minimum_stock_threshold: 20, supplier: 'Dystar', remarks: 'Bifunctional reactive dye', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-06', name: 'Reactive Dye (Navy Blue)', category: 'Dye', unit: 'kg', price_per_kg: 21.00, current_stock: 38, minimum_stock_threshold: 20, supplier: 'Dystar', remarks: '', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-07', name: 'Softener (Amino Silicone)', category: 'Softener', unit: 'kg', price_per_kg: 3.60, current_stock: 210, minimum_stock_threshold: 40, supplier: 'CHT BD', remarks: 'Hydrophilic softener', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-08', name: 'Detergent (Anionic)', category: 'Detergent', unit: 'kg', price_per_kg: 2.20, current_stock: 380, minimum_stock_threshold: 60, supplier: 'Archroma', remarks: 'General washing detergent', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-09', name: 'Anti-Creasing Agent', category: 'Auxiliary', unit: 'kg', price_per_kg: 5.10, current_stock: 90, minimum_stock_threshold: 25, supplier: 'Huntsman', remarks: 'Prevents crease marks', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-10', name: 'Hydrogen Peroxide (50%)', category: 'Bleach', unit: 'ltr', price_per_kg: 1.80, current_stock: 195, minimum_stock_threshold: 40, supplier: 'BSRM Chem', remarks: 'Oxidative bleach', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-11', name: 'Sodium Silicate', category: 'Alkali', unit: 'kg', price_per_kg: 0.70, current_stock: 500, minimum_stock_threshold: 80, supplier: 'Beximco Chem', remarks: 'Peroxide stabilizer', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-12', name: 'Wetting Agent', category: 'Auxiliary', unit: 'kg', price_per_kg: 3.90, current_stock: 130, minimum_stock_threshold: 30, supplier: 'CHT BD', remarks: 'Improves dye penetration', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-13', name: 'Salt (NaCl)', category: 'Electrolyte', unit: 'kg', price_per_kg: 0.15, current_stock: 2000, minimum_stock_threshold: 500, supplier: 'Local', remarks: 'Dye exhaustion salt', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-14', name: 'Pumice Stone', category: 'Abrasive', unit: 'kg', price_per_kg: 0.50, current_stock: 800, minimum_stock_threshold: 200, supplier: 'Local Import', remarks: 'Stone washing abrasive', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-03-01T08:00:00Z' },
  { id: 'chem-15', name: 'Fixative (Cationic)', category: 'Fixative', unit: 'kg', price_per_kg: 4.20, current_stock: 22, minimum_stock_threshold: 30, supplier: 'Archroma', remarks: '⚠️ LOW STOCK', created_at: '2024-01-10T08:00:00Z', updated_at: '2024-04-01T08:00:00Z' },
]

// ─── Seed Processes ─────────────────────────────────────────────────────────────
const PROCESSES: Process[] = [
  { id: 'proc-01', name: 'Desizing', category: 'Pre-Treatment', default_temperature: 55, default_time: 20, default_non_op: 5, default_lr: '1:8', default_ph: '7.0', default_rpm: 30, description: 'Remove starch size from fabric', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-02', name: 'Stone Enzyme Wash', category: 'Enzyme', default_temperature: 50, default_time: 40, default_non_op: 10, default_lr: '1:8', default_ph: '4.5', default_rpm: 35, description: 'Bio-enzymatic abrasion with pumice stone', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-03', name: 'PP Bleach (Potassium Permanganate)', category: 'Bleach', default_temperature: 25, default_time: 15, default_non_op: 3, default_lr: '1:6', default_ph: '7.0', default_rpm: 20, description: 'Localized bleaching effect', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-04', name: 'Neutralization', category: 'Neutral', default_temperature: 40, default_time: 10, default_non_op: 2, default_lr: '1:8', default_ph: '6.5', default_rpm: 25, description: 'Neutralize after bleach or acid treatment', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-05', name: 'Dyeing (Reactive)', category: 'Dyeing', default_temperature: 60, default_time: 60, default_non_op: 10, default_lr: '1:10', default_ph: '11.0', default_rpm: 30, description: 'Exhaust dyeing with reactive dyes', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-06', name: 'Softening', category: 'Finish', default_temperature: 35, default_time: 20, default_non_op: 5, default_lr: '1:8', default_ph: '5.5', default_rpm: 25, description: 'Fabric softening treatment', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-07', name: 'Soaping', category: 'Wash-Off', default_temperature: 95, default_time: 15, default_non_op: 3, default_lr: '1:8', default_ph: '8.0', default_rpm: 30, description: 'Removes unfixed dye', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-08', name: 'Hot Wash', category: 'Wash', default_temperature: 80, default_time: 10, default_non_op: 2, default_lr: '1:8', default_ph: '7.0', default_rpm: 30, description: 'High temperature rinse', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-09', name: 'Cold Wash', category: 'Wash', default_temperature: 25, default_time: 8, default_non_op: 2, default_lr: '1:8', default_ph: '7.0', default_rpm: 30, description: 'Cold rinse', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-10', name: 'Peroxide Bleach', category: 'Bleach', default_temperature: 90, default_time: 30, default_non_op: 5, default_lr: '1:10', default_ph: '10.5', default_rpm: 30, description: 'H2O2 oxidative bleach', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-11', name: 'Acid Wash', category: 'Acid', default_temperature: 25, default_time: 12, default_non_op: 3, default_lr: '1:6', default_ph: '3.5', default_rpm: 20, description: 'Acid treatment for vintage look', created_at: '2024-01-05T08:00:00Z' },
  { id: 'proc-12', name: 'Anti-Crease Treatment', category: 'Auxiliary', default_temperature: 40, default_time: 15, default_non_op: 3, default_lr: '1:8', default_ph: '6.0', default_rpm: 25, description: 'Prevent crease marks during processing', created_at: '2024-01-05T08:00:00Z' },
]

// ─── Seed Recipes ───────────────────────────────────────────────────────────────
const RECIPES: Recipe[] = [
  {
    id: 'rec-01',
    recipe_no: 'RCP-2024-001',
    recipe_ref: 'ZARA-TRF-564-A',
    customer_name: 'ZARA-LADIES TRF',
    factory_name: 'Beximco Washing',
    style: 'CARGO SKIRT',
    item: 'Woven Bottoms',
    color: '958 Indigo',
    wash_type: 'REACTIVE DYE+DETERGENT+NEUTRAL+BIO POLISH+DYEING+NEUTRAL+SOAPING+SOFTENER',
    recipe_type: 'Bulk',
    status: 'Approved',
    batch_weight: 100,
    batch_quantity: 435,
    order_quantity: 5200,
    po: 'ZR-2024-APRL-0012',
    ob_no: 'OB-2024-0456',
    final_wash: 'Softener Wash',
    recipe_stage: 'Production',
    recipe_version: 'V2',
    machine_type: 'Overflow',
    recipe_time: 206,
    total_water: 1000,
    cost_batch: 36.40,
    cost_pc: 0.364,
    remarks: 'Approved for bulk production. Re-process rate 15%.',
    recipe_date: '2024-04-20',
    created_at: '2024-04-20T08:30:00Z',
    updated_at: '2024-04-22T10:00:00Z',
    created_by: 'Asmaul Alam'
  },
  {
    id: 'rec-02',
    recipe_no: 'RCP-2024-002',
    recipe_ref: 'NY-DLP-BLACK',
    customer_name: 'NEW YORKER',
    factory_name: 'Beximco Washing',
    style: 'EMBROIDARY PANTS',
    item: 'DAP',
    color: 'BLACK',
    wash_type: 'DESIZE+STONE ENZYME+PP BLEACH+NEUTRAL+ACID WASH+NEUTRAL+PP NEUTRAL+CLEANUP+TINT+SOFTNER',
    recipe_type: 'Sample',
    status: 'Finalized',
    batch_weight: 80,
    batch_quantity: 200,
    order_quantity: 3000,
    po: 'NY-2024-JAN-0023',
    ob_no: 'OB-2024-0301',
    final_wash: 'Tint + Softner',
    recipe_stage: 'Sample',
    recipe_version: 'V1',
    machine_type: 'Front Load',
    recipe_time: 185,
    total_water: 800,
    cost_batch: 23.50,
    cost_pc: 0.295,
    remarks: 'Best price confirmed at 14-80 DZN.',
    recipe_date: '2024-01-15',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-20T11:00:00Z',
    created_by: 'Asmaul Alam'
  },
  {
    id: 'rec-03',
    recipe_no: 'RCP-2024-003',
    recipe_ref: 'HM-STN-BLUE-03',
    customer_name: 'H&M',
    factory_name: 'Beximco Washing',
    style: 'SLIM FIT JEANS',
    item: 'Denim Bottoms',
    color: 'MID BLUE',
    wash_type: 'DESIZE+STONE ENZYME+NEUTRAL+SOFTENER',
    recipe_type: 'Original',
    status: 'Draft',
    batch_weight: 120,
    batch_quantity: 600,
    order_quantity: 7200,
    po: '',
    ob_no: 'OB-2024-0512',
    final_wash: 'Softener',
    recipe_stage: 'Development',
    recipe_version: 'V1',
    machine_type: 'Front Load',
    recipe_time: 140,
    total_water: 1200,
    cost_batch: 28.80,
    cost_pc: 0.240,
    remarks: 'First development sample. Shade approval pending.',
    recipe_date: '2024-05-10',
    created_at: '2024-05-10T10:00:00Z',
    updated_at: '2024-05-10T10:00:00Z',
    created_by: 'Asmaul Alam'
  },
  {
    id: 'rec-04',
    recipe_no: 'RCP-2024-004',
    recipe_ref: 'NEXT-CHINO-KHK',
    customer_name: 'NEXT UK',
    factory_name: 'Beximco Washing',
    style: 'CHINO TROUSER',
    item: 'Woven Bottoms',
    color: 'KHAKI',
    wash_type: 'ENZYME WASH+NEUTRAL+SOFTENER',
    recipe_type: 'Bulk',
    status: 'Approved',
    batch_weight: 90,
    batch_quantity: 450,
    order_quantity: 9000,
    po: 'NEXT-2024-Q2-7821',
    ob_no: 'OB-2024-0612',
    final_wash: 'Softener',
    recipe_stage: 'Production',
    recipe_version: 'V3',
    machine_type: 'Overflow',
    recipe_time: 110,
    total_water: 900,
    cost_batch: 18.90,
    cost_pc: 0.210,
    remarks: 'Regular order. Repeat recipe V3.',
    recipe_date: '2024-03-15',
    created_at: '2024-03-15T08:00:00Z',
    updated_at: '2024-03-18T09:00:00Z',
    created_by: 'Asmaul Alam'
  },
  {
    id: 'rec-05',
    recipe_no: 'RCP-2024-005',
    recipe_ref: 'GAP-BLEACH-WHITE',
    customer_name: 'GAP INC.',
    factory_name: 'Beximco Washing',
    style: 'RELAXED FIT JEANS',
    item: 'Denim Bottoms',
    color: 'BLEACH WHITE',
    wash_type: 'DESIZE+PEROXIDE BLEACH+NEUTRALIZATION+SOFTENER',
    recipe_type: 'Revised',
    status: 'Pending',
    batch_weight: 100,
    batch_quantity: 500,
    order_quantity: 6000,
    po: 'GAP-2024-0045',
    ob_no: 'OB-2024-0720',
    final_wash: 'Softener',
    recipe_stage: 'Lab Dip',
    recipe_version: 'V2',
    machine_type: 'Front Load',
    recipe_time: 155,
    total_water: 1000,
    cost_batch: 22.00,
    cost_pc: 0.220,
    remarks: 'Revised after QA rejection. Awaiting re-approval.',
    recipe_date: '2024-06-01',
    created_at: '2024-06-01T09:00:00Z',
    updated_at: '2024-06-03T14:00:00Z',
    created_by: 'Asmaul Alam'
  },
  {
    id: 'rec-06',
    recipe_no: 'RCP-2024-006',
    customer_name: 'C&A EUROPE',
    factory_name: 'Beximco Washing',
    style: 'STRETCH DENIM',
    item: 'Denim',
    color: 'DARK NAVY',
    wash_type: 'REACTIVE DYE+SOAPING+SOFTENER',
    recipe_type: 'Original',
    status: 'Draft',
    batch_weight: 100,
    batch_quantity: 400,
    order_quantity: 4800,
    po: '',
    ob_no: 'OB-2024-0810',
    final_wash: 'Softener',
    recipe_stage: 'Development',
    recipe_version: 'V1',
    machine_type: 'HT/HP',
    recipe_time: 180,
    total_water: 1000,
    cost_batch: 30.00,
    cost_pc: 0.300,
    remarks: 'New development for C&A AW24 collection.',
    recipe_date: '2024-07-20',
    created_at: '2024-07-20T10:00:00Z',
    updated_at: '2024-07-20T10:00:00Z',
    created_by: 'Asmaul Alam'
  },
]

// ─── Seed Recipe Steps ───────────────────────────────────────────────────────────
const RECIPE_STEPS: RecipeStep[] = [
  // Recipe rec-01 steps
  { id: 'step-01-01', recipe_id: 'rec-01', step_order: 1, process_name: 'Desizing', temperature: 55, time_minutes: 20, non_op_time: 5, ltr: '1:8', water_liters: 800, rpm: 30, ph: '7.0', remarks: 'Desize at 55°C' },
  { id: 'step-01-02', recipe_id: 'rec-01', step_order: 2, process_name: 'Enzyme Wash', temperature: 50, time_minutes: 40, non_op_time: 10, ltr: '1:8', water_liters: 800, rpm: 35, ph: '4.5', remarks: 'Acid enzyme' },
  { id: 'step-01-03', recipe_id: 'rec-01', step_order: 3, process_name: 'Neutralization', temperature: 40, time_minutes: 10, non_op_time: 2, ltr: '1:8', water_liters: 800, rpm: 25, ph: '6.5', remarks: '' },
  { id: 'step-01-04', recipe_id: 'rec-01', step_order: 4, process_name: 'Dyeing (Reactive)', temperature: 60, time_minutes: 60, non_op_time: 10, ltr: '1:10', water_liters: 1000, rpm: 30, ph: '11.0', remarks: 'Black + Navy blend' },
  { id: 'step-01-05', recipe_id: 'rec-01', step_order: 5, process_name: 'Soaping', temperature: 95, time_minutes: 15, non_op_time: 3, ltr: '1:8', water_liters: 800, rpm: 30, ph: '8.0', remarks: 'Hot soaping' },
  { id: 'step-01-06', recipe_id: 'rec-01', step_order: 6, process_name: 'Softening', temperature: 35, time_minutes: 20, non_op_time: 5, ltr: '1:8', water_liters: 800, rpm: 25, ph: '5.5', remarks: 'Amino silicone softener' },

  // Recipe rec-02 steps
  { id: 'step-02-01', recipe_id: 'rec-02', step_order: 1, process_name: 'Desizing', temperature: 55, time_minutes: 20, non_op_time: 5, ltr: '1:8', water_liters: 640, rpm: 30, ph: '7.0', remarks: '' },
  { id: 'step-02-02', recipe_id: 'rec-02', step_order: 2, process_name: 'Stone Enzyme Wash', temperature: 50, time_minutes: 40, non_op_time: 10, ltr: '1:8', water_liters: 640, rpm: 35, ph: '4.5', remarks: '50 kg pumice stone' },
  { id: 'step-02-03', recipe_id: 'rec-02', step_order: 3, process_name: 'PP Bleach', temperature: 25, time_minutes: 15, non_op_time: 3, ltr: '1:6', water_liters: 480, rpm: 20, ph: '7.0', remarks: 'KMnO4 spray' },
  { id: 'step-02-04', recipe_id: 'rec-02', step_order: 4, process_name: 'Neutralization', temperature: 40, time_minutes: 10, non_op_time: 2, ltr: '1:8', water_liters: 640, rpm: 25, ph: '6.5', remarks: '' },
  { id: 'step-02-05', recipe_id: 'rec-02', step_order: 5, process_name: 'Acid Wash', temperature: 25, time_minutes: 12, non_op_time: 3, ltr: '1:6', water_liters: 480, rpm: 20, ph: '3.5', remarks: 'Vintage look' },
  { id: 'step-02-06', recipe_id: 'rec-02', step_order: 6, process_name: 'Softening', temperature: 35, time_minutes: 20, non_op_time: 5, ltr: '1:8', water_liters: 640, rpm: 25, ph: '5.5', remarks: '' },

  // Recipe rec-03 steps
  { id: 'step-03-01', recipe_id: 'rec-03', step_order: 1, process_name: 'Desizing', temperature: 55, time_minutes: 20, non_op_time: 5, ltr: '1:8', water_liters: 960, rpm: 30, ph: '7.0', remarks: '' },
  { id: 'step-03-02', recipe_id: 'rec-03', step_order: 2, process_name: 'Stone Enzyme Wash', temperature: 50, time_minutes: 50, non_op_time: 10, ltr: '1:8', water_liters: 960, rpm: 35, ph: '4.5', remarks: '80 kg stone' },
  { id: 'step-03-03', recipe_id: 'rec-03', step_order: 3, process_name: 'Neutralization', temperature: 40, time_minutes: 10, non_op_time: 2, ltr: '1:8', water_liters: 960, rpm: 25, ph: '6.5', remarks: '' },
  { id: 'step-03-04', recipe_id: 'rec-03', step_order: 4, process_name: 'Softening', temperature: 35, time_minutes: 20, non_op_time: 5, ltr: '1:8', water_liters: 960, rpm: 25, ph: '5.5', remarks: '' },
]

// ─── Seed Step Chemicals ─────────────────────────────────────────────────────────
const STEP_CHEMICALS: RecipeStepChemical[] = [
  // rec-01 step 1 - Desizing
  { id: 'sc-01-01-01', recipe_id: 'rec-01', recipe_step_id: 'step-01-01', chemical_id: 'chem-08', chemical_name: 'Detergent (Anionic)', dosage: 1.0, unit: 'g/l', qty_grams: 800 },
  { id: 'sc-01-01-02', recipe_id: 'rec-01', recipe_step_id: 'step-01-01', chemical_id: 'chem-12', chemical_name: 'Wetting Agent', dosage: 0.5, unit: 'g/l', qty_grams: 400 },
  // rec-01 step 2 - Enzyme
  { id: 'sc-01-02-01', recipe_id: 'rec-01', recipe_step_id: 'step-01-02', chemical_id: 'chem-01', chemical_name: 'Enzyme (Neutral)', dosage: 2.0, unit: 'g/l', qty_grams: 1600 },
  { id: 'sc-01-02-02', recipe_id: 'rec-01', recipe_step_id: 'step-01-02', chemical_id: 'chem-03', chemical_name: 'Acetic Acid', dosage: 0.8, unit: 'g/l', qty_grams: 640 },
  // rec-01 step 4 - Dyeing
  { id: 'sc-01-04-01', recipe_id: 'rec-01', recipe_step_id: 'step-01-04', chemical_id: 'chem-05', chemical_name: 'Reactive Dye (Black B)', dosage: 3.0, unit: '%', qty_grams: 3000 },
  { id: 'sc-01-04-02', recipe_id: 'rec-01', recipe_step_id: 'step-01-04', chemical_id: 'chem-13', chemical_name: 'Salt (NaCl)', dosage: 60.0, unit: 'g/l', qty_grams: 60000 },
  { id: 'sc-01-04-03', recipe_id: 'rec-01', recipe_step_id: 'step-01-04', chemical_id: 'chem-04', chemical_name: 'Sodium Carbonate (Soda Ash)', dosage: 20.0, unit: 'g/l', qty_grams: 20000 },
  // rec-01 step 5 - Soaping
  { id: 'sc-01-05-01', recipe_id: 'rec-01', recipe_step_id: 'step-01-05', chemical_id: 'chem-08', chemical_name: 'Detergent (Anionic)', dosage: 1.5, unit: 'g/l', qty_grams: 1200 },
  // rec-01 step 6 - Softening
  { id: 'sc-01-06-01', recipe_id: 'rec-01', recipe_step_id: 'step-01-06', chemical_id: 'chem-07', chemical_name: 'Softener (Amino Silicone)', dosage: 3.0, unit: 'g/l', qty_grams: 2400 },
  { id: 'sc-01-06-02', recipe_id: 'rec-01', recipe_step_id: 'step-01-06', chemical_id: 'chem-03', chemical_name: 'Acetic Acid', dosage: 0.5, unit: 'g/l', qty_grams: 400 },

  // rec-02 step 2 - Stone Enzyme
  { id: 'sc-02-02-01', recipe_id: 'rec-02', recipe_step_id: 'step-02-02', chemical_id: 'chem-01', chemical_name: 'Enzyme (Neutral)', dosage: 2.5, unit: 'g/l', qty_grams: 1600 },
  { id: 'sc-02-02-02', recipe_id: 'rec-02', recipe_step_id: 'step-02-02', chemical_id: 'chem-14', chemical_name: 'Pumice Stone', dosage: 50, unit: 'kg', qty_grams: 50000 },
  // rec-02 step 3 - PP Bleach
  { id: 'sc-02-03-01', recipe_id: 'rec-02', recipe_step_id: 'step-02-03', chemical_id: 'chem-02', chemical_name: 'Sodium Hypochlorite', dosage: 2.0, unit: 'g/l', qty_grams: 960 },
  // rec-02 step 6 - Softening
  { id: 'sc-02-06-01', recipe_id: 'rec-02', recipe_step_id: 'step-02-06', chemical_id: 'chem-07', chemical_name: 'Softener (Amino Silicone)', dosage: 3.0, unit: 'g/l', qty_grams: 1920 },
]

// ─── Seed Costing Records ─────────────────────────────────────────────────────────
const COSTING_RECORDS: CostingRecord[] = [
  { id: 'cost-01', recipe_id: 'rec-01', name: 'ZARA Cargo Skirt - Apr 2024', customer_name: 'ZARA-LADIES TRF', total_cost: 36.40, cost_per_piece: 0.364, cost_per_kg: 3.64, created_at: '2024-04-20T09:00:00Z' },
  { id: 'cost-02', recipe_id: 'rec-02', name: 'New Yorker Embroidary Pants - Jan 2024', customer_name: 'NEW YORKER', total_cost: 23.50, cost_per_piece: 0.295, cost_per_kg: 2.95, created_at: '2024-01-15T10:00:00Z' },
  { id: 'cost-03', recipe_id: 'rec-04', name: 'NEXT Chino Trouser - Mar 2024', customer_name: 'NEXT UK', total_cost: 18.90, cost_per_piece: 0.210, cost_per_kg: 2.10, created_at: '2024-03-15T09:00:00Z' },
  { id: 'cost-04', recipe_id: 'rec-03', name: 'H&M Slim Fit - May 2024 Sample', customer_name: 'H&M', total_cost: 28.80, cost_per_piece: 0.240, cost_per_kg: 2.40, created_at: '2024-05-10T11:00:00Z' },
  { id: 'cost-05', recipe_id: 'rec-05', name: 'GAP Relaxed Bleach - Jun 2024 Revised', customer_name: 'GAP INC.', total_cost: 22.00, cost_per_piece: 0.220, cost_per_kg: 2.20, created_at: '2024-06-01T10:00:00Z' },
]

// ─── Seed Recipe Templates ────────────────────────────────────────────────────────
const TEMPLATES: RecipeTemplate[] = [
  {
    id: 'tmpl-01',
    name: 'Standard Stone Enzyme Wash',
    wash_type: 'Stone Enzyme',
    description: 'Classic stone enzyme wash for denim. Suitable for mid to dark shades.',
    steps: [
      { id: 'ts-01-01', recipe_id: '', step_order: 1, process_name: 'Desizing', temperature: 55, time_minutes: 20, non_op_time: 5, ltr: '1:8', rpm: 30, ph: '7.0' },
      { id: 'ts-01-02', recipe_id: '', step_order: 2, process_name: 'Stone Enzyme Wash', temperature: 50, time_minutes: 40, non_op_time: 10, ltr: '1:8', rpm: 35, ph: '4.5' },
      { id: 'ts-01-03', recipe_id: '', step_order: 3, process_name: 'Neutralization', temperature: 40, time_minutes: 10, non_op_time: 2, ltr: '1:8', rpm: 25, ph: '6.5' },
      { id: 'ts-01-04', recipe_id: '', step_order: 4, process_name: 'Softening', temperature: 35, time_minutes: 20, non_op_time: 5, ltr: '1:8', rpm: 25, ph: '5.5' },
    ],
    created_at: '2024-01-01T08:00:00Z'
  },
  {
    id: 'tmpl-02',
    name: 'Reactive Dye Process',
    wash_type: 'Reactive Dye',
    description: 'Full reactive dyeing sequence with enzyme pre-treatment.',
    steps: [
      { id: 'ts-02-01', recipe_id: '', step_order: 1, process_name: 'Desizing', temperature: 55, time_minutes: 20, non_op_time: 5, ltr: '1:8', rpm: 30, ph: '7.0' },
      { id: 'ts-02-02', recipe_id: '', step_order: 2, process_name: 'Enzyme Wash', temperature: 50, time_minutes: 40, non_op_time: 10, ltr: '1:8', rpm: 35, ph: '4.5' },
      { id: 'ts-02-03', recipe_id: '', step_order: 3, process_name: 'Neutralization', temperature: 40, time_minutes: 10, non_op_time: 2, ltr: '1:8', rpm: 25, ph: '6.5' },
      { id: 'ts-02-04', recipe_id: '', step_order: 4, process_name: 'Dyeing (Reactive)', temperature: 60, time_minutes: 60, non_op_time: 10, ltr: '1:10', rpm: 30, ph: '11.0' },
      { id: 'ts-02-05', recipe_id: '', step_order: 5, process_name: 'Soaping', temperature: 95, time_minutes: 15, non_op_time: 3, ltr: '1:8', rpm: 30, ph: '8.0' },
      { id: 'ts-02-06', recipe_id: '', step_order: 6, process_name: 'Softening', temperature: 35, time_minutes: 20, non_op_time: 5, ltr: '1:8', rpm: 25, ph: '5.5' },
    ],
    created_at: '2024-01-01T08:00:00Z'
  },
  {
    id: 'tmpl-03',
    name: 'Peroxide Bleach Sequence',
    wash_type: 'Bleach',
    description: 'Peroxide bleach for light to white shade results.',
    steps: [
      { id: 'ts-03-01', recipe_id: '', step_order: 1, process_name: 'Desizing', temperature: 55, time_minutes: 20, non_op_time: 5, ltr: '1:8', rpm: 30, ph: '7.0' },
      { id: 'ts-03-02', recipe_id: '', step_order: 2, process_name: 'Peroxide Bleach', temperature: 90, time_minutes: 30, non_op_time: 5, ltr: '1:10', rpm: 30, ph: '10.5' },
      { id: 'ts-03-03', recipe_id: '', step_order: 3, process_name: 'Neutralization', temperature: 40, time_minutes: 10, non_op_time: 2, ltr: '1:8', rpm: 25, ph: '6.5' },
      { id: 'ts-03-04', recipe_id: '', step_order: 4, process_name: 'Softening', temperature: 35, time_minutes: 20, non_op_time: 5, ltr: '1:8', rpm: 25, ph: '5.5' },
    ],
    created_at: '2024-01-01T08:00:00Z'
  },
]

// ─── Seed Dropdown Options ────────────────────────────────────────────────────
// NOTE: do NOT include 'id' here — dropdown_options uses ++id (auto-increment)
//       Dexie will reject string ids on an auto-increment table.
type SeedDropdown = { category: string; value: string }
const DROPDOWN_OPTIONS: SeedDropdown[] = [
  // Customers
  { category: 'customer', value: 'ZARA-LADIES TRF' },
  { category: 'customer', value: 'NEW YORKER' },
  { category: 'customer', value: 'H&M' },
  { category: 'customer', value: 'NEXT UK' },
  { category: 'customer', value: 'GAP INC.' },
  { category: 'customer', value: 'C&A EUROPE' },
  { category: 'customer', value: 'PRIMARK' },
  { category: 'customer', value: 'MANGO' },
  // Wash Types
  { category: 'wash_type', value: 'Stone Enzyme Wash' },
  { category: 'wash_type', value: 'Reactive Dye' },
  { category: 'wash_type', value: 'Peroxide Bleach' },
  { category: 'wash_type', value: 'Acid Wash' },
  { category: 'wash_type', value: 'PP Bleach' },
  { category: 'wash_type', value: 'Enzyme Wash' },
  { category: 'wash_type', value: 'Softener Wash' },
  { category: 'wash_type', value: 'Stone Wash' },
  { category: 'wash_type', value: 'Tinting' },
  // Machine Types
  { category: 'machine_type', value: 'Front Load' },
  { category: 'machine_type', value: 'Overflow' },
  { category: 'machine_type', value: 'HT/HP' },
  { category: 'machine_type', value: 'Jigger' },
  { category: 'machine_type', value: 'Winch' },
  // Colors
  { category: 'color', value: 'INDIGO' },
  { category: 'color', value: 'MID BLUE' },
  { category: 'color', value: 'DARK NAVY' },
  { category: 'color', value: 'BLACK' },
  { category: 'color', value: 'KHAKI' },
  { category: 'color', value: 'BLEACH WHITE' },
  { category: 'color', value: 'STONE WASH' },
  // Recipe Stages
  { category: 'recipe_stage', value: 'Lab Dip' },
  { category: 'recipe_stage', value: 'Sample' },
  { category: 'recipe_stage', value: 'Production' },
  { category: 'recipe_stage', value: 'Bulk' },
  // Items
  { category: 'item', value: 'Woven Bottoms' },
  { category: 'item', value: 'Knit Tops' },
  { category: 'item', value: 'Denim Jacket' },
  { category: 'item', value: 'DAP' },
  { category: 'item', value: 'Shorts' },
  // Factory Names
  { category: 'factory_name', value: 'Beximco Washing' },
  { category: 'factory_name', value: 'DBL Washing' },
  { category: 'factory_name', value: 'Square Washing' },
  // Final Wash
  { category: 'final_wash', value: 'Softener Wash' },
  { category: 'final_wash', value: 'Anti-Back Stain' },
  { category: 'final_wash', value: 'Hydro Extract' },
]

// ─── Seed Function ─────────────────────────────────────────────────────────────────
export async function seedDemoData(force = false): Promise<{ success: boolean; message: string }> {
  try {
    // Check if data already exists
    const existingRecipes = await db.recipes.count()
    if (existingRecipes > 0 && !force) {
      return { success: false, message: `Database already has ${existingRecipes} recipes. Use force=true to overwrite.` }
    }

    // If force, clear all tables first
    if (force) {
      await Promise.all([
        db.recipes.clear(),
        db.recipe_steps.clear(),
        db.recipe_step_chemicals.clear(),
        db.recipe_templates.clear(),
        db.chemicals.clear(),
        db.processes.clear(),
        db.costing_records.clear(),
        db.dropdown_options.clear(),
      ])
    }

    // Seed core tables — each in its own try/catch so one failure doesn't block others
    const errors: string[] = []

    try { await db.chemicals.bulkAdd(CHEMICALS) }
    catch (e: any) { errors.push('chemicals: ' + e?.message) }

    try { await db.processes.bulkAdd(PROCESSES) }
    catch (e: any) { errors.push('processes: ' + e?.message) }

    try { await db.dropdown_options.bulkAdd(DROPDOWN_OPTIONS as any[]) }
    catch (e: any) { errors.push('dropdown_options: ' + e?.message) }

    try { await db.recipe_templates.bulkAdd(TEMPLATES) }
    catch (e: any) { errors.push('templates: ' + e?.message) }

    try { await db.recipes.bulkAdd(RECIPES) }
    catch (e: any) { errors.push('recipes: ' + e?.message) }

    try { await db.recipe_steps.bulkAdd(RECIPE_STEPS) }
    catch (e: any) { errors.push('recipe_steps: ' + e?.message) }

    try { await db.recipe_step_chemicals.bulkAdd(STEP_CHEMICALS) }
    catch (e: any) { errors.push('step_chemicals: ' + e?.message) }

    try { await db.costing_records.bulkAdd(COSTING_RECORDS) }
    catch (e: any) { errors.push('costing_records: ' + e?.message) }

    const recipeCount = await db.recipes.count()
    if (recipeCount === 0) {
      return { success: false, message: `❌ Seeding failed. Errors: ${errors.join('; ')}` }
    }

    const warnMsg = errors.length > 0 ? ` (warnings: ${errors.join('; ')})` : ''
    return {
      success: true,
      message: `✅ Demo data loaded! ${RECIPES.length} recipes, ${CHEMICALS.length} chemicals, ${PROCESSES.length} processes, ${COSTING_RECORDS.length} costing records.${warnMsg}`
    }
  } catch (err: any) {
    return { success: false, message: `❌ Error seeding data: ${err?.message || err}` }
  }
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.recipes.clear(),
    db.recipe_steps.clear(),
    db.recipe_step_chemicals.clear(),
    db.recipe_templates.clear(),
    db.chemicals.clear(),
    db.processes.clear(),
    db.costing_records.clear(),
    db.dropdown_options.clear(),
  ])
}

export { RECIPES, CHEMICALS, PROCESSES, COSTING_RECORDS, TEMPLATES }
