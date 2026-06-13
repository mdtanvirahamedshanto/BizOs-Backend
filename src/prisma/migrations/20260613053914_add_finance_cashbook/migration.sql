-- CreateEnum
CREATE TYPE "CashbookEntryType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "RecurringExpenseFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "cashbook_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "type" "CashbookEntryType" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "running_balance_cents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "payment_id" UUID,
    "recorded_by" UUID NOT NULL,
    "entry_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cashbook_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_closings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "closing_date" DATE NOT NULL,
    "opening_balance_cents" INTEGER NOT NULL,
    "cash_in_cents" INTEGER NOT NULL,
    "cash_out_cents" INTEGER NOT NULL,
    "expected_balance_cents" INTEGER NOT NULL,
    "actual_balance_cents" INTEGER NOT NULL,
    "difference_cents" INTEGER NOT NULL,
    "notes" TEXT,
    "closed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "category_id" UUID,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "frequency" "RecurringExpenseFrequency" NOT NULL,
    "start_date" TIMESTAMPTZ NOT NULL,
    "end_date" TIMESTAMPTZ,
    "next_due_date" TIMESTAMPTZ NOT NULL,
    "last_gen_date" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cashbook_entries_shop_id_entry_date_idx" ON "cashbook_entries"("shop_id", "entry_date");

-- CreateIndex
CREATE INDEX "cashbook_entries_shop_id_type_idx" ON "cashbook_entries"("shop_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_daily_closings_shop_date" ON "daily_closings"("shop_id", "closing_date");

-- CreateIndex
CREATE INDEX "recurring_expenses_shop_id_next_due_date_idx" ON "recurring_expenses"("shop_id", "next_due_date");

-- CreateIndex
CREATE INDEX "recurring_expenses_shop_id_is_active_idx" ON "recurring_expenses"("shop_id", "is_active");

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_closings" ADD CONSTRAINT "daily_closings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_closings" ADD CONSTRAINT "daily_closings_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
