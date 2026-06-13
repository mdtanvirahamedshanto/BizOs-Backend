-- CreateEnum
CREATE TYPE "MfsProvider" AS ENUM ('BKASH', 'NAGAD', 'ROCKET', 'UPAY');

-- CreateEnum
CREATE TYPE "MfsAccountType" AS ENUM ('AGENT', 'MERCHANT', 'PERSONAL');

-- CreateEnum
CREATE TYPE "MfsTransactionType" AS ENUM ('CASH_IN', 'CASH_OUT', 'SEND_MONEY', 'MERCHANT_PAY', 'BILL_PAY', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MfsTxStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MobileOperator" AS ENUM ('GP', 'ROBI', 'AIRTEL', 'BL', 'TELETALK');

-- CreateEnum
CREATE TYPE "FlexiloadStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FlexiloadConnectionType" AS ENUM ('PREPAID', 'POSTPAID');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'UPAY';

-- CreateTable
CREATE TABLE "mfs_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "provider" "MfsProvider" NOT NULL,
    "account_number" VARCHAR(20) NOT NULL,
    "account_type" "MfsAccountType" NOT NULL DEFAULT 'AGENT',
    "balance_cents" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mfs_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfs_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "mfs_account_id" UUID NOT NULL,
    "type" "MfsTransactionType" NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "fee_cents" INTEGER NOT NULL DEFAULT 0,
    "commission_cents" INTEGER NOT NULL DEFAULT 0,
    "txid" VARCHAR(100),
    "status" "MfsTxStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mfs_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flexiload_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "operator" "MobileOperator" NOT NULL,
    "account_number" VARCHAR(20) NOT NULL,
    "balance_cents" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flexiload_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flexiload_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "recipient_phone" VARCHAR(20) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL DEFAULT 0,
    "status" "FlexiloadStatus" NOT NULL DEFAULT 'COMPLETED',
    "connection_type" "FlexiloadConnectionType" NOT NULL DEFAULT 'PREPAID',
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flexiload_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_mfs_accounts_shop_provider_number" ON "mfs_accounts"("shop_id", "provider", "account_number");

-- CreateIndex
CREATE INDEX "mfs_transactions_shop_id_created_at_idx" ON "mfs_transactions"("shop_id", "created_at");

-- CreateIndex
CREATE INDEX "mfs_transactions_shop_id_mfs_account_id_idx" ON "mfs_transactions"("shop_id", "mfs_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_flexiload_accounts_shop_operator_number" ON "flexiload_accounts"("shop_id", "operator", "account_number");

-- CreateIndex
CREATE INDEX "flexiload_transactions_shop_id_created_at_idx" ON "flexiload_transactions"("shop_id", "created_at");

-- CreateIndex
CREATE INDEX "flexiload_transactions_shop_id_account_id_idx" ON "flexiload_transactions"("shop_id", "account_id");

-- AddForeignKey
ALTER TABLE "mfs_accounts" ADD CONSTRAINT "mfs_accounts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfs_transactions" ADD CONSTRAINT "mfs_transactions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfs_transactions" ADD CONSTRAINT "mfs_transactions_mfs_account_id_fkey" FOREIGN KEY ("mfs_account_id") REFERENCES "mfs_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfs_transactions" ADD CONSTRAINT "mfs_transactions_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flexiload_accounts" ADD CONSTRAINT "flexiload_accounts_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flexiload_transactions" ADD CONSTRAINT "flexiload_transactions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flexiload_transactions" ADD CONSTRAINT "flexiload_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "flexiload_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flexiload_transactions" ADD CONSTRAINT "flexiload_transactions_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
