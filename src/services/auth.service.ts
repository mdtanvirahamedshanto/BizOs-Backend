import jwt from 'jsonwebtoken';
import { env } from '@/env';
import { hashPassword, verifyPassword, generateToken, generateOtp } from '@/utils/crypto';
import { addDuration, isExpired } from '@/utils/date';
import { redis } from '@/config/redis';
import { generateSlug } from '@/utils/slug';
import { AuditService } from '@/services/audit.service';

import { UnauthorizedError, NotFoundError } from '@/utils/errors';
import { success, failure } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import type { AuthResult, AuthTokens } from '@/types/auth.types';
import type { AuthRepository } from '@/repositories/auth.repository';
import { authEvents } from '@/events/auth.events';
import { SessionService } from '@/services/session.service';
import { createModuleLogger } from '@/config/logger';
import type {
  RegisterDTO,
  LoginDTO,
  ChangePasswordDTO,
  PasswordResetRequestDTO,
  PasswordResetConfirmDTO,
  OtpRequestDTO,
  OtpVerifyDTO,
} from '@/validators/auth.schema';

const log = createModuleLogger('auth');

export class AuthService {
  constructor(private authRepo: AuthRepository) {}

  async register(dto: RegisterDTO): Promise<ServiceResult<AuthResult>> {
    const slug = generateSlug(dto.shopName);
    const passwordHash = await hashPassword(dto.password);

    // Call transactional registration helper in repository
    const { shop, user } = await this.authRepo.registerShopAndOwner(
      { name: dto.shopName, slug },
      { email: dto.email, passwordHash, name: dto.name },
    );

    // Permissions for the owner role
    const permissions: string[] = ['*:*:*'];
    const tokens = await this.generateTokens(user.id, shop.id, user.email, permissions);

    // Trigger events
    authEvents.userRegistered({ shopId: shop.id, userId: user.id, email: user.email });

    // Write audit log
    await AuditService.log({
      shopId: shop.id,
      userId: user.id,
      action: 'auth.register',
      entity: 'shops',
      entityId: shop.id,
      metadata: { email: user.email, shopName: shop.name },
    });

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

    // When the caller does not supply a shopId (e.g. email-only login from the
    // mobile app), fall back to the shop the resolved user belongs to so the
    // issued token always carries a valid tenant claim.
    const effectiveShopId = shopId || user.shopId;

    // Extract permissions
    const permissions = user.userRoles.flatMap((ur: any) =>
      ur.role.rolePermissions.map((rp: any) => `${rp.permission.resource}.${rp.permission.action}`)
    );

    // Default to wildcard if it's Owner or SuperAdmin
    const hasOwnerOrSuperAdmin = user.userRoles.some((ur: any) => ur.role.name === 'Owner' || ur.role.name === 'SuperAdmin');
    const activePermissions = hasOwnerOrSuperAdmin ? ['*'] : permissions;

    const tokens = await this.generateTokens(user.id, effectiveShopId, user.email, activePermissions);

    await this.authRepo.updateLastLogin(user.id);

    // Trigger events
    authEvents.userLogin({
      shopId: effectiveShopId,
      userId: user.id,
      email: user.email,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    // Write audit log
    await AuditService.log({
      shopId: effectiveShopId,
      userId: user.id,
      action: 'auth.login',
      entity: 'users',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    log.info({ userId: user.id, shopId: effectiveShopId }, 'User logged in');

    return success({
      user: {
        id: user.id,
        shopId: effectiveShopId,
        email: user.email,
        name: user.name,
        permissions: activePermissions,
      },
      tokens,
    });
  }

  async refreshToken(refreshTokenValue: string): Promise<ServiceResult<AuthTokens>> {
    if (await SessionService.isRefreshTokenBlacklisted(refreshTokenValue)) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

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
      ur.role.rolePermissions.map((rp: any) => `${rp.permission.resource}.${rp.permission.action}`)
    );

    const hasOwnerOrSuperAdmin = user.userRoles.some((ur: any) => ur.role.name === 'Owner' || ur.role.name === 'SuperAdmin');
    const activePermissions = hasOwnerOrSuperAdmin ? ['*'] : permissions;

    const tokens = await this.generateTokens(
      user.id,
      user.shopId,
      user.email,
      activePermissions,
    );

    return success(tokens);
  }

  async logout(userId: string, refreshTokenValue?: string): Promise<void> {
    const user = await this.authRepo.findUserById(userId);

    if (refreshTokenValue) {
      await this.authRepo.revokeRefreshToken(refreshTokenValue);
      await SessionService.revokeRefreshSession(refreshTokenValue, userId);
      await SessionService.blacklistRefreshToken(refreshTokenValue, 7 * 24 * 60 * 60);
    } else {
      await this.authRepo.revokeAllUserTokens(userId);
      await SessionService.revokeAllUserSessions(userId);
    }

    if (user) {
      // Trigger events
      authEvents.userLogout({ shopId: user.shopId, userId });

      // Write audit log
      await AuditService.log({
        shopId: user.shopId,
        userId,
        action: 'auth.logout',
        entity: 'users',
        entityId: userId,
      });
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

    // Write audit log
    await AuditService.log({
      shopId: user.shopId,
      userId,
      action: 'auth.change_password',
      entity: 'users',
      entityId: userId,
    });

    log.info({ userId }, 'Password changed');

    return success(undefined);
  }

  async requestPasswordReset(dto: PasswordResetRequestDTO): Promise<ServiceResult<void>> {
    const user = await this.authRepo.findUserByEmail(dto.shopId, dto.email);
    if (!user) {
      // We return success to prevent user enumeration attacks, but warn log it
      log.warn({ email: dto.email, shopId: dto.shopId }, 'Password reset requested for non-existent user');
      return success(undefined);
    }

    const token = generateToken(32);
    const redisKey = `auth:password-reset:${token}`;
    // Expire reset token after 1 hour (3600s)
    await redis.set(redisKey, user.id, 'EX', 3600);

    // Simulate sending email by logging
    log.info(
      { email: user.email, shopId: dto.shopId, resetToken: token },
      `[SIMULATED EMAIL] Password reset token generated. URL: ${env.APP_URL}/api/v1/auth/password-reset/confirm?token=${token}`
    );

    // Write audit log
    await AuditService.log({
      shopId: dto.shopId,
      userId: user.id,
      action: 'auth.password_reset_requested',
      entity: 'users',
      entityId: user.id,
      metadata: { email: user.email },
    });

    return success(undefined);
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDTO): Promise<ServiceResult<void>> {
    const redisKey = `auth:password-reset:${dto.token}`;
    const userId = await redis.get(redisKey);

    if (!userId) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.authRepo.updatePassword(userId, passwordHash);
    await this.authRepo.revokeAllUserTokens(userId);

    // Remove token
    await redis.del(redisKey);

    // Write audit log
    await AuditService.log({
      shopId: user.shopId,
      userId: user.id,
      action: 'auth.password_reset_confirmed',
      entity: 'users',
      entityId: user.id,
    });

    log.info({ userId }, 'Password reset confirmed');

    return success(undefined);
  }

  async requestOtp(dto: OtpRequestDTO): Promise<ServiceResult<void>> {
    const user = await this.authRepo.findUserByPhone(dto.shopId, dto.phone);
    if (!user) {
      throw new NotFoundError('User with this phone number');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is not active');
    }

    const otp = generateOtp(6);
    const redisKey = `auth:otp:${dto.shopId}:${dto.phone}`;
    const attemptsKey = `auth:otp-attempts:${dto.shopId}:${dto.phone}`;

    // Expire OTP in 5 minutes (300s)
    await redis.set(redisKey, otp, 'EX', 300);
    await redis.set(attemptsKey, '0', 'EX', 300);

    // Simulate sending SMS by logging
    log.info(
      { phone: dto.phone, shopId: dto.shopId, otp },
      `[SIMULATED SMS] OTP code generated. OTP: ${otp}`
    );

    // Write audit log
    await AuditService.log({
      shopId: dto.shopId,
      userId: user.id,
      action: 'auth.otp_requested',
      entity: 'users',
      entityId: user.id,
      metadata: { phone: dto.phone },
    });

    return success(undefined);
  }

  async verifyOtp(
    dto: OtpVerifyDTO,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<ServiceResult<AuthResult>> {
    const user = await this.authRepo.findUserByPhone(dto.shopId, dto.phone);
    if (!user) {
      throw new NotFoundError('User');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is not active');
    }

    const redisKey = `auth:otp:${dto.shopId}:${dto.phone}`;
    const attemptsKey = `auth:otp-attempts:${dto.shopId}:${dto.phone}`;

    const attempts = await redis.get(attemptsKey);
    if (attempts && parseInt(attempts, 10) >= 3) {
      throw new UnauthorizedError('Too many failed OTP verification attempts. Please request a new OTP.');
    }

    const storedOtp = await redis.get(redisKey);
    if (!storedOtp) {
      throw new UnauthorizedError('OTP has expired or is invalid');
    }

    if (storedOtp !== dto.otp) {
      await redis.incr(attemptsKey);
      throw new UnauthorizedError('Invalid OTP code');
    }

    // Success! Clear Redis OTP data
    await redis.del(redisKey);
    await redis.del(attemptsKey);

    // Extract permissions
    const permissions = user.userRoles.flatMap((ur: any) =>
      ur.role.rolePermissions.map((rp: any) => `${rp.permission.resource}.${rp.permission.action}`)
    );

    const hasOwnerOrSuperAdmin = user.userRoles.some((ur: any) => ur.role.name === 'Owner' || ur.role.name === 'SuperAdmin');
    const activePermissions = hasOwnerOrSuperAdmin ? ['*'] : permissions;

    const tokens = await this.generateTokens(user.id, dto.shopId, user.email, activePermissions);

    await this.authRepo.updateLastLogin(user.id);

    // Write audit log
    await AuditService.log({
      shopId: dto.shopId,
      userId: user.id,
      action: 'auth.otp_login',
      entity: 'users',
      entityId: user.id,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    log.info({ userId: user.id, shopId: dto.shopId }, 'User logged in via OTP');

    return success({
      user: {
        id: user.id,
        shopId: dto.shopId,
        email: user.email,
        name: user.name,
        permissions: activePermissions,
      },
      tokens,
    });
  }

  async getProfile(userId: string, shopId: string): Promise<ServiceResult<AuthResult['user']>> {
    const user = await this.authRepo.findUserById(userId);

    if (!user || user.shopId !== shopId || user.deletedAt) {
      throw new NotFoundError('User not found');
    }

    const permissions = user.userRoles.flatMap((ur: any) =>
      ur.role.rolePermissions.map((rp: any) => `${rp.permission.resource}.${rp.permission.action}`),
    );

    const hasOwnerOrSuperAdmin = user.userRoles.some(
      (ur: any) => ur.role.name === 'Owner' || ur.role.name === 'SuperAdmin',
    );
    const activePermissions = hasOwnerOrSuperAdmin ? ['*'] : permissions;

    return success({
      id: user.id,
      shopId: user.shopId,
      email: user.email,
      name: user.name,
      permissions: activePermissions,
    });
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

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
    });

    const refreshToken = generateToken(48);
    const refreshExpiry = addDuration(new Date(), env.JWT_REFRESH_EXPIRY);

    await this.authRepo.storeRefreshToken(userId, refreshToken, refreshExpiry);
    await SessionService.storeRefreshSession(userId, shopId, refreshToken, refreshExpiry);

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
