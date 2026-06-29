-- CreateTable
CREATE TABLE "subscription_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "plan_id" VARCHAR(50) NOT NULL,
    "billingCycle" VARCHAR(20) NOT NULL DEFAULT 'monthly',
    "payment_method" VARCHAR(50) NOT NULL,
    "transaction_id" VARCHAR(100) NOT NULL,
    "sender_account" VARCHAR(50),
    "amount_cents" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "subscription_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_requests" ADD CONSTRAINT "subscription_requests_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
