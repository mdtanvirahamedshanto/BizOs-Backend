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

  getAdminOverview = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.platformService.getAdminOverview();
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  listTenants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, status } = req.query;
      const data = await this.platformService.listTenants(search as string, status as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  updateTenantStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = req.body;
      const data = await this.platformService.updateTenantStatus(req.params.id as string, status);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getTickets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = req.query;
      const data = await this.platformService.getTickets(status as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  resolveTicket = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { replyMessage, nextStatus } = req.body;
      const data = await this.platformService.resolveTicket(req.params.id as string, replyMessage, nextStatus);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getFlags = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.platformService.getFlags();
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  toggleFlag = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { enabled } = req.body;
      const data = await this.platformService.toggleFlag(req.params.key as string, enabled);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getMonitoringStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.platformService.getMonitoringStats();
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getPlans = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.platformService.getPlans();
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  updatePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const data = await this.platformService.updatePlan(id, req.body);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getSubscriptionRequests = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.platformService.getSubscriptionRequests();
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  approveSubscriptionRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const data = await this.platformService.approveSubscriptionRequest(id);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  rejectSubscriptionRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const data = await this.platformService.rejectSubscriptionRequest(id);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };
}
