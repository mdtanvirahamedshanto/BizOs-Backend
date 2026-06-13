/**
 * Manual validation script for Reports & Analytics.
 * Run: npx tsx scratch/test_reports.ts
 */
import { prisma } from '../src/prisma/client';
import { ReportsRepository } from '../src/repositories/reports.repository';
import { ReportsService } from '../src/services/reports.service';

async function main() {
  const shop = await prisma.shop.findFirst({
    where: { slug: 'demo-shop' },
  });

  if (!shop) {
    console.error('Demo shop not found. Run npm run prisma:seed first.');
    process.exit(1);
  }

  const reportsRepo = new ReportsRepository(prisma);
  const reportsService = new ReportsService(reportsRepo);
  const shopId = shop.id;

  console.log(`\n=== Reports validation for shop: ${shop.name} (${shopId}) ===\n`);

  const dailySales = await reportsService.getDailySales(shopId, {});
  console.log('Daily Sales:', JSON.stringify(dailySales.data, null, 2));

  const monthlySales = await reportsService.getMonthlySales(shopId, {});
  console.log('\nMonthly Sales:', JSON.stringify(monthlySales.data, null, 2));

  const profit = await reportsService.getProfitReport(shopId, {});
  console.log('\nProfit Report:', JSON.stringify(profit.data, null, 2));

  const inventory = await reportsService.getInventoryReport(shopId);
  console.log('\nInventory Report:', JSON.stringify(inventory.data, null, 2));

  const dues = await reportsService.getDueReport(shopId);
  console.log('\nDue Report:', JSON.stringify(dues.data, null, 2));

  const dashboard = await reportsService.getDashboardMetrics(shopId, { timeframe: 'this_month' });
  console.log('\nDashboard Metrics:', JSON.stringify(dashboard.data, null, 2));

  console.log('\n✅ Reports validation complete.');
}

main()
  .catch((err) => {
    console.error('❌ Reports validation failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
