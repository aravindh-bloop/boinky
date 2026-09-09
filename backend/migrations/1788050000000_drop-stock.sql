-- Up Migration

-- The Stock tab (inventory + expenses + harvest records + the season money
-- summary) was removed from the product. Activities (the farm work log) stay.
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS harvests CASCADE;

-- Down Migration

-- Not reversible in a useful way — restore from 1700000000000_init.sql and
-- 1787902674126_farm-log.sql if the feature ever comes back.
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS harvests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  harvested_on DATE NOT NULL DEFAULT CURRENT_DATE,
  crop TEXT,
  quantity NUMERIC NOT NULL,
  unit TEXT,
  unit_price NUMERIC,
  revenue NUMERIC,
  buyer TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_type TEXT,
  quantity NUMERIC,
  unit TEXT,
  low_stock_at NUMERIC,
  purchase_date DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
