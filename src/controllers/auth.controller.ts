import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from '@/services/auth.service';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';

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
      // For login, tenantId comes from the request body or a tenant lookup
      const tenantId = req.body.tenantId || req.tenantId;
      const result = await this.authService.login(tenantId, req.body, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.refreshToken(req.body.refreshToken);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.authService.logout(req.user!.id, req.body.refreshToken);
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
      sendSuccess(res, req.user);
    } catch (err) {
      next(err);
    }
  };
}
