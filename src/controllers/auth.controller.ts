import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from '@/services/auth.service';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';
import { setCsrfToken } from '@/middlewares';

/**
 * Auth controller.
 * Handles HTTP request/response mapping. No business logic.
 */
export class AuthController {
  constructor(private authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      if (result.success) {
        if (result.data?.tokens) {
          const { accessToken, refreshToken } = result.data.tokens;
          res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1 * 24 * 60 * 60 * 1000,
          });
          res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });
        }
        sendCreated(res, result.data);
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // In multi-tenant login, shopId is provided in request body
      const shopId = req.body.shopId || req.tenantId;
      const result = await this.authService.login(shopId, req.body, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      if (result.success && result.data?.tokens) {
        const { accessToken, refreshToken } = result.data.tokens;
        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 1 * 24 * 60 * 60 * 1000,
        });
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokenVal = req.body.refreshToken || req.cookies?.refreshToken;
      const result = await this.authService.refreshToken(tokenVal);
      if (result.success && result.data) {
        const { accessToken, refreshToken } = result.data;
        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 1 * 24 * 60 * 60 * 1000,
        });
        if (refreshToken) {
          res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });
        }
      }
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokenVal = req.body.refreshToken || req.cookies?.refreshToken;
      await this.authService.logout(req.user!.id, tokenVal);
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.changePassword(req.user!.id, req.body);
      if (result.success) {
        sendSuccess(res, { message: 'Password changed successfully' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.getProfile(req.user!.id, req.user!.shopId);
      if (result.success) {
        sendSuccess(res, result.data);
      } else {
        res.status(404).json({ success: false, error: result.error });
      }
    } catch (err) {
      next(err);
    }
  };

  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.requestPasswordReset(req.body);
      sendSuccess(res, { message: 'If the email matches an active account, a password reset link has been generated and logged.' });
    } catch (err) {
      next(err);
    }
  };

  confirmPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.confirmPasswordReset(req.body);
      sendSuccess(res, { message: 'Password has been reset successfully.' });
    } catch (err) {
      next(err);
    }
  };

  requestOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.requestOtp(req.body);
      sendSuccess(res, { message: 'If the phone number matches an active account, an OTP code has been generated and logged.' });
    } catch (err) {
      next(err);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.verifyOtp(req.body, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      if (result.success && result.data?.tokens) {
        const { accessToken, refreshToken } = result.data.tokens;
        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 1 * 24 * 60 * 60 * 1000,
        });
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getCsrfToken = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = setCsrfToken(res);
      sendSuccess(res, { csrfToken: token });
    } catch (err) {
      next(err);
    }
  };
}
