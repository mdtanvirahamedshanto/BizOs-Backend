import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { CashbookRepository } from './cashbook.repository';

export class SalesRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(shopId: string, id: string) {
    return this.prisma.sale.findFirst({
      where: { id, shopId, deletedAt: null },
      include: {
        customer: true,
        cashier: {
          select: { id: true, name: true, email: true },
        },
        items: true,
        payments: {
          orderBy: { paidAt: 'desc' },
        },
      },
    });
  }

  async findAndCountSales(
    shopId: string,
    options: {
      search?: string;
      status?: 'DRAFT' | 'COMPLETED' | 'RETURNED' | 'VOID';
      paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
      startDate?: Date;
      endDate?: Date;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const whereClause: any = { shopId, deletedAt: null };

    if (options.status) {
      whereClause.status = options.status;
    }

    if (options.paymentStatus) {
      whereClause.paymentStatus = options.paymentStatus;
    }

    if (options.startDate || options.endDate) {
      whereClause.saleDate = {};
      if (options.startDate) {
        whereClause.saleDate.gte = options.startDate;
      }
      if (options.endDate) {
        whereClause.saleDate.lte = options.endDate;
      }
    }

    if (options.search) {
      whereClause.OR = [
        { invoiceNumber: { contains: options.search, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { phone: { contains: options.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'createdAt']: options.sortOrder || 'desc' },
      include: {
        customer: true,
        cashier: { select: { name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany(queryOptions),
      this.prisma.sale.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async generateNextInvoiceNumber(shopId: string, prefix = 'INV'): Promise<string> {
    const lastSale = await this.prisma.sale.findFirst({
      where: { shopId },
      orderBy: { invoiceNumber: 'desc' },
    });

    const currentYear = new Date().getFullYear();
    let sequence = 1;

    if (lastSale) {
      const parts = lastSale.invoiceNumber.split('-');
      const lastSeqStr = parts[parts.length - 1] || '0';
      const parsedSeq = parseInt(lastSeqStr, 10);
      if (!isNaN(parsedSeq)) {
        sequence = parsedSeq + 1;
      }
    }

    const sequenceStr = String(sequence).padStart(5, '0');
    return `${prefix}-${currentYear}-${sequenceStr}`;
  }

  async createSale(
    shopId: string,
    userId: string,
    invoiceNumber: string,
    saleData: {
      customerId: string | null;
      saleDate: Date;
      status: 'DRAFT' | 'COMPLETED' | 'RETURNED' | 'VOID';
      subtotalCents: number;
      discountType: 'PERCENTAGE' | 'FIXED' | null;
      discountValue: number;
      discountCents: number;
      taxCents: number;
      totalCents: number;
      paidCents: number;
      dueCents: number;
      paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
      notes: string | null;
      items: Array<{
        productId: string;
        productName: string;
        sku: string;
        quantity: number;
        unitPriceCents: number;
        discountCents: number;
        taxCents: number;
        totalCents: number;
      }>;
      payment?: {
        amountCents: number;
        method: 'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK' | 'CARD' | 'CHECK' | 'OTHER';
        reference: string | null;
      };
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify and deduct inventory for each item
      for (const item of saleData.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, shopId, deletedAt: null },
        });

        if (!product) {
          throw new NotFoundError(`Product ${item.productId}`);
        }

        if (product.stockQuantity < item.quantity) {
          throw new ConflictError(
            `Insufficient stock for product "${product.name}". Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
          );
        }

        // Decrement product stock quantity
        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: { decrement: item.quantity },
          },
        });

        // Write StockMovement record
        await tx.stockMovement.create({
          data: {
            shopId,
            productId: product.id,
            type: 'OUT',
            quantity: -item.quantity,
            unitCostCents: product.costPriceCents,
            referenceType: 'sale',
            notes: `Sold via invoice ${invoiceNumber}`,
            createdBy: userId,
          },
        });
      }

      // 2. Create the Sale
      const sale = await tx.sale.create({
        data: {
          shopId,
          customerId: saleData.customerId,
          soldBy: userId,
          invoiceNumber,
          status: saleData.status,
          subtotalCents: saleData.subtotalCents,
          discountType: saleData.discountType,
          discountValue: saleData.discountValue,
          discountCents: saleData.discountCents,
          taxCents: saleData.taxCents,
          totalCents: saleData.totalCents,
          paidCents: saleData.paidCents,
          dueCents: saleData.dueCents,
          paymentStatus: saleData.paymentStatus,
          notes: saleData.notes,
          saleDate: saleData.saleDate,
          items: {
            create: saleData.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
              discountCents: item.discountCents,
              taxCents: item.taxCents,
              totalCents: item.totalCents,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // 3. Create upfront Payment record if present
      if (saleData.payment && saleData.payment.amountCents > 0) {
        const payment = await tx.payment.create({
          data: {
            shopId,
            type: 'RECEIVED',
            method: saleData.payment.method,
            amountCents: saleData.payment.amountCents,
            payableType: 'sale',
            payableId: sale.id,
            reference: saleData.payment.reference,
            notes: 'Upfront payment during sale checkout',
            recordedBy: userId,
            saleId: sale.id,
          },
        });

        if (saleData.payment.method === 'CASH') {
          await CashbookRepository.recordEntry(tx, shopId, {
            type: 'IN',
            amountCents: saleData.payment.amountCents,
            description: `Upfront cash payment for Invoice ${invoiceNumber}`,
            referenceType: 'payment',
            referenceId: payment.id,
            recordedBy: userId,
          });
        }
      }

      // 4. Update Customer stats & Khata Account balance if applicable
      if (saleData.customerId) {
        await tx.customer.update({
          where: { id: saleData.customerId },
          data: {
            totalPurchasesCents: { increment: saleData.totalCents },
            totalOrders: { increment: 1 },
          },
        });

        // If outstanding dues exist, post to Khata Account
        if (saleData.dueCents > 0) {
          let khata = await tx.khataAccount.findFirst({
            where: { shopId, partyType: 'CUSTOMER', partyId: saleData.customerId },
          });

          if (!khata) {
            khata = await tx.khataAccount.create({
              data: {
                shopId,
                partyType: 'CUSTOMER',
                partyId: saleData.customerId,
                balanceCents: 0,
                creditLimitCents: 0,
              },
            });
          }

          const newBalance = khata.balanceCents + saleData.dueCents;

          await tx.khataAccount.update({
            where: { id: khata.id },
            data: { balanceCents: newBalance },
          });

          await tx.khataEntry.create({
            data: {
              shopId,
              khataAccountId: khata.id,
              type: 'DEBIT',
              amountCents: saleData.dueCents,
              runningBalanceCents: newBalance,
              description: `Outstanding balance for invoice ${invoiceNumber}`,
              referenceType: 'sale',
              referenceId: sale.id,
              recordedBy: userId,
            },
          });
        }
      }

      return sale;
    });
  }

  async processReturn(
    shopId: string,
    saleId: string,
    userId: string,
    returnData: {
      items?: Array<{ productId: string; quantity: number }>;
      refundAmountCents: number;
      notes: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id: saleId, shopId, deletedAt: null },
        include: { items: true },
      });

      if (!sale) {
        throw new NotFoundError('Sale');
      }

      if (sale.status === 'RETURNED' || sale.status === 'VOID') {
        throw new ConflictError('This sale is already returned or voided');
      }

      const returnItems = returnData.items || [];
      const isFullReturn = returnItems.length === 0;

      // Map of items being returned: productId -> returned quantity
      const returnQtyMap = new Map<string, number>();
      if (!isFullReturn) {
        for (const rItem of returnItems) {
          returnQtyMap.set(rItem.productId, rItem.quantity);
        }
      }

      let returnedTotalCents = 0;
      let totalItemsReturnedCount = 0;

      // 1. Process inventory return and calculate value of returned items
      for (const saleItem of sale.items) {
        let returnQty = 0;

        if (isFullReturn) {
          returnQty = saleItem.quantity;
        } else {
          returnQty = returnQtyMap.get(saleItem.productId) || 0;
        }

        if (returnQty === 0) continue;

        if (returnQty > saleItem.quantity) {
          throw new ConflictError(
            `Cannot return ${returnQty} units of "${saleItem.productName}". Only ${saleItem.quantity} were purchased.`,
          );
        }

        totalItemsReturnedCount++;

        // Calculate item total contribution value (prorated by returned qty)
        const unitTotalCents = Math.round(saleItem.totalCents / saleItem.quantity);
        returnedTotalCents += unitTotalCents * returnQty;

        // Restore stock
        await tx.product.update({
          where: { id: saleItem.productId },
          data: {
            stockQuantity: { increment: returnQty },
          },
        });

        // Write StockMovement record
        await tx.stockMovement.create({
          data: {
            shopId,
            productId: saleItem.productId,
            type: 'RETURN',
            quantity: returnQty,
            referenceType: 'sale',
            notes: `Returned items from invoice ${sale.invoiceNumber}`,
            createdBy: userId,
          },
        });

        // If it's a partial return, adjust the quantity of the sale line item
        if (!isFullReturn) {
          const newQty = saleItem.quantity - returnQty;
          if (newQty === 0) {
            await tx.saleItem.delete({
              where: { id: saleItem.id },
            });
          } else {
            // Prorate item totals
            const itemRatio = newQty / saleItem.quantity;
            await tx.saleItem.update({
              where: { id: saleItem.id },
              data: {
                quantity: newQty,
                discountCents: Math.round(saleItem.discountCents * itemRatio),
                taxCents: Math.round(saleItem.taxCents * itemRatio),
                totalCents: Math.round(saleItem.totalCents * itemRatio),
              },
            });
          }
        }
      }

      if (totalItemsReturnedCount === 0 && !isFullReturn) {
        throw new ConflictError('No matching products found in this sale to return');
      }

      // 2. Adjust Sale totals
      const originalTotalCents = sale.totalCents;
      const originalDueCents = sale.dueCents;
      const newTotalCents = isFullReturn ? 0 : Math.max(0, originalTotalCents - returnedTotalCents);

      // Recalculate subtotal/discounts/taxes for partial return based on remaining items
      let newSubtotalCents = 0;
      let newDiscountCents = 0;
      let newTaxCents = 0;

      if (!isFullReturn) {
        const remainingItems = await tx.saleItem.findMany({
          where: { saleId: sale.id },
        });

        for (const item of remainingItems) {
          newSubtotalCents += item.quantity * item.unitPriceCents;
          newDiscountCents += item.discountCents;
          newTaxCents += item.taxCents;
        }
      }

      // paidCents adjusts based on cash refunds
      const newPaidCents = Math.max(0, sale.paidCents - returnData.refundAmountCents);
      const newDueCents = Math.max(0, newTotalCents - newPaidCents);

      // Determine final status
      let finalStatus: 'RETURNED' | 'COMPLETED' = 'RETURNED';
      if (!isFullReturn) {
        const remainingItemsCount = await tx.saleItem.count({
          where: { saleId: sale.id },
        });
        if (remainingItemsCount > 0) {
          finalStatus = 'COMPLETED'; // Keeps completed but adjusted
        }
      }

      // Determine payment status
      let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' = 'PAID';
      if (newTotalCents > 0) {
        if (newDueCents === 0) {
          paymentStatus = 'PAID';
        } else if (newPaidCents === 0) {
          paymentStatus = 'UNPAID';
        } else {
          paymentStatus = 'PARTIAL';
        }
      }

      const appendNotes = returnData.notes ? `\n[Return Notes: ${returnData.notes}]` : '';
      const saleUpdateData: any = {
        status: finalStatus,
        subtotalCents: newSubtotalCents,
        discountCents: newDiscountCents,
        taxCents: newTaxCents,
        totalCents: newTotalCents,
        paidCents: newPaidCents,
        dueCents: newDueCents,
        paymentStatus,
        notes: sale.notes ? `${sale.notes}${appendNotes}` : `Items returned.${appendNotes}`,
      };

      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: saleUpdateData,
        include: { items: true },
      });

      // 3. Create cash refund record (Payment MADE) if cash is returned
      if (returnData.refundAmountCents > 0) {
        const payment = await tx.payment.create({
          data: {
            shopId,
            type: 'MADE',
            method: 'CASH', // default refund to Cash
            amountCents: returnData.refundAmountCents,
            payableType: 'sale',
            payableId: sale.id,
            notes: `Cash refund for returned items on invoice ${sale.invoiceNumber}`,
            recordedBy: userId,
            saleId: sale.id,
          },
        });

        await CashbookRepository.recordEntry(tx, shopId, {
          type: 'OUT',
          amountCents: returnData.refundAmountCents,
          description: `Cash refund for returned items on Invoice ${sale.invoiceNumber}`,
          referenceType: 'payment',
          referenceId: payment.id,
          recordedBy: userId,
        });
      }

      // 4. Update Customer stats & Khata ledger adjustment
      if (sale.customerId) {
        const totalPurchasesDiff = originalTotalCents - newTotalCents;
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            totalPurchasesCents: { decrement: totalPurchasesDiff },
            // If it's a full return, reduce orders count
            totalOrders: isFullReturn ? { decrement: 1 } : undefined,
          },
        });

        // Credit the customer's Khata if outstanding dues were reduced
        const dueCentsDiff = originalDueCents - newDueCents;
        if (dueCentsDiff > 0) {
          const khata = await tx.khataAccount.findFirst({
            where: { shopId, partyType: 'CUSTOMER', partyId: sale.customerId },
          });

          if (khata) {
            const newBalance = khata.balanceCents - dueCentsDiff;
            await tx.khataAccount.update({
              where: { id: khata.id },
              data: { balanceCents: newBalance },
            });

            await tx.khataEntry.create({
              data: {
                shopId,
                khataAccountId: khata.id,
                type: 'CREDIT',
                amountCents: dueCentsDiff,
                runningBalanceCents: newBalance,
                description: `Credit adjust for return on invoice ${sale.invoiceNumber}`,
                referenceType: 'sale',
                referenceId: sale.id,
                recordedBy: userId,
              },
            });
          }
        }
      }

      return updatedSale;
    });
  }
}
