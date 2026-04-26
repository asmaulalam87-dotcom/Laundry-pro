export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user' | 'manager'
  created_at: string
}

export interface Recipe {
  id: string
  recipe_no: string
  recipe_ref?: string
  customer_name: string
  factory_name: string
  style: string
  item?: string
  color: string
  wash_type: string
  recipe_type: 'Original' | 'Sample' | 'Bulk' | 'Revised'
  status: 'Draft' | 'Pending' | 'Approved' | 'Finalized' | 'Rejected'
  batch_weight: number
  batch_quantity: number
  order_quantity?: number
  po?: string
  ob_no?: string
  final_wash?: string
  recipe_stage?: string
  recipe_version?: string
  machine_type?: string
  recipe_time?: number
  total_water?: number
  cost_batch?: number
  cost_pc?: number
  remarks?: string
  recipe_date: string
  photos?: string[]
  created_at: string
  updated_at: string
  created_by: string
}

export interface RecipeStep {
  id: string
  recipe_id: string
  step_order: number
  process_name: string
  temperature?: number
  time_minutes?: number
  non_op_time?: number
  ltr?: string
  chemical_dosage?: number
  water_liters?: number
  step_weight?: number
  step_qty?: number
  rpm?: number
  ph?: string
  remarks?: string
  chemicals?: RecipeStepChemical[]
}

export interface RecipeStepChemical {
  id: string
  recipe_step_id?: string
  recipe_id?: string
  step_id?: string
  chemical_id?: string
  chemical_name: string
  batch_no?: string
  dosage?: number
  dosage_g_per_kg?: number
  qty_grams?: number
  unit?: 'g/l' | 'ml/l' | '%' | 'g/kg' | 'ml/kg' | 'kg'
}

export interface RecipeTemplate {
  id: string
  name: string
  wash_type: string
  description?: string
  steps: RecipeStep[]
  created_at: string
}

export interface Chemical {
  id: string
  name: string
  category: string
  unit: string
  price_per_kg: number
  current_stock: number
  minimum_stock_threshold: number
  supplier?: string
  remarks?: string
  created_at: string
  updated_at: string
}

export interface Process {
  id: string
  name: string
  category: string
  default_temperature?: number
  default_time?: number
  default_non_op?: number
  default_lr?: string
  default_ph?: string
  default_rpm?: number
  description?: string
  created_at: string
}

export interface CostingRecord {
  id: string
  recipe_id?: string
  name: string
  customer_name: string
  total_cost: number
  cost_per_piece: number
  cost_per_kg: number
  created_at: string
}

export interface DropdownOption {
  id?: number        // auto-increment integer assigned by Dexie (++id)
  category: string
  value: string
  created_at?: string
}
