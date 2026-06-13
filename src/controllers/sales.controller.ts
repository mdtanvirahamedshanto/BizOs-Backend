import type { Request, Response, NextFunction } from 'express';
import { SalesService } from '@/services/sales.service';
import { PdfService } from '@/services/pdf.service';
import { prisma } from '@/prisma/client';
import { NotFoundError } from '@/utils/errors';
import { sendSuccess, sendCreated } from '@/utils/response';

export class SalesController {
  constructor(private salesService: SalesService) {}

  createSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id!;
      const result = await this.salesService.createSale(shopId, userId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const saleId = req.params.id as string;
      const result = await this.salesService.getSale(shopId, saleId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.salesService.listSales(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  processReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const saleId = req.params.id as string;
      const userId = req.user?.id!;
      const result = await this.salesService.processReturn(shopId, saleId, userId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  generateInvoicePdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const saleId = req.params.id as string;

      // 1. Fetch sale
      const saleResult = await this.salesService.getSale(shopId, saleId);
      const sale = saleResult.data;

      // 2. Fetch shop metadata for PDF customization
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
      });

      if (!shop) {
        throw new NotFoundError('Shop');
      }

      // 3. Render PDF
      const pdfBuffer = await PdfService.generateInvoice(sale, shop);

      // 4. Stream back to browser
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="invoice-${sale.invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err) {
      next(err);
    }
  };
}
