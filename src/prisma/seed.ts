import { PrismaClient, ShopStatus, ShopPlan, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding BizOS database...');

  // 1. Seed Global Permissions
  console.log('  Seeding global permissions...');
  const permissionsData = [
    { module: 'auth', resource: 'user', action: 'create', description: 'Create users' },
    { module: 'auth', resource: 'user', action: 'read', description: 'Read users' },
    { module: 'auth', resource: 'user', action: 'update', description: 'Update users' },
    { module: 'auth', resource: 'user', action: 'delete', description: 'Delete users' },

    { module: 'sales', resource: 'sale', action: 'create', description: 'Create sales' },
    { module: 'sales', resource: 'sale', action: 'read', description: 'Read sales' },
    { module: 'sales', resource: 'sale', action: 'update', description: 'Update sales' },
    { module: 'sales', resource: 'sale', action: 'delete', description: 'Delete/void sales' },

    { module: 'inventory', resource: 'product', action: 'create', description: 'Create products' },
    { module: 'inventory', resource: 'product', action: 'read', description: 'Read products' },
    { module: 'inventory', resource: 'product', action: 'update', description: 'Update products' },
    { module: 'inventory', resource: 'product', action: 'delete', description: 'Delete products' },

    { module: 'khata', resource: 'account', action: 'create', description: 'Create khata accounts' },
    { module: 'khata', resource: 'account', action: 'read', description: 'Read khata accounts' },
    { module: 'khata', resource: 'entry', action: 'create', description: 'Create khata entries' },
    { module: 'khata', resource: 'entry', action: 'read', description: 'Read khata entries' },
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
    { name: 'Owner', description: 'Full access to all resources', isSystem: true },
    { name: 'Admin', description: 'Administrative access', isSystem: true },
    { name: 'Manager', description: 'Managerial access', isSystem: true },
    { name: 'Cashier', description: 'Billing and cashier access', isSystem: true },
    { name: 'Viewer', description: 'Read-only store viewer', isSystem: true },
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
  const adminRole = seededRoles.find((r) => r.name === 'Admin')!;
  const managerRole = seededRoles.find((r) => r.name === 'Manager')!;
  const cashierRole = seededRoles.find((r) => r.name === 'Cashier')!;

  console.log('  Mapping role permissions...');
  // Admin gets all permissions
  for (const perm of seededPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });

    // Manager gets read/create
    if (perm.action === 'read' || perm.action === 'create') {
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
    }

    // Cashier gets product read and sales create/read
    if (
      (perm.resource === 'product' && perm.action === 'read') ||
      (perm.resource === 'sale' && (perm.action === 'read' || perm.action === 'create'))
    ) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: cashierRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: cashierRole.id,
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
