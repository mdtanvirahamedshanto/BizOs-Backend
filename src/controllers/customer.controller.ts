import type { Request, Response, NextFunction } from 'express';
import { CustomerService } from '@/services/customer.service';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';
import { PdfService } from '@/services/pdf.service';
import { prisma } from '@/prisma/client';
import { NotFoundError } from '@/utils/errors';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id;
      const result = await this.customerService.createCustomer(shopId, req.body, actorUserId);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const customerId = req.params.id as string;
      const result = await this.customerService.getCustomer(shopId, customerId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const customerId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.customerService.updateCustomer(shopId, customerId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  deleteCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const customerId = req.params.id as string;
      const actorUserId = req.user?.id;
      await this.customerService.deleteCustomer(shopId, customerId, actorUserId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  listCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.customerService.listCustomers(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  generateCustomerStatementPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const customerId = req.params.id as string;

      // 1. Fetch customer
      const customerResult = await this.customerService.getCustomer(shopId, customerId);
      const customer = customerResult.data;

      // 2. Fetch khata account and entries
      const khataAccount = await prisma.khataAccount.findFirst({
        where: { shopId, partyType: 'CUSTOMER', partyId: customerId },
      });

      const entries = khataAccount
        ? await prisma.khataEntry.findMany({
            where: { shopId, khataAccountId: khataAccount.id },
            orderBy: { entryDate: 'asc' },
          })
        : [];

      // 3. Fetch shop
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
      });

      if (!shop) {
        throw new NotFoundError('Shop');
      }

      // 4. Render PDF
      const pdfBuffer = await PdfService.generateCustomerStatement(customer, entries, shop);

      // 5. Stream back
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="statement-${customer.name}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err) {
      next(err);
    }
  };
}
