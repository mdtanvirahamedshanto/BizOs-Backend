import jwt from 'jsonwebtoken';
import { env } from '../../env';
import { hashPassword, verifyPassword, generateToken } from '../../common/utils/crypto';
import { addDuration, isExpired } from '../../common/utils/date';
import { generateSlug } from '../../common/utils/slug';
import { UnauthorizedError, ConflictError } from '../../common/errors';
import { success, failure } from '../../common/types/service';
import type { ServiceResult } from '../../common/types/service';
import type { AuthResult, AuthTokens, JwtPayload } from './auth.types';
import type { AuthRepository } from './auth.repository';
import type { TenantService } from '../tenant/tenant.service';
import { authEvents } from './auth.events';
import { createModuleLogger } from '../../config/logger';
import type { RegisterDTO, LoginDTO, ChangePasswordDTO } from './auth.schema';

const log = createModuleLogger('auth');

/**
 * Auth service.
 * Handles registration, login, token management, and password changes.
 */
export class AuthService {
  constructor(
    private authRepo: AuthRepository,
    private tenantService: TenantService,
  ) {}

  /**
   * Register a new user and create their tenant (organization).
   */
  async register(dto: RegisterDTO): Promise<ServiceResult<AuthResult>> {
    const slug = generateSlug(dto.tenantName);

    // Create tenant
    const tenantResult = await this.tenantService.create({
      name: dto.tenantName,
      slug,
    });

    if (!tenantResult.success || !tenantResult.data) {
      return failure('REGISTRATION_FAILED', 'Failed to create organization');
    }

    const tenant = tenantResult.data;

    // Check if user already exists in this tenant
    const existingUser = await this.authRepo.findUserByEmail(tenant.id, dto.email);
    if (existingUser) {
      return failure('USER_EXISTS', 'A user with this email already exists');
    }

    // Hash password and create user
    const passwordHash = await hashPassword(dto.password);
    const user = await this.authRepo.createUser({
      tenantId: tenant.id,
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    // Assign Owner role
    const ownerRole = await this.authRepo.findDefaultRole(tenant.id, 'Owner');
    if (ownerRole) {
      await this.authRepo.assignRoleToUser(user.id, ownerRole.id);
    }

    // Generate tokens
    const permissions = ownerRole ? ownerRole.permissions : [];
    const tokens = await this.generateTokens(user.id, tenant.id, user.email, permissions);

    // Emit events
    authEvents.userRegistered({ tenantId: tenant.id, userId: user.id, email: user.email });

    log.info({ userId: user.id, tenantId: tenant.id }, 'User registered');

    return success({
      user: {
        id: user.id,
        tenantId: tenant.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        permissions,
      },
      tokens,
    });
  }

  /**
   * Authenticate a user with email and password.
   */
  async login(
    tenantId: string,
    dto: LoginDTO,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<ServiceResult<AuthResult>> {
    const user = await this.authRepo.findUserByEmail(tenantId, dto.email);

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

    // Collect permissions from all assigned roles
    const permissions = user.roles.flatMap((ur) => ur.role.permissions);

    const tokens = await this.generateTokens(user.id, tenantId, user.email, permissions);

    // Update last login timestamp
    await this.authRepo.updateLastLogin(user.id);

    // Emit events
    authEvents.userLogin({
      tenantId,
      userId: user.id,
      email: user.email,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    log.info({ userId: user.id, tenantId }, 'User logged in');

    return success({
      user: {
        id: user.id,
        tenantId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        permissions,
      },
      tokens,
    });
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  async refreshToken(refreshTokenValue: string): Promise<ServiceResult<AuthTokens>> {
    const stored = await this.authRepo.findRefreshToken(refreshTokenValue);

    if (!stored || stored.revokedAt || isExpired(stored.expiresAt)) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Revoke the old refresh token (rotation)
    await this.authRepo.revokeRefreshToken(refreshTokenValue);

    // Fetch user with current permissions
    const user = await this.authRepo.findUserById(stored.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const permissions = user.roles.flatMap((ur) => ur.role.permissions);
    const tokens = await this.generateTokens(
      user.id,
      user.tenantId,
      user.email,
      permissions,
    );

    return success(tokens);
  }

  /**
   * Logout — revoke the refresh token.
   */
  async logout(userId: string, refreshTokenValue?: string): Promise<void> {
    if (refreshTokenValue) {
      await this.authRepo.revokeRefreshToken(refreshTokenValue);
    } else {
      await this.authRepo.revokeAllUserTokens(userId);
    }

    const user = await this.authRepo.findUserById(userId);
    if (user) {
      authEvents.userLogout({ tenantId: user.tenantId, userId });
    }
  }

  /**
   * Change user password.
   */
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

    // Revoke all existing refresh tokens for security
    await this.authRepo.revokeAllUserTokens(userId);

    log.info({ userId }, 'Password changed');

    return success(undefined);
  }

  /**
   * Generate JWT access + refresh token pair.
   */
  private async generateTokens(
    userId: string,
    tenantId: string,
    email: string,
    permissions: string[],
  ): Promise<AuthTokens> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: userId,
      tenantId,
      email,
      permissions,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY,
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
    if (!match) return 900; // default 15 min
    const value = parseInt(match[1]!, 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit!] ?? 60);
  }
}
