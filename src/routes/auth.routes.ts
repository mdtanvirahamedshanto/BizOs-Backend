import { Router } from 'express';
import { AuthController } from '@/controllers/auth.controller';
import { AuthService } from '@/services/auth.service';
import { AuthRepository } from '@/repositories/auth.repository';
import { prisma } from '@/prisma/client';
import { validate } from '@/middlewares/validate';
import { authenticate } from '@/middlewares/authenticate';
import { strictRateLimiter } from '@/middlewares/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  otpRequestSchema,
  otpVerifySchema,
} from '@/validators/auth.schema';

const router = Router();
const authRepo = new AuthRepository(prisma);
const authService = new AuthService(authRepo);
const authController = new AuthController(authService);

// Registration & Login
router.get('/csrf', authController.getCsrfToken);
router.post('/register', strictRateLimiter(10, 15 * 60 * 1000), validate(registerSchema), authController.register);
router.post('/login', strictRateLimiter(10, 15 * 60 * 1000), validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);
router.post('/logout', authenticate, authController.logout);

// Password Management
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.get('/me', authenticate, authController.me);

// Password Reset (Redis-backed)
router.post('/password-reset/request', strictRateLimiter(5, 15 * 60 * 1000), validate(passwordResetRequestSchema), authController.requestPasswordReset);
router.post('/password-reset/confirm', strictRateLimiter(5, 15 * 60 * 1000), validate(passwordResetConfirmSchema), authController.confirmPasswordReset);

// OTP Authentication (Redis-backed)
router.post('/otp/request', strictRateLimiter(5, 15 * 60 * 1000), validate(otpRequestSchema), authController.requestOtp);
router.post('/otp/verify', strictRateLimiter(10, 15 * 60 * 1000), validate(otpVerifySchema), authController.verifyOtp);

export const authRoutes = router;
