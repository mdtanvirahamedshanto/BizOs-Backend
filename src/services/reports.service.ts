import type { DashboardQueryInput, ReportQueryInput } from '@/validators/reports.schema';
import type { DashboardTimeframe } from '@/validators/reports.schema';
import { ReportsRepository } from '@/repositories/reports.repository';
import { success, type ServiceResult } from '@/types/service';

type DateRange = { startDate: Date; endDate: Date };

type SalesMetrics = {
  revenueCents: number;
  taxCents: number;
  discountCents: number;
  saleCount: number;
  cogsCents: number;
  expenseCents: number;
  grossProfitCents: number;
  netProfitCents: number;
};

type KpiWithChange = {
  current: number;
  previous: number;
  changePercent: number | null;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function startOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return endOfDay(end);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function formatMonthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function calcPercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function resolveTimeframeBounds(
  timeframe: DashboardTimeframe,
  customStart?: Date,
  customEnd?: Date,
): DateRange {
  const now = new Date();

  switch (timeframe) {
    case 'today':
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case 'yesterday': {
      const yesterday = addDays(now, -1);
      return { startDate: startOfDay(yesterday), endDate: endOfDay(yesterday) };
    }
    case 'this_week':
      return { startDate: startOfWeek(now), endDate: endOfDay(now) };
    case 'last_week': {
      const lastWeekEnd = addDays(startOfWeek(now), -1);
      return { startDate: startOfWeek(lastWeekEnd), endDate: endOfWeek(lastWeekEnd) };
    }
    case 'this_month':
      return { startDate: startOfMonth(now), endDate: endOfDay(now) };
    case 'last_month': {
      const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return { startDate: startOfMonth(lastMonth), endDate: endOfMonth(lastMonth) };
    }
    case 'this_year':
      return { startDate: startOfYear(now), endDate: endOfDay(now) };
    case 'custom':
      return {
        startDate: startOfDay(customStart!),
        endDate: endOfDay(customEnd!),
      };
    default:
      return { startDate: startOfMonth(now), endDate: endOfDay(now) };
  }
}

function resolvePreviousPeriod(startDate: Date, endDate: Date): DateRange {
  const durationMs = endDate.getTime() - startDate.getTime();
  const previousEnd = new Date(startDate.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);
  return { startDate: previousStart, endDate: previousEnd };
}

function defaultReportRange(startDate?: Date, endDate?: Date): DateRange {
  const now = new Date();
  return {
    startDate: startDate ?? startOfMonth(now),
    endDate: endDate ?? endOfDay(now),
  };
}

export class ReportsService {
  constructor(private reportsRepo: ReportsRepository) {}

  private async computeSalesMetrics(
    shopId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<SalesMetrics> {
    const [sales, cogsItems, expenses] = await Promise.all([
      this.reportsRepo.getSalesData(shopId, startDate, endDate),
      this.reportsRepo.getCOGSData(shopId, startDate, endDate),
      this.reportsRepo.getExpensesData(shopId, startDate, endDate),
    ]);

    const revenueCents = sales.reduce((sum, sale) => sum + sale.totalCents, 0);
    const taxCents = sales.reduce((sum, sale) => sum + sale.taxCents, 0);
    const discountCents = sales.reduce((sum, sale) => sum + sale.discountCents, 0);
    const cogsCents = cogsItems.reduce(
      (sum, item) => sum + item.quantity * item.product.costPriceCents,
      0,
    );
    const expenseCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
    const grossProfitCents = revenueCents - taxCents - cogsCents;
    const netProfitCents = grossProfitCents - expenseCents;

    return {
      revenueCents,
      taxCents,
      discountCents,
      saleCount: sales.length,
      cogsCents,
      expenseCents,
      grossProfitCents,
      netProfitCents,
    };
  }

  async getDailySales(
    shopId: string,
    query: ReportQueryInput,
  ): Promise<ServiceResult<unknown>> {
    const { startDate, endDate } = defaultReportRange(query.startDate, query.endDate);
    const sales = await this.reportsRepo.getSalesData(shopId, startDate, endDate);

    const byDate = new Map<
      string,
      { date: string; revenueCents: number; taxCents: number; discountCents: number; saleCount: number }
    >();

    for (const sale of sales) {
      const key = formatDateKey(sale.saleDate);
      const existing = byDate.get(key) ?? {
        date: key,
        revenueCents: 0,
        taxCents: 0,
        discountCents: 0,
        saleCount: 0,
      };
      existing.revenueCents += sale.totalCents;
      existing.taxCents += sale.taxCents;
      existing.discountCents += sale.discountCents;
      existing.saleCount += 1;
      byDate.set(key, existing);
    }

    const days: Array<{
      date: string;
      revenueCents: number;
      taxCents: number;
      discountCents: number;
      saleCount: number;
    }> = [];
    const cursor = startOfDay(startDate);
    const end = startOfDay(endDate);

    while (cursor <= end) {
      const key = formatDateKey(cursor);
      days.push(
        byDate.get(key) ?? {
          date: key,
          revenueCents: 0,
          taxCents: 0,
          discountCents: 0,
          saleCount: 0,
        },
      );
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const totals = days.reduce(
      (acc, day) => ({
        revenueCents: acc.revenueCents + day.revenueCents,
        taxCents: acc.taxCents + day.taxCents,
        discountCents: acc.discountCents + day.discountCents,
        saleCount: acc.saleCount + day.saleCount,
      }),
      { revenueCents: 0, taxCents: 0, discountCents: 0, saleCount: 0 },
    );

    return success({
      period: { startDate, endDate },
      days,
      totals,
    });
  }

  async getMonthlySales(
    shopId: string,
    query: ReportQueryInput,
  ): Promise<ServiceResult<unknown>> {
    const { startDate, endDate } = defaultReportRange(query.startDate, query.endDate);
    const sales = await this.reportsRepo.getSalesData(shopId, startDate, endDate);

    const byMonth = new Map<
      string,
      { month: string; revenueCents: number; taxCents: number; discountCents: number; saleCount: number }
    >();

    for (const sale of sales) {
      const key = formatMonthKey(sale.saleDate);
      const existing = byMonth.get(key) ?? {
        month: key,
        revenueCents: 0,
        taxCents: 0,
        discountCents: 0,
        saleCount: 0,
      };
      existing.revenueCents += sale.totalCents;
      existing.taxCents += sale.taxCents;
      existing.discountCents += sale.discountCents;
      existing.saleCount += 1;
      byMonth.set(key, existing);
    }

    const months: Array<{
      month: string;
      revenueCents: number;
      taxCents: number;
      discountCents: number;
      saleCount: number;
    }> = [];

    const cursor = startOfMonth(startDate);
    const end = startOfMonth(endDate);

    while (cursor <= end) {
      const key = formatMonthKey(cursor);
      months.push(
        byMonth.get(key) ?? {
          month: key,
          revenueCents: 0,
          taxCents: 0,
          discountCents: 0,
          saleCount: 0,
        },
      );
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const totals = months.reduce(
      (acc, month) => ({
        revenueCents: acc.revenueCents + month.revenueCents,
        taxCents: acc.taxCents + month.taxCents,
        discountCents: acc.discountCents + month.discountCents,
        saleCount: acc.saleCount + month.saleCount,
      }),
      { revenueCents: 0, taxCents: 0, discountCents: 0, saleCount: 0 },
    );

    return success({
      period: { startDate, endDate },
      months,
      totals,
    });
  }

  async getProfitReport(
    shopId: string,
    query: ReportQueryInput,
  ): Promise<ServiceResult<unknown>> {
    const { startDate, endDate } = defaultReportRange(query.startDate, query.endDate);
    const metrics = await this.computeSalesMetrics(shopId, startDate, endDate);

    return success({
      period: { startDate, endDate },
      revenueCents: metrics.revenueCents,
      taxCents: metrics.taxCents,
      discountCents: metrics.discountCents,
      cogsCents: metrics.cogsCents,
      grossProfitCents: metrics.grossProfitCents,
      expenseCents: metrics.expenseCents,
      netProfitCents: metrics.netProfitCents,
      saleCount: metrics.saleCount,
      grossMarginPercent:
        metrics.revenueCents > 0
          ? Number(((metrics.grossProfitCents / metrics.revenueCents) * 100).toFixed(2))
          : 0,
      netMarginPercent:
        metrics.revenueCents > 0
          ? Number(((metrics.netProfitCents / metrics.revenueCents) * 100).toFixed(2))
          : 0,
    });
  }

  async getInventoryReport(shopId: string): Promise<ServiceResult<unknown>> {
    const products = await this.reportsRepo.getInventoryValuation(shopId);

    let totalCostValueCents = 0;
    let totalSellValueCents = 0;
    let totalUnits = 0;

    const lowStockItems = products
      .filter((product) => product.stockQuantity <= product.lowStockThreshold)
      .map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        costPriceCents: product.costPriceCents,
        sellPriceCents: product.sellPriceCents,
      }));

    for (const product of products) {
      totalUnits += product.stockQuantity;
      totalCostValueCents += product.stockQuantity * product.costPriceCents;
      totalSellValueCents += product.stockQuantity * product.sellPriceCents;
    }

    return success({
      totalProducts: products.length,
      totalUnits,
      totalCostValueCents,
      totalSellValueCents,
      potentialProfitCents: totalSellValueCents - totalCostValueCents,
      lowStockCount: lowStockItems.length,
      lowStockItems,
    });
  }

  async getDueReport(shopId: string): Promise<ServiceResult<unknown>> {
    const { customerAccounts, supplierAccounts } = await this.reportsRepo.getDuesData(shopId);

    const customerDues = customerAccounts.map((account) => ({
      accountId: account.id,
      partyId: account.partyId,
      name: account.customer?.name ?? 'Unknown Customer',
      phone: account.customer?.phone ?? null,
      balanceCents: account.balanceCents,
    }));

    const supplierPayables = supplierAccounts.map((account) => ({
      accountId: account.id,
      partyId: account.partyId,
      name: account.supplier?.name ?? 'Unknown Supplier',
      company: account.supplier?.company ?? null,
      phone: account.supplier?.phone ?? null,
      balanceCents: Math.abs(account.balanceCents),
    }));

    const totalReceivableCents = customerDues.reduce((sum, item) => sum + item.balanceCents, 0);
    const totalPayableCents = supplierPayables.reduce((sum, item) => sum + item.balanceCents, 0);

    return success({
      customerDues,
      supplierPayables,
      totalReceivableCents,
      totalPayableCents,
      netReceivableCents: totalReceivableCents - totalPayableCents,
    });
  }

  async getDashboardMetrics(
    shopId: string,
    query: DashboardQueryInput,
  ): Promise<ServiceResult<unknown>> {
    const { startDate, endDate } = resolveTimeframeBounds(
      query.timeframe,
      query.startDate,
      query.endDate,
    );
    const previousPeriod = resolvePreviousPeriod(startDate, endDate);

    const [
      currentMetrics,
      previousMetrics,
      currentSales,
      currentExpenses,
      recentSales,
      recentPayments,
      recentExpenses,
      cashbookBalanceCents,
      mfsBalanceCents,
      flexiloadBalanceCents,
    ] = await Promise.all([
      this.computeSalesMetrics(shopId, startDate, endDate),
      this.computeSalesMetrics(shopId, previousPeriod.startDate, previousPeriod.endDate),
      this.reportsRepo.getSalesData(shopId, startDate, endDate),
      this.reportsRepo.getExpensesData(shopId, startDate, endDate),
      this.reportsRepo.getRecentSales(shopId, 5),
      this.reportsRepo.getRecentPayments(shopId, 5),
      this.reportsRepo.getRecentExpenses(shopId, 5),
      this.reportsRepo.getCashbookBalance(shopId),
      this.reportsRepo.getMfsBalance(shopId),
      this.reportsRepo.getFlexiloadBalance(shopId),
    ]);

    const buildKpi = (current: number, previous: number): KpiWithChange => ({
      current,
      previous,
      changePercent: calcPercentChange(current, previous),
    });

    const revenue = buildKpi(currentMetrics.revenueCents, previousMetrics.revenueCents);
    const saleCount = buildKpi(currentMetrics.saleCount, previousMetrics.saleCount);
    const grossProfit = buildKpi(currentMetrics.grossProfitCents, previousMetrics.grossProfitCents);
    const netProfit = buildKpi(currentMetrics.netProfitCents, previousMetrics.netProfitCents);
    const expenses = buildKpi(currentMetrics.expenseCents, previousMetrics.expenseCents);

    const grossMarginPercent =
      currentMetrics.revenueCents > 0
        ? Number(((currentMetrics.grossProfitCents / currentMetrics.revenueCents) * 100).toFixed(2))
        : 0;
    const netMarginPercent =
      currentMetrics.revenueCents > 0
        ? Number(((currentMetrics.netProfitCents / currentMetrics.revenueCents) * 100).toFixed(2))
        : 0;
    const averageTicketCents =
      currentMetrics.saleCount > 0
        ? Math.round(currentMetrics.revenueCents / currentMetrics.saleCount)
        : 0;

    const trendByDate = new Map<string, { date: string; revenueCents: number; saleCount: number }>();
    for (const sale of currentSales) {
      const key = formatDateKey(sale.saleDate);
      const existing = trendByDate.get(key) ?? { date: key, revenueCents: 0, saleCount: 0 };
      existing.revenueCents += sale.totalCents;
      existing.saleCount += 1;
      trendByDate.set(key, existing);
    }

    const revenueTrend: Array<{ date: string; revenueCents: number; saleCount: number }> = [];
    const trendCursor = startOfDay(startDate);
    const trendEnd = startOfDay(endDate);

    while (trendCursor <= trendEnd) {
      const key = formatDateKey(trendCursor);
      revenueTrend.push(
        trendByDate.get(key) ?? { date: key, revenueCents: 0, saleCount: 0 },
      );
      trendCursor.setUTCDate(trendCursor.getUTCDate() + 1);
    }

    const expenseByCategory = new Map<
      string,
      { categoryId: string | null; categoryName: string; color: string | null; amountCents: number }
    >();

    for (const expense of currentExpenses) {
      const categoryId = expense.categoryId;
      const key = categoryId ?? 'uncategorized';
      const existing = expenseByCategory.get(key) ?? {
        categoryId,
        categoryName: expense.category?.name ?? 'Uncategorized',
        color: expense.category?.color ?? null,
        amountCents: 0,
      };
      existing.amountCents += expense.amountCents;
      expenseByCategory.set(key, existing);
    }

    return success({
      timeframe: query.timeframe,
      period: { startDate, endDate },
      previousPeriod,
      kpis: {
        revenue,
        saleCount,
        grossProfit,
        netProfit,
        expenses,
        grossMarginPercent,
        netMarginPercent,
        averageTicketCents,
      },
      revenueTrend,
      expenseDistribution: Array.from(expenseByCategory.values()).sort(
        (a, b) => b.amountCents - a.amountCents,
      ),
      balances: {
        cashbookCents: cashbookBalanceCents,
        mfsCents: mfsBalanceCents,
        flexiloadCents: flexiloadBalanceCents,
      },
      recent: {
        sales: recentSales,
        payments: recentPayments,
        expenses: recentExpenses,
      },
    });
  }
}
