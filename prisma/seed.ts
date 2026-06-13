import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding BizOS database...');

  // Create a demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo-company',
      status: 'ACTIVE',
      plan: 'PROFESSIONAL',
      settings: {
        currency: 'USD',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
      },
    },
  });

  console.log(`  ✓ Tenant created: ${tenant.name} (${tenant.id})`);

  // Create default roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Owner' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Owner',
        description: 'Full access to all resources',
        permissions: ['*:*:*'],
        isSystem: true,
      },
    }),
    prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Admin' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Admin',
        description: 'Administrative access',
        permissions: [
          'auth:*:*',
          'user:*:*',
          'inventory:*:*',
          'sales:*:*',
          'finance:*:read',
          'hr:*:read',
          'crm:*:*',
          'reporting:*:*',
        ],
        isSystem: true,
      },
    }),
    prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Manager' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Manager',
        description: 'Team management access',
        permissions: [
          'inventory:product:read',
          'inventory:product:update',
          'sales:order:*',
          'crm:customer:*',
          'crm:deal:*',
          'reporting:report:read',
        ],
        isSystem: true,
      },
    }),
    prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Employee' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Employee',
        description: 'Standard employee access',
        permissions: [
          'inventory:product:read',
          'sales:order:read',
          'sales:order:create',
          'crm:customer:read',
        ],
        isSystem: true,
      },
    }),
    prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Viewer' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Viewer',
        description: 'Read-only access',
        permissions: [
          'inventory:product:read',
          'sales:order:read',
          'crm:customer:read',
          'reporting:report:read',
        ],
        isSystem: true,
      },
    }),
  ]);

  console.log(`  ✓ Roles created: ${roles.map((r) => r.name).join(', ')}`);

  // Create default chart of accounts
  const accounts = await Promise.all([
    // Assets
    prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: '1000' } },
      update: {},
      create: { tenantId: tenant.id, code: '1000', name: 'Cash', type: 'ASSET', isSystem: true },
    }),
    prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: '1100' } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: '1100',
        name: 'Accounts Receivable',
        type: 'ASSET',
        isSystem: true,
      },
    }),
    prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: '1200' } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: '1200',
        name: 'Inventory',
        type: 'ASSET',
        isSystem: true,
      },
    }),
    // Liabilities
    prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: '2000' } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: '2000',
        name: 'Accounts Payable',
        type: 'LIABILITY',
        isSystem: true,
      },
    }),
    prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: '2100' } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: '2100',
        name: 'Tax Payable',
        type: 'LIABILITY',
        isSystem: true,
      },
    }),
    // Revenue
    prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: '4000' } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: '4000',
        name: 'Sales Revenue',
        type: 'REVENUE',
        isSystem: true,
      },
    }),
    // Expenses
    prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: '5000' } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: '5000',
        name: 'Cost of Goods Sold',
        type: 'EXPENSE',
        isSystem: true,
      },
    }),
    prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: '5100' } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: '5100',
        name: 'Salaries & Wages',
        type: 'EXPENSE',
        isSystem: true,
      },
    }),
    // Equity
    prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: '3000' } },
      update: {},
      create: {
        tenantId: tenant.id,
        code: '3000',
        name: "Owner's Equity",
        type: 'EQUITY',
        isSystem: true,
      },
    }),
  ]);

  console.log(`  ✓ Chart of accounts created: ${accounts.length} accounts`);

  // Create default departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Engineering' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Engineering', description: 'Product development' },
    }),
    prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Sales' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Sales', description: 'Sales and business development' },
    }),
    prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Operations' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Operations', description: 'Business operations' },
    }),
  ]);

  console.log(`  ✓ Departments created: ${departments.map((d) => d.name).join(', ')}`);

  console.log('\n✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
