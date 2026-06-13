/**
 * Auth module types.
 * These are the public-facing types exposed by the auth module.
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expiry
}

export interface AuthUser {
  id: string;
  shopId: string;
  email: string;
  name: string;
  permissions: string[];
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface JwtPayload {
  sub: string;        // userId
  shopId: string;
  email: string;
  permissions: string[];
  iat: number;
  exp: number;
}
