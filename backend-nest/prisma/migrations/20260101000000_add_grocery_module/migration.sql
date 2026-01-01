-- Grocery Stokvel Module Migration
-- This migration adds all tables required for the Grocery module

-- ============================================
-- ENUMS
-- ============================================

-- Grocery category enum
CREATE TYPE "GroceryCategory" AS ENUM (
  'STAPLES',
  'MEAT',
  'DAIRY',
  'VEGETABLES',
  'FRUITS',
  'BEVERAGES',
  'TOILETRIES',
  'CLEANING',
  'VOUCHERS',
  'OTHER'
);

-- Grocery purchase status enum
CREATE TYPE "GroceryPurchaseStatus" AS ENUM (
  'PENDING',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

-- Stock movement type enum
CREATE TYPE "StockMovementType" AS ENUM (
  'IN',
  'OUT',
  'ADJUSTMENT'
);

-- Distribution status enum
CREATE TYPE "GroceryDistributionStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

-- Allocation rule enum
CREATE TYPE "AllocationRule" AS ENUM (
  'EQUAL_SHARE',
  'PROPORTIONAL',
  'CUSTOM'
);

-- Distribution item status enum
CREATE TYPE "DistributionItemStatus" AS ENUM (
  'PENDING',
  'PACKED',
  'COLLECTED',
  'CONFIRMED',
  'CANCELLED'
);

-- Add new ledger entry types (if not exists - using ALTER TYPE)
ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'GROCERY_PURCHASE_DEBIT';
ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'GROCERY_ADJUSTMENT';

-- Add new document type
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'GROCERY_RECEIPT';

-- ============================================
-- TABLES
-- ============================================

-- Grocery Products (per-group catalog)
CREATE TABLE "grocery_products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "name" VARCHAR(200) NOT NULL,
  "unit" VARCHAR(50) NOT NULL,
  "category" "GroceryCategory" NOT NULL,
  "default_size" DECIMAL(10, 3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  
  CONSTRAINT "grocery_products_group_name_unique" UNIQUE ("group_id", "name")
);

-- Indexes for grocery_products
CREATE INDEX "grocery_products_group_id_idx" ON "grocery_products"("group_id");
CREATE INDEX "grocery_products_category_idx" ON "grocery_products"("category");
CREATE INDEX "grocery_products_active_idx" ON "grocery_products"("active");

-- Grocery Purchases (bulk purchases / stock-in events)
CREATE TABLE "grocery_purchases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "created_by_id" UUID NOT NULL REFERENCES "users"("id"),
  "approved_by_id" UUID REFERENCES "users"("id"),
  "receipt_document_id" UUID REFERENCES "documents"("id"),
  "supplier_name" VARCHAR(200) NOT NULL,
  "purchase_date" DATE NOT NULL,
  "total_amount" DECIMAL(19, 4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ZAR',
  "status" "GroceryPurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "approved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ,
  
  CONSTRAINT "grocery_purchases_total_positive" CHECK ("total_amount" > 0)
);

-- Indexes for grocery_purchases
CREATE INDEX "grocery_purchases_group_id_idx" ON "grocery_purchases"("group_id");
CREATE INDEX "grocery_purchases_status_idx" ON "grocery_purchases"("status");
CREATE INDEX "grocery_purchases_purchase_date_idx" ON "grocery_purchases"("purchase_date");
CREATE INDEX "grocery_purchases_created_by_id_idx" ON "grocery_purchases"("created_by_id");

-- Grocery Purchase Items (line items in a purchase)
CREATE TABLE "grocery_purchase_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchase_id" UUID NOT NULL REFERENCES "grocery_purchases"("id") ON DELETE CASCADE,
  "product_id" UUID NOT NULL REFERENCES "grocery_products"("id"),
  "quantity" DECIMAL(10, 3) NOT NULL,
  "unit_price" DECIMAL(19, 4) NOT NULL,
  "line_total" DECIMAL(19, 4) NOT NULL,
  
  CONSTRAINT "grocery_purchase_items_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "grocery_purchase_items_unit_price_positive" CHECK ("unit_price" > 0),
  CONSTRAINT "grocery_purchase_items_line_total_positive" CHECK ("line_total" > 0)
);

-- Indexes for grocery_purchase_items
CREATE INDEX "grocery_purchase_items_purchase_id_idx" ON "grocery_purchase_items"("purchase_id");
CREATE INDEX "grocery_purchase_items_product_id_idx" ON "grocery_purchase_items"("product_id");

-- Grocery Stock Movements (immutable log of stock changes)
CREATE TABLE "grocery_stock_movements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "product_id" UUID NOT NULL REFERENCES "grocery_products"("id"),
  "movement_type" "StockMovementType" NOT NULL,
  "quantity" DECIMAL(10, 3) NOT NULL,
  "reference_type" VARCHAR(50),
  "reference_id" UUID,
  "reason" TEXT,
  "created_by_id" UUID REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NO deleted_at - stock movements are IMMUTABLE
);

-- Indexes for grocery_stock_movements
CREATE INDEX "grocery_stock_movements_group_product_idx" ON "grocery_stock_movements"("group_id", "product_id");
CREATE INDEX "grocery_stock_movements_movement_type_idx" ON "grocery_stock_movements"("movement_type");
CREATE INDEX "grocery_stock_movements_reference_idx" ON "grocery_stock_movements"("reference_type", "reference_id");
CREATE INDEX "grocery_stock_movements_created_at_idx" ON "grocery_stock_movements"("created_at");

