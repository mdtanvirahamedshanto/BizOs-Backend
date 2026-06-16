import type { Request, Response, NextFunction } from 'express';
import type { UserService } from '@/services/user.service';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';

export class UserController {
  constructor(private userService: UserService) {}

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.userService.listUsers(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  inviteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.userService.inviteUser(shopId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.params.id as string;
      const result = await this.userService.updateUserRole(shopId, userId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.params.id as string;
      await this.userService.deleteUser(shopId, userId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  listRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.userService.listRoles(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
