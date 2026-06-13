import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * Hash a password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure random token.
 * Used for refresh tokens, email verification tokens, etc.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Generate a short numeric code (e.g., for OTP/verification).
 */
export function generateOtp(length = 6): string {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const otp = Math.floor(Math.random() * (max - min) + min);
  return otp.toString();
}
