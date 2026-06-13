import type { PrismaClient, Prisma } from '@prisma/client';

export class AuthRepository {
  constructor(private prisma: PrismaClient) {}


  async findUserByEmail(shopId: string, email: string) {
    return this.prisma.user.findFirst({
      where: { shopId, email, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
  }

  async findUserByPhone(shopId: string, phone: string) {
    return this.prisma.user.findFirst({
      where: { shopId, phone, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
  }

  async createUser(data: {
    shopId: string;
    email: string;
    passwordHash: string;
    name: string;
  }) {
    return this.prisma.user.create({
      data,
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
  }

  async registerShopAndOwner(
    shopData: { name: string; slug: string },
    ownerData: { email: string; passwordHash: string; name: string },
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create the Shop
      const shop = await tx.shop.create({
        data: {
          name: shopData.name,
          slug: shopData.slug,
          status: 'ACTIVE',
          plan: 'FREE',
        },
      });

      // 2. Seed default roles for this shop
      const systemRoles = [
        { name: 'Owner', description: 'Full access to all resources', isSystem: true },
        { name: 'Admin', description: 'Administrative access', isSystem: true },
        { name: 'Manager', description: 'Manager access', isSystem: true },
        { name: 'Cashier', description: 'Cashier access', isSystem: true },
        { name: 'Viewer', description: 'Read-only access', isSystem: true },
      ];

      const roles = await Promise.all(
        systemRoles.map((role) =>
          tx.role.create({
            data: {
              shopId: shop.id,
              name: role.name,
              description: role.description,
              isSystem: role.isSystem,
            },
          })
        )
      );

      const ownerRole = roles.find((r) => r.name === 'Owner')!;

      // 3. Create the Owner User
      const user = await tx.user.create({
        data: {
          shopId: shop.id,
          email: ownerData.email,
          passwordHash: ownerData.passwordHash,
          name: ownerData.name,
          status: 'ACTIVE',
        },
      });

      // 4. Assign Owner Role to the User
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
        },
      });

      // Fetch the full user with roles and permissions to return
      const fullUser = await tx.user.findUnique({
        where: { id: user.id },
        include: {
          userRoles: {
            include: {
              role: {
                include: { rolePermissions: { include: { permission: true } } },
              },
            },
          },
        },
      });

      return { shop, user: fullUser! };
    });
  }

  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async storeRefreshToken(userId: string, token: string, expiresAt: Date) {
    return this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  }

  async findRefreshToken(token: string) {
    return this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async revokeRefreshToken(token: string) {
    return this.prisma.refreshToken.update({
      where: { token: token },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async assignRoleToUser(userId: string, roleId: string) {
    return this.prisma.userRole.create({
      data: { userId, roleId },
    });
  }

  async findDefaultRole(shopId: string, roleName: string) {
    return this.prisma.role.findFirst({
      where: { shopId, name: roleName },
    });
  }
}
