import { PrismaClient, ShopStatus, ShopPlan, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding BizOS database...');

  // 1. Seed Global Permissions
  console.log('  Seeding global permissions...');
  const permissionsData = [
    { module: 'crm', resource: 'customers', action: 'create', description: 'Create customers' },
    { module: 'crm', resource: 'customers', action: 'read', description: 'Read customers' },
    { module: 'inventory', resource: 'products', action: 'create', description: 'Create products' },
    { module: 'inventory', resource: 'products', action: 'read', description: 'Read products' },
    { module: 'inventory', resource: 'products', action: 'update', description: 'Update products' },
    { module: 'inventory', resource: 'products', action: 'delete', description: 'Delete products' },
    { module: 'crm', resource: 'suppliers', action: 'create', description: 'Create suppliers' },
    { module: 'crm', resource: 'suppliers', action: 'read', description: 'Read suppliers' },
    { module: 'crm', resource: 'suppliers', action: 'update', description: 'Update suppliers' },
    { module: 'crm', resource: 'suppliers', action: 'delete', description: 'Delete suppliers' },
    { module: 'sales', resource: 'sales', action: 'create', description: 'Create sales' },
    { module: 'sales', resource: 'sales', action: 'read', description: 'Read sales' },
  ];

  const seededPermissions = [];
  for (const perm of permissionsData) {
    const dbPerm = await prisma.permission.upsert({
      where: {
        module_resource_action: {
          module: perm.module,
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: { description: perm.description },
      create: perm,
    });
    seededPermissions.push(dbPerm);
  }
  console.log(`  ✓ Seeded ${seededPermissions.length} global permissions.`);

  // 2. Seed Demo Shop
  console.log('  Seeding demo shop...');
  const shop = await prisma.shop.upsert({
    where: { slug: 'demo-shop' },
    update: {},
    create: {
      name: 'Demo Retail Shop',
      slug: 'demo-shop',
      phone: '01711223344',
      email: 'demo-shop@bizos.app',
      status: ShopStatus.ACTIVE,
      plan: ShopPlan.PROFESSIONAL,
      settings: {
        currency: 'BDT',
        timezone: 'Asia/Dhaka',
      },
    },
  });
  console.log(`  ✓ Demo shop seeded: ${shop.name} (${shop.id})`);

  // 3. Seed Default Roles for the Demo Shop
  console.log('  Seeding default roles for demo shop...');
  const defaultRoles = [
    { name: 'SuperAdmin', description: 'Super administrator access', isSystem: true },
    { name: 'Owner', description: 'Full shop owner access', isSystem: true },
    { name: 'Manager', description: 'Shop manager access', isSystem: true },
    { name: 'Staff', description: 'Store staff access', isSystem: true },
  ];

  const seededRoles = [];
  for (const r of defaultRoles) {
    const role = await prisma.role.upsert({
      where: {
        shopId_name: {
          shopId: shop.id,
          name: r.name,
        },
      },
      update: { description: r.description },
      create: {
        shopId: shop.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
      },
    });
    seededRoles.push(role);
  }
  console.log(`  ✓ Seeded roles: ${seededRoles.map((r) => r.name).join(', ')}`);

  // Map permissions to non-Owner roles for demonstration purposes
  const managerRole = seededRoles.find((r) => r.name === 'Manager')!;
  const staffRole = seededRoles.find((r) => r.name === 'Staff')!;

  console.log('  Mapping role permissions...');
  for (const perm of seededPermissions) {
    const permString = `${perm.resource}.${perm.action}`;

    // Manager gets all permissions
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: managerRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: managerRole.id,
        permissionId: perm.id,
      },
    });

    // Staff gets products.read, sales.read, sales.create
    if (
      permString === 'products.read' ||
      permString === 'sales.read' ||
      permString === 'sales.create'
    ) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: staffRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: staffRole.id,
          permissionId: perm.id,
        },
      });
    }
  }
  console.log('  ✓ Role permissions mapped successfully.');

  // 4. Seed Demo Owner User
  console.log('  Seeding demo owner user...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const ownerEmail = 'owner@bizos.app';
  const user = await prisma.user.upsert({
    where: {
      shopId_email: {
        shopId: shop.id,
        email: ownerEmail,
      },
    },
    update: {},
    create: {
      shopId: shop.id,
      name: 'John Doe',
      email: ownerEmail,
      phone: '01711000000',
      passwordHash,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`  ✓ Demo user seeded: ${user.name} (${user.email})`);

  // Assign Owner role to user
  const ownerRole = seededRoles.find((r) => r.name === 'Owner')!;
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: ownerRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: ownerRole.id,
    },
  });
  console.log('  ✓ Owner role assigned to demo user.');

  console.log('\n✅ BizOS database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
