-- Composite index for report queries filtering by shop, status, and date range
CREATE INDEX IF NOT EXISTS "idx_sales_shop_status_date" ON "sales"("shop_id", "status", "sale_date");
