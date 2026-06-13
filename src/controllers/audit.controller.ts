import type { Request, Response, NextFunction } from 'express';
import { AuditQueryService } from '@/services/auditQuery.service';
import { sendSuccess } from '@/utils/response';
import type { AuditQueryDTO } from '@/validators/audit.schema';

export class AuditController {
  constructor(private auditQueryService: AuditQueryService) {}

  listLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.auditQueryService.listLogs(shopId, req.query as unknown as AuditQueryDTO);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getLog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const logId = req.params.id as string;
      const result = await this.auditQueryService.getLog(shopId, logId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listActions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.auditQueryService.listActions(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
