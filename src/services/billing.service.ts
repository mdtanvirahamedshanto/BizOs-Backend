import { prisma } from '@/prisma/client';
import { NotFoundError } from '@/utils/errors';
import { ShopPlan } from '@prisma/client';

export class BillingService {
  async getCurrentSubscription(shopId: string) {
    const activeSub = await prisma.tenantSubscription.findFirst({
      where: { shopId, status: 'active' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });

    const pendingRequest = await prisma.subscriptionRequest.findFirst({
      where: { shopId, status: 'pending' },
      include: { plan: true },
      orderBy: { requestedAt: 'desc' }
    });

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundError('Shop not found');

    return {
      activeSubscription: activeSub,
      pendingRequest,
      currentPlanEnum: shop.plan,
    };
  }

  async subscribe(shopId: string, planId: string, billingCycle: 'monthly' | 'yearly') {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundError('Plan not found');

    // End any current active subscriptions
    await prisma.tenantSubscription.updateMany({
      where: { shopId, status: 'active' },
      data: { status: 'cancelled', endDate: new Date() }
    });

    // Create new subscription
    const endDate = new Date();
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const newSub = await prisma.tenantSubscription.create({
      data: {
        shopId,
        planId,
        status: 'active',
        startDate: new Date(),
        endDate,
      }
    });

    // Update shop enum
    let planEnum: ShopPlan = ShopPlan.FREE;
    if (planId === 'basic') planEnum = ShopPlan.STARTER;
    if (planId === 'premium') planEnum = ShopPlan.PROFESSIONAL;

    await prisma.shop.update({
      where: { id: shopId },
      data: { plan: planEnum }
    });

    return newSub;
  }

  async cancelSubscription(shopId: string) {
    await prisma.tenantSubscription.updateMany({
      where: { shopId, status: 'active' },
      data: { status: 'cancelled', endDate: new Date() }
    });

    await prisma.shop.update({
      where: { id: shopId },
      data: { plan: ShopPlan.FREE }
    });

    return { success: true };
  }

  async manualSubscribe(data: {
    shopId: string;
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    paymentMethod: string;
    transactionId: string;
    senderAccount?: string;
  }) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: data.planId } });
    if (!plan) throw new NotFoundError('Plan not found');

    const amountCents = data.billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

    const request = await prisma.subscriptionRequest.create({
      data: {
        shopId: data.shopId,
        planId: data.planId,
        billingCycle: data.billingCycle,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId,
        senderAccount: data.senderAccount,
        amountCents,
        status: 'pending'
      }
    });

    return request;
  }
}
