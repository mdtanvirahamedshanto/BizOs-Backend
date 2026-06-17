import type { Request, Response, NextFunction } from 'express';
import type { PlatformService } from '@/services/platform.service';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';

export class PlatformController {
  constructor(private platformService: PlatformService) {}

  getHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const health = await this.platformService.getHealth();
      sendSuccess(res, health);
    } catch (err) {
      next(err);
    }
  };

  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.platformService.getStats();
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  };

  listBackups = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const backups = await this.platformService.listBackups();
      sendSuccess(res, backups);
    } catch (err) {
      next(err);
    }
  };

  createBackup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.platformService.createBackup(req.user?.email);
      sendCreated(res, result);
    } catch (err) {
      next(err);
    }
  };

  downloadBackup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filePath = this.platformService.getBackupFilePath(req.params.name as string);
      res.download(filePath, req.params.name as string, (err) => {
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      next(err);
    }
  };

  deleteBackup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.platformService.deleteBackup(req.params.name as string);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };
}
