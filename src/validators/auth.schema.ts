import { z } from 'zod';

/** Register a new user */
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(200),
  shopName: z.string().min(2, 'Shop name must be at least 2 characters').max(200),
});

/** Login with email and password */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/** Refresh access token */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/** Change password */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export type RegisterDTO = z.infer<typeof registerSchema>;
export type LoginDTO = z.infer<typeof loginSchema>;
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;

/** Request password reset link */
export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  shopId: z.string().uuid('Invalid shop ID format'),
});

/** Confirm password reset with token */
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Request OTP login */
export const otpRequestSchema = z.object({
  phone: z.string().min(10, 'Invalid phone number format').max(15),
  shopId: z.string().uuid('Invalid shop ID format'),
});

/** Verify OTP and complete login */
export const otpVerifySchema = z.object({
  phone: z.string().min(10, 'Invalid phone number format').max(15),
  shopId: z.string().uuid('Invalid shop ID format'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

export type PasswordResetRequestDTO = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmDTO = z.infer<typeof passwordResetConfirmSchema>;
export type OtpRequestDTO = z.infer<typeof otpRequestSchema>;
export type OtpVerifyDTO = z.infer<typeof otpVerifySchema>;

