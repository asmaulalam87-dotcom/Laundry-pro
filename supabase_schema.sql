-- ============================================================================
-- LAUNDRY PRO — Complete Supabase Database Schema
-- ============================================================================
-- 
-- HOW TO USE:
-- 1. Go to https://supabase.com/dashboard
-- 2. Create a new project (or open existing)
-- 3. Go to SQL Editor → New Query
-- 4. Paste this entire file and click "Run"
-- 5. Go to Project Settings → API → Copy URL and anon/public key
-- 6. Enter those credentials in the app Settings → Supabase Cloud Sync
--
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- ── Recipes ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  recipe_no TEXT,
  customer_name TEXT,
  factory_name TEXT,
  style TEXT,
  color TEXT,
  wash_type TEXT,
  status TEXT DEFAULT 'draft',
  recipe_ref TEXT,
  final_wash TEXT,
  po TEXT,
  ob_no TEXT,
  garment_qty INTEGER,
  remarks TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recipe Steps ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_steps (
  id TEXT PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
  step_order INTEGER,
  process_name TEXT,
  temperature NUMERIC,
  time_minutes NUMERIC,
  non_op_time NUMERIC,
  ph_range TEXT,
  default_ph TEXT,
  default_rpm TEXT,
  default_temperature TEXT,
  default_time TEXT,
  liquor_ratio TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recipe Step Chemicals ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_step_chemicals (
  id TEXT PRIMARY KEY,
  recipe_step_id TEXT REFERENCES recipe_steps(id) ON DELETE CASCADE,
  recipe_id TEXT,
  chemical_id TEXT,
  chemical_name TEXT,
  dosage TEXT,
  unit TEXT,
  cost_per_unit NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Chemicals ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chemicals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  supplier TEXT,
  current_stock NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  cost_per_unit NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  remarks TEXT,
  hazard_class TEXT,
  storage_condition TEXT,
  shelf_life TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Processes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  default_rpm TEXT,
  default_ph TEXT,
  default_temperature TEXT,
  default_time TEXT,
  default_liquor_ratio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Process Chemicals ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS process_chemicals (
  id TEXT PRIMARY KEY,
  process_id TEXT REFERENCES processes(id) ON DELETE CASCADE,
  chemical_id TEXT,
  chemical_name TEXT,
  dosage TEXT,
  unit TEXT,
  step_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Costing Records ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS costing_records (
  id TEXT PRIMARY KEY,
  recipe_id TEXT,
  recipe_no TEXT,
  customer_name TEXT,
  style TEXT,
  wash_type TEXT,
  total_chemical_cost NUMERIC DEFAULT 0,
  total_utility_cost NUMERIC DEFAULT 0,
  total_labor_cost NUMERIC DEFAULT 0,
  total_overhead_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  cost_per_pcs NUMERIC DEFAULT 0,
  garment_qty INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft',
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Dropdown Options ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dropdown_options (
  id INTEGER PRIMARY KEY,
  category TEXT,
  value TEXT,
  label TEXT
);

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  email TEXT,
  password_hash TEXT,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  designation TEXT,
  department TEXT,
  profile_photo TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── App Settings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  key TEXT,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recipe Templates ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  wash_type TEXT,
  description TEXT,
  steps JSONB DEFAULT '[]',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Production Schedule ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_schedule (
  id TEXT PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id),
  recipe_no TEXT,
  customer_name TEXT,
  style TEXT,
  wash_type TEXT,
  machine TEXT,
  date DATE,
  time_slot TEXT,
  status TEXT DEFAULT 'queued',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Shop Floor Jobs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_floor_jobs (
  id TEXT PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id),
  recipe_no TEXT,
  customer_name TEXT,
  style TEXT,
  color TEXT,
  wash_type TEXT,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  current_process TEXT,
  status TEXT DEFAULT 'waiting',
  machine TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT,
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Wash Requisitions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wash_requisitions (
  id TEXT PRIMARY KEY,
  requisition_no TEXT,
  recipe_id TEXT REFERENCES recipes(id),
  customer_name TEXT,
  style TEXT,
  color TEXT,
  wash_type TEXT,
  garment_qty INTEGER,
  factory_name TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  requested_by TEXT,
  approved_by TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  remarks TEXT
);

-- ── Chat Messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  channel TEXT DEFAULT 'general',
  user_id TEXT,
  user_name TEXT,
  message TEXT,
  type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Approval Workflow ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id),
  recipe_no TEXT,
  requested_by TEXT,
  requested_by_name TEXT,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_by_name TEXT,
  comments TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- ── Audit Log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  table_name TEXT,
  record_id TEXT,
  action TEXT,
  old_data JSONB,
  new_data JSONB,
  user_id TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (for performance)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_recipes_customer ON recipes(customer_name);
CREATE INDEX IF NOT EXISTS idx_recipes_style ON recipes(style);
CREATE INDEX IF NOT EXISTS idx_recipes_wash_type ON recipes(wash_type);
CREATE INDEX IF NOT EXISTS idx_recipes_status ON recipes(status);
CREATE INDEX IF NOT EXISTS idx_recipes_factory ON recipes(factory_name);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_step_chem_step_id ON recipe_step_chemicals(recipe_step_id);
CREATE INDEX IF NOT EXISTS idx_recipe_step_chem_recipe_id ON recipe_step_chemicals(recipe_id);

CREATE INDEX IF NOT EXISTS idx_chemicals_name ON chemicals(name);
CREATE INDEX IF NOT EXISTS idx_chemicals_category ON chemicals(category);
CREATE INDEX IF NOT EXISTS idx_chemicals_supplier ON chemicals(supplier);

CREATE INDEX IF NOT EXISTS idx_processes_name ON processes(name);
CREATE INDEX IF NOT EXISTS idx_processes_category ON processes(category);

CREATE INDEX IF NOT EXISTS idx_costing_recipe_id ON costing_records(recipe_id);
CREATE INDEX IF NOT EXISTS idx_costing_customer ON costing_records(customer_name);
CREATE INDEX IF NOT EXISTS idx_costing_status ON costing_records(status);

CREATE INDEX IF NOT EXISTS idx_dropdown_category ON dropdown_options(category);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_production_date ON production_schedule(date);
CREATE INDEX IF NOT EXISTS idx_production_machine ON production_schedule(machine);
CREATE INDEX IF NOT EXISTS idx_production_status ON production_schedule(status);

CREATE INDEX IF NOT EXISTS idx_shopfloor_status ON shop_floor_jobs(status);
CREATE INDEX IF NOT EXISTS idx_shopfloor_machine ON shop_floor_jobs(machine);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

CREATE INDEX IF NOT EXISTS idx_wash_req_status ON wash_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_wash_req_customer ON wash_requisitions(customer_name);

CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- IMPORTANT: For development/demo, we allow full anon access.
-- In production, configure proper RLS policies based on your auth setup.

-- Enable RLS on all tables
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_step_chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE costing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropdown_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_floor_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE wash_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Development: Allow full anon access (remove these in production!)
CREATE POLICY "Allow anon full access" ON recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON recipe_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON recipe_step_chemicals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON chemicals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON processes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON process_chemicals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON costing_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON dropdown_options FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON recipe_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON production_schedule FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON shop_floor_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON wash_requisitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON approval_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon full access" ON audit_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_recipes_updated_at BEFORE UPDATE ON recipes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_chemicals_updated_at BEFORE UPDATE ON chemicals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_processes_updated_at BEFORE UPDATE ON processes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_costing_updated_at BEFORE UPDATE ON costing_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_production_updated_at BEFORE UPDATE ON production_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_shopfloor_updated_at BEFORE UPDATE ON shop_floor_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_wash_req_updated_at BEFORE UPDATE ON wash_requisitions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_templates_updated_at BEFORE UPDATE ON recipe_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- TRIGGER: Audit log for recipe changes
-- ============================================================================

CREATE OR REPLACE FUNCTION log_recipe_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, user_name)
    VALUES ('recipes', NEW.id, 'INSERT', to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_name)
    VALUES ('recipes', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NEW.created_by);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, user_name)
    VALUES ('recipes', OLD.id, 'DELETE', to_jsonb(OLD), OLD.created_by);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipe_audit AFTER INSERT OR UPDATE OR DELETE ON recipes
  FOR EACH ROW EXECUTE FUNCTION log_recipe_change();

-- ============================================================================
-- VIEWS (useful for analytics and reports)
-- ============================================================================

-- Recipe summary with step and chemical counts
CREATE OR REPLACE VIEW recipe_summary AS
SELECT
  r.id,
  r.recipe_no,
  r.customer_name,
  r.style,
  r.color,
  r.wash_type,
  r.factory_name,
  r.status,
  COUNT(DISTINCT rs.id) AS step_count,
  COUNT(DISTINCT rsc.id) AS chemical_count,
  COALESCE(SUM(CAST(NULLIF(rsc.dosage, '') AS NUMERIC) * rsc.cost_per_unit), 0) AS total_chemical_cost,
  r.created_at
FROM recipes r
LEFT JOIN recipe_steps rs ON rs.recipe_id = r.id
LEFT JOIN recipe_step_chemicals rsc ON rsc.recipe_step_id = rs.id
GROUP BY r.id, r.recipe_no, r.customer_name, r.style, r.color, r.wash_type, r.factory_name, r.status, r.created_at;

-- Chemical stock status
CREATE OR REPLACE VIEW chemical_stock_status AS
SELECT
  c.id,
  c.name,
  c.category,
  c.current_stock,
  c.min_stock,
  c.unit,
  c.supplier,
  CASE
    WHEN c.current_stock <= 0 THEN 'out_of_stock'
    WHEN c.current_stock <= c.min_stock THEN 'low_stock'
    ELSE 'ok'
  END AS stock_status
FROM chemicals c;

-- Monthly recipe count
CREATE OR REPLACE VIEW monthly_recipe_count AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS recipe_count,
  COUNT(DISTINCT customer_name) AS customer_count
FROM recipes
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- ============================================================================
-- DONE! Your Supabase database is ready.
-- ============================================================================
-- Next steps:
-- 1. Go to Project Settings → API
-- 2. Copy the "Project URL" and "anon/public" key
-- 3. Enter them in Laundry Pro → Settings → Supabase Cloud Sync
-- 4. Click "Test Connection" then "Push to Cloud"
-- ============================================================================
