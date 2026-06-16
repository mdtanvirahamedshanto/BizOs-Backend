import type { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError } from '@/utils/errors';

export class UserRepository {
  constructor(private prisma: PrismaClient) {}

  async listUsers(shopId: string) {
    return this.prisma.user.findMany({
      where: { shopId, deletedAt: null },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(
    shopId: string,
    data: {
      name: string;
      email: string;
      passwordHash: string;
      phone?: string;
      roleId: string;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Check duplicate email in this shop
      const existing = await tx.user.findFirst({
        where: { shopId, email: data.email, deletedAt: null },
      });
      if (existing) {
        throw new ConflictError('User with this email already exists in this shop');
      }

      // Check if role exists
      const role = await tx.role.findFirst({
        where: { shopId, id: data.roleId },
      });
      if (!role) {
        throw new NotFoundError('Role');
      }

      // Create user
      const user = await tx.user.create({
        data: {
          shopId,
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          passwordHash: data.passwordHash,
          status: 'ACTIVE',
        },
      });

      // Assign role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });

      return tx.user.findUnique({
        where: { id: user.id },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });
    });
  }

  async updateUserRole(
    shopId: string,
    userId: string,
    data: {
      name?: string;
      phone?: string;
      roleId?: string;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { shopId, id: userId, deletedAt: null },
      });
      if (!user) {
        throw new NotFoundError('User');
      }

      // Update basic fields
      await tx.user.update({
        where: { id: userId },
        data: {
          name: data.name,
          phone: data.phone || null,
        },
      });

      if (data.roleId) {
        const role = await tx.role.findFirst({
          where: { shopId, id: data.roleId },
        });
        if (!role) {
          throw new NotFoundError('Role');
        }

        // Delete existing roles and assign new one
        await tx.userRole.deleteMany({
          where: { userId },
        });

        await tx.userRole.create({
          data: {
            userId,
            roleId: role.id,
          },
        });
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });
    });
  }

  async deleteUser(shopId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { shopId, id: userId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundError('User');
    }

    // Check if the user is the owner (cannot delete owner)
    const ownerRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role: { name: 'Owner' },
      },
    });
    if (ownerRole) {
      throw new ConflictError('Cannot delete the shop Owner');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  async listRoles(shopId: string) {
    return this.prisma.role.findMany({
      where: { shopId },
      orderBy: { name: 'asc' },
    });
  }
}