-- Grocery Distributions (distribution events)
CREATE TABLE "grocery_distributions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "created_by_id" UUID NOT NULL REFERENCES "users"("id"),
  "status" "GroceryDistributionStatus" NOT NULL DEFAULT 'DRAFT',
  "allocation_rule" "AllocationRule" NOT NULL DEFAULT 'EQUAL_SHARE',
  "distribution_date" DATE NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

-- Indexes for grocery_distributions
CREATE INDEX "grocery_distributions_group_id_idx" ON "grocery_distributions"("group_id");
CREATE INDEX "grocery_distributions_status_idx" ON "grocery_distributions"("status");
CREATE INDEX "grocery_distributions_distribution_date_idx" ON "grocery_distributions"("distribution_date");

-- Grocery Distribution Items (individual allocations to members)
CREATE TABLE "grocery_distribution_items" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "distribution_id" UUID NOT NULL REFERENCES "grocery_distributions"("id") ON DELETE CASCADE,
  "member_id" UUID NOT NULL REFERENCES "group_members"("id"),
  "product_id" UUID NOT NULL REFERENCES "grocery_products"("id"),
  "quantity_allocated" DECIMAL(10, 3) NOT NULL,
  "quantity_override" DECIMAL(10, 3),
  "override_reason" TEXT,
  "status" "DistributionItemStatus" NOT NULL DEFAULT 'PENDING',
  "confirmed_by_id" UUID REFERENCES "users"("id"),
  "confirmation_note" TEXT,
  "idempotency_key" VARCHAR(100) UNIQUE,
  "confirmed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT "grocery_distribution_items_quantity_positive" CHECK ("quantity_allocated" > 0),
  CONSTRAINT "grocery_distribution_items_member_product_unique" UNIQUE ("distribution_id", "member_id", "product_id")
);

-- Indexes for grocery_distribution_items
CREATE INDEX "grocery_distribution_items_distribution_id_idx" ON "grocery_distribution_items"("distribution_id");
CREATE INDEX "grocery_distribution_items_member_id_idx" ON "grocery_distribution_items"("member_id");
CREATE INDEX "grocery_distribution_items_product_id_idx" ON "grocery_distribution_items"("product_id");
CREATE INDEX "grocery_distribution_items_status_idx" ON "grocery_distribution_items"("status");

-- Grocery Idempotency Keys (for offline-first mobile support)
CREATE TABLE "grocery_idempotency_keys" (
  "key" VARCHAR(100) PRIMARY KEY,
  "action_type" VARCHAR(50) NOT NULL,
  "reference_id" UUID NOT NULL,
  "response" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMPTZ NOT NULL
);

-- Indexes for grocery_idempotency_keys
CREATE INDEX "grocery_idempotency_keys_expires_at_idx" ON "grocery_idempotency_keys"("expires_at");

-- ============================================
-- VIEWS
-- ============================================

-- View for current stock levels (computed from movements)
CREATE OR REPLACE VIEW "grocery_current_stock" AS
SELECT 
  gsm."group_id",
  gsm."product_id",
  gp."name" AS product_name,
  gp."unit",
  gp."category",
  SUM(
    CASE 
      WHEN gsm."movement_type" = 'IN' THEN gsm."quantity"
      WHEN gsm."movement_type" = 'OUT' THEN -gsm."quantity"
      WHEN gsm."movement_type" = 'ADJUSTMENT' THEN gsm."quantity"
    END
  ) AS current_quantity,
  MAX(gsm."created_at") AS last_movement_at
FROM "grocery_stock_movements" gsm
JOIN "grocery_products" gp ON gp."id" = gsm."product_id"
WHERE gp."active" = true
GROUP BY gsm."group_id", gsm."product_id", gp."name", gp."unit", gp."category";

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to validate stock availability before distribution
CREATE OR REPLACE FUNCTION check_stock_availability(
  p_group_id UUID,
  p_product_id UUID,
  p_quantity DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_stock DECIMAL;
BEGIN
  SELECT COALESCE(current_quantity, 0) INTO v_current_stock
  FROM grocery_current_stock
  WHERE group_id = p_group_id AND product_id = p_product_id;
  
  RETURN v_current_stock >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to update timestamps
CREATE OR REPLACE FUNCTION update_grocery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER grocery_products_updated_at
  BEFORE UPDATE ON "grocery_products"
  FOR EACH ROW EXECUTE FUNCTION update_grocery_updated_at();

CREATE TRIGGER grocery_purchases_updated_at
  BEFORE UPDATE ON "grocery_purchases"
  FOR EACH ROW EXECUTE FUNCTION update_grocery_updated_at();

CREATE TRIGGER grocery_distributions_updated_at
  BEFORE UPDATE ON "grocery_distributions"
  FOR EACH ROW EXECUTE FUNCTION update_grocery_updated_at();

CREATE TRIGGER grocery_distribution_items_updated_at
  BEFORE UPDATE ON "grocery_distribution_items"
  FOR EACH ROW EXECUTE FUNCTION update_grocery_updated_at();

-- ============================================
-- CLEANUP JOB (for idempotency keys)
-- ============================================

-- Function to clean up expired idempotency keys (run via cron/pg_cron)
CREATE OR REPLACE FUNCTION cleanup_expired_grocery_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM "grocery_idempotency_keys"
  WHERE "expires_at" < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
