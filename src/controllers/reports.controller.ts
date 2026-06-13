import type { Request, Response, NextFunction } from 'express';
import { ReportsService } from '@/services/reports.service';
import { sendSuccess } from '@/utils/response';
import type { DashboardQueryInput, ReportQueryInput } from '@/validators/reports.schema';

export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  getDailySales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.reportsService.getDailySales(shopId, req.query as ReportQueryInput);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getMonthlySales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.reportsService.getMonthlySales(shopId, req.query as ReportQueryInput);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getProfitReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.reportsService.getProfitReport(shopId, req.query as ReportQueryInput);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getInventoryReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.reportsService.getInventoryReport(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getDueReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.reportsService.getDueReport(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getDashboardMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.reportsService.getDashboardMetrics(
        shopId,
        req.query as unknown as DashboardQueryInput,
      );
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
