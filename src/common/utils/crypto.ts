import argon2 from 'argon2';
import { randomBytes } from 'crypto';

/**
 * Hash a password using Argon2id.
 * Argon2id is the recommended algorithm for password hashing (OWASP).
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against an Argon2id hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, password);
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
