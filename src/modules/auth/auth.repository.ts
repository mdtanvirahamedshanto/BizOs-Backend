import type { PrismaClient } from '@prisma/client';

/**
 * Auth repository.
 * Handles database operations for auth-related entities (users, refresh tokens).
 * No business logic — pure data access.
 */
export class AuthRepository {
  constructor(private prisma: PrismaClient) {}

  async findUserByEmail(tenantId: string, email: string) {
    return this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async createUser(data: {
    tenantId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }) {
    return this.prisma.user.create({
      data,
      include: {
        roles: {
          include: { role: true },
        },
      },
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
      where: { token },
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

  async findDefaultRole(tenantId: string, roleName: string) {
    return this.prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name: roleName } },
    });
  }
}
