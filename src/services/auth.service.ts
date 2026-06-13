import jwt from 'jsonwebtoken';
import { env } from '@/env';
import { hashPassword, verifyPassword, generateToken } from '@/utils/crypto';
import { addDuration, isExpired } from '@/utils/date';

import { UnauthorizedError } from '@/utils/errors';
import { success, failure } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import type { AuthResult, AuthTokens } from '@/types/auth.types';
import type { AuthRepository } from '@/repositories/auth.repository';
import { authEvents } from '@/events/auth.events';
import { createModuleLogger } from '@/config/logger';
import type { RegisterDTO, LoginDTO, ChangePasswordDTO } from '@/validators/auth.schema';

const log = createModuleLogger('auth');

export class AuthService {
  constructor(
    private authRepo: AuthRepository,
    // tenantService removed for now, we will add shopService later
  ) {}

  async register(dto: RegisterDTO): Promise<ServiceResult<AuthResult>> {
    // TODO: Create shop using ShopService once implemented.
    // For now, we mock the shop creation to just return a dummy failure
    // so it compiles, but in reality this will call shopService.create()
    const shop = { id: 'temp-shop-id' }; // Placeholder

    const existingUser = await this.authRepo.findUserByEmail(shop.id, dto.email);
    if (existingUser) {
      return failure('USER_EXISTS', 'A user with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.authRepo.createUser({
      shopId: shop.id,
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    const ownerRole = await this.authRepo.findDefaultRole(shop.id, 'Owner');
    if (ownerRole) {
      await this.authRepo.assignRoleToUser(user.id, ownerRole.id);
    }

    const permissions = ownerRole ? [] /* we would fetch permissions from ownerRole.rolePermissions */ : [];
    const tokens = await this.generateTokens(user.id, shop.id, user.email, permissions);

    authEvents.userRegistered({ shopId: shop.id, userId: user.id, email: user.email });

    log.info({ userId: user.id, shopId: shop.id }, 'User registered');

    return success({
      user: {
        id: user.id,
        shopId: shop.id,
        email: user.email,
        name: user.name,
        permissions,
      },
      tokens,
    });
  }

  async login(
    shopId: string,
    dto: LoginDTO,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<ServiceResult<AuthResult>> {
    const user = await this.authRepo.findUserByEmail(shopId, dto.email);

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    const passwordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Extract permissions
    const permissions = user.userRoles.flatMap((ur: any) => 
      ur.role.rolePermissions.map((rp: any) => `${rp.permission.module}:${rp.permission.resource}:${rp.permission.action}`)
    );

    const tokens = await this.generateTokens(user.id, shopId, user.email, permissions);

    await this.authRepo.updateLastLogin(user.id);

    authEvents.userLogin({
      shopId,
      userId: user.id,
      email: user.email,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    log.info({ userId: user.id, shopId }, 'User logged in');

    return success({
      user: {
        id: user.id,
        shopId,
        email: user.email,
        name: user.name,
        permissions,
      },
      tokens,
    });
  }

  async refreshToken(refreshTokenValue: string): Promise<ServiceResult<AuthTokens>> {
    const stored = await this.authRepo.findRefreshToken(refreshTokenValue);

    if (!stored || stored.revokedAt || isExpired(stored.expiresAt)) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    await this.authRepo.revokeRefreshToken(refreshTokenValue);

    const user = await this.authRepo.findUserById(stored.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const permissions = user.userRoles.flatMap((ur: any) => 
      ur.role.rolePermissions.map((rp: any) => `${rp.permission.module}:${rp.permission.resource}:${rp.permission.action}`)
    );

    const tokens = await this.generateTokens(
      user.id,
      user.shopId,
      user.email,
      permissions,
    );

    return success(tokens);
  }

  async logout(userId: string, refreshTokenValue?: string): Promise<void> {
    if (refreshTokenValue) {
      await this.authRepo.revokeRefreshToken(refreshTokenValue);
    } else {
      await this.authRepo.revokeAllUserTokens(userId);
    }

    const user = await this.authRepo.findUserById(userId);
    if (user) {
      authEvents.userLogout({ shopId: user.shopId, userId });
    }
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDTO,
  ): Promise<ServiceResult<void>> {
    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      return failure('USER_NOT_FOUND', 'User not found');
    }

    const currentValid = await verifyPassword(dto.currentPassword, user.passwordHash);
    if (!currentValid) {
      return failure('INVALID_PASSWORD', 'Current password is incorrect');
    }

    const newHash = await hashPassword(dto.newPassword);
    await this.authRepo.updatePassword(userId, newHash);

    await this.authRepo.revokeAllUserTokens(userId);

    log.info({ userId }, 'Password changed');

    return success(undefined);
  }

  private async generateTokens(
    userId: string,
    shopId: string,
    email: string,
    permissions: string[],
  ): Promise<AuthTokens> {
    const payload = {
      sub: userId,
      shopId,
      email,
      permissions,
    };

    // Need to cast the expiresIn value to avoid TS errors
    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
    });

    const refreshToken = generateToken(48);
    const refreshExpiry = addDuration(new Date(), env.JWT_REFRESH_EXPIRY);

    await this.authRepo.storeRefreshToken(userId, refreshToken, refreshExpiry);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(env.JWT_ACCESS_EXPIRY),
    };
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900; 
    const value = parseInt(match[1]!, 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit!] ?? 60);
  }
}
