import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError } from '@/utils/errors';

export class PurchaseRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(shopId: string, id: string) {
    return this.prisma.purchase.findFirst({
      where: { id, shopId, deletedAt: null },
      include: {
        supplier: true,
        buyer: { select: { id: true, name: true, email: true } },
        items: true,
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
  }

  async findAndCountPurchases(
    shopId: string,
    options: {
      search?: string;
      status?: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
      paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
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

    if (options.search) {
      whereClause.OR = [
        { referenceNumber: { contains: options.search, mode: 'insensitive' } },
        {
          supplier: {
            OR: [
              { name: { contains: options.search, mode: 'insensitive' } },
              { company: { contains: options.search, mode: 'insensitive' } },
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
        supplier: true,
        buyer: { select: { name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany(queryOptions),
      this.prisma.purchase.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async generateNextPurchaseNumber(shopId: string, prefix = 'PO'): Promise<string> {
    const lastPurchase = await this.prisma.purchase.findFirst({
      where: { shopId },
      orderBy: { referenceNumber: 'desc' },
    });

    const currentYear = new Date().getFullYear();
    let sequence = 1;

    if (lastPurchase) {
      const parts = lastPurchase.referenceNumber.split('-');
      const lastSeqStr = parts[parts.length - 1] || '0';
      const parsedSeq = parseInt(lastSeqStr, 10);
      if (!isNaN(parsedSeq)) {
        sequence = parsedSeq + 1;
      }
    }

    const sequenceStr = String(sequence).padStart(5, '0');
    return `${prefix}-${currentYear}-${sequenceStr}`;
  }

  async createPurchase(
    shopId: string,
    userId: string,
    referenceNumber: string,
    purchaseData: {
      supplierId: string | null;
      purchaseDate: Date;
      expectedDate: Date | null;
      status: 'DRAFT' | 'ORDERED' | 'RECEIVED';
      subtotalCents: number;
      taxCents: number;
      discountCents: number;
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
        unitCostCents: number;
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
      const isReceived = purchaseData.status === 'RECEIVED';

      // 1. Process inventory stock additions if status is RECEIVED
      if (isReceived) {
        for (const item of purchaseData.items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, shopId, deletedAt: null },
          });

          if (!product) {
            throw new NotFoundError(`Product ${item.productId}`);
          }

          // Increment product stock quantity and update purchase cost price
          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQuantity: { increment: item.quantity },
              costPriceCents: item.unitCostCents, // update cost price to latest
            },
          });

          // Write StockMovement record
          await tx.stockMovement.create({
            data: {
              shopId,
              productId: product.id,
              type: 'IN',
              quantity: item.quantity,
              unitCostCents: item.unitCostCents,
              referenceType: 'purchase',
              notes: `Purchased via PO ${referenceNumber}`,
              createdBy: userId,
            },
          });
        }
      }

      // 2. Create the Purchase Order
      const purchase = await tx.purchase.create({
        data: {
          shopId,
          supplierId: purchaseData.supplierId,
          purchasedBy: userId,
          referenceNumber,
          status: purchaseData.status,
          subtotalCents: purchaseData.subtotalCents,
          taxCents: purchaseData.taxCents,
          discountCents: purchaseData.discountCents,
          totalCents: purchaseData.totalCents,
          paidCents: purchaseData.paidCents,
          dueCents: purchaseData.dueCents,
          paymentStatus: purchaseData.paymentStatus,
          notes: purchaseData.notes,
          purchaseDate: purchaseData.purchaseDate,
          expectedDate: purchaseData.expectedDate,
          receivedDate: isReceived ? new Date() : null,
          items: {
            create: purchaseData.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              quantity: item.quantity,
              unitCostCents: item.unitCostCents,
              totalCents: item.totalCents,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // 3. Create upfront Payment record if present
      if (purchaseData.payment && purchaseData.payment.amountCents > 0) {
        await tx.payment.create({
          data: {
            shopId,
            type: 'MADE', // shop pays supplier
            method: purchaseData.payment.method,
            amountCents: purchaseData.payment.amountCents,
            payableType: 'purchase',
            payableId: purchase.id,
            reference: purchaseData.payment.reference,
            notes: 'Upfront payment during PO checkout',
            recordedBy: userId,
            purchaseId: purchase.id,
          },
        });
      }

      // 4. Update Supplier ledger stats & Khata Account balance if applicable
      if (purchaseData.supplierId) {
        await tx.supplier.update({
          where: { id: purchaseData.supplierId },
          data: {
            totalSuppliedCents: { increment: purchaseData.totalCents },
          },
        });

        // If outstanding dues exist, post to Khata Account
        if (purchaseData.dueCents > 0) {
          let khata = await tx.khataAccount.findFirst({
            where: { shopId, partyType: 'SUPPLIER', partyId: purchaseData.supplierId },
          });

          if (!khata) {
            khata = await tx.khataAccount.create({
              data: {
                shopId,
                partyType: 'SUPPLIER',
                partyId: purchaseData.supplierId,
                balanceCents: 0,
                creditLimitCents: 0,
              },
            });
          }

          // Balance semantics: -ve = shop owes supplier (payable).
          // Purchase outstanding dues increase shop payable (make balance more negative)
          const newBalance = khata.balanceCents - purchaseData.dueCents;

          await tx.khataAccount.update({
            where: { id: khata.id },
            data: { balanceCents: newBalance },
          });

          await tx.khataEntry.create({
            data: {
              shopId,
              khataAccountId: khata.id,
              type: 'CREDIT',
              amountCents: purchaseData.dueCents,
              runningBalanceCents: newBalance,
              description: `Outstanding balance for purchase order ${referenceNumber}`,
              referenceType: 'purchase',
              referenceId: purchase.id,
              recordedBy: userId,
            },
          });
        }
      }

      return purchase;
    });
  }

  async updatePurchaseStatus(
    shopId: string,
    purchaseId: string,
    userId: string,
    newStatus: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED',
    notes: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id: purchaseId, shopId, deletedAt: null },
        include: { items: true },
      });

      if (!purchase) {
        throw new NotFoundError('Purchase');
      }

      if (purchase.status === 'RECEIVED' || purchase.status === 'CANCELLED') {
        throw new ConflictError(`Cannot modify status of a completed or cancelled purchase order`);
      }

      const isReceiving = newStatus === 'RECEIVED';

      // 1. Process stock additions if transitioning to RECEIVED
      if (isReceiving) {
        for (const item of purchase.items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, shopId, deletedAt: null },
          });

          if (!product) {
            throw new NotFoundError(`Product ${item.productId}`);
          }

          // Increment product stock quantity and update cost price to latest
          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQuantity: { increment: item.quantity },
              costPriceCents: item.unitCostCents,
            },
          });

          // Write StockMovement record
          await tx.stockMovement.create({
            data: {
              shopId,
              productId: product.id,
              type: 'IN',
              quantity: item.quantity,
              unitCostCents: item.unitCostCents,
              referenceType: 'purchase',
              notes: `Checked in via status transition of PO ${purchase.referenceNumber}`,
              createdBy: userId,
            },
          });
        }
      }

      const appendNotes = notes ? `\n[Status Transition Notes: ${notes}]` : '';

      return tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: newStatus,
          receivedDate: isReceiving ? new Date() : undefined,
          notes: purchase.notes ? `${purchase.notes}${appendNotes}` : notes,
        },
        include: {
          items: true,
        },
      });
    });
  }

  async processReturn(
    shopId: string,
    purchaseId: string,
    userId: string,
    returnData: {
      items?: Array<{ productId: string; quantity: number }>;
      refundAmountCents: number;
      notes: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findFirst({
        where: { id: purchaseId, shopId, deletedAt: null },
        include: { items: true },
      });

      if (!purchase) {
        throw new NotFoundError('Purchase');
      }

      if (purchase.status !== 'RECEIVED') {
        throw new ConflictError('Only purchase orders with RECEIVED status can be returned to supplier');
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

      // 1. Process inventory deduction and calculate value of returned items
      for (const purchaseItem of purchase.items) {
        let returnQty = 0;

        if (isFullReturn) {
          returnQty = purchaseItem.quantity;
        } else {
          returnQty = returnQtyMap.get(purchaseItem.productId) || 0;
        }

        if (returnQty === 0) continue;

        if (returnQty > purchaseItem.quantity) {
          throw new ConflictError(
            `Cannot return ${returnQty} units of "${purchaseItem.productName}". Only ${purchaseItem.quantity} were checked in.`,
          );
        }

        totalItemsReturnedCount++;

        // Calculate item total contribution value (prorated by returned qty)
        const unitTotalCents = Math.round(purchaseItem.totalCents / purchaseItem.quantity);
        returnedTotalCents += unitTotalCents * returnQty;

        // Decrement stock
        const product = await tx.product.findFirst({
          where: { id: purchaseItem.productId, shopId, deletedAt: null },
        });

        if (product && product.stockQuantity < returnQty) {
          // Warning: standard POS system allows inventory to drop negative or throws error. We throw warning/error to prevent negative stock issues.
          throw new ConflictError(
            `Cannot return ${returnQty} units of product "${purchaseItem.productName}" to supplier. Insufficient stock available in warehouse: ${product.stockQuantity}`,
          );
        }

        await tx.product.update({
          where: { id: purchaseItem.productId },
          data: {
            stockQuantity: { decrement: returnQty },
          },
        });

        // Write StockMovement record
        await tx.stockMovement.create({
          data: {
            shopId,
            productId: purchaseItem.productId,
            type: 'OUT',
            quantity: -returnQty,
            referenceType: 'purchase',
            notes: `Returned items from purchase order ${purchase.referenceNumber}`,
            createdBy: userId,
          },
        });

        // If it's a partial return, adjust the quantity of the purchase line item
        if (!isFullReturn) {
          const newQty = purchaseItem.quantity - returnQty;
          if (newQty === 0) {
            await tx.purchaseItem.delete({
              where: { id: purchaseItem.id },
            });
          } else {
            // Prorate item totals
            const itemRatio = newQty / purchaseItem.quantity;
            await tx.purchaseItem.update({
              where: { id: purchaseItem.id },
              data: {
                quantity: newQty,
                totalCents: Math.round(purchaseItem.totalCents * itemRatio),
              },
            });
          }
        }
      }

      if (totalItemsReturnedCount === 0 && !isFullReturn) {
        throw new ConflictError('No matching products found in this purchase order to return');
      }

      // 2. Adjust Purchase totals
      const originalTotalCents = purchase.totalCents;
      const originalDueCents = purchase.dueCents;
      const newTotalCents = isFullReturn ? 0 : Math.max(0, originalTotalCents - returnedTotalCents);

      // Recalculate subtotal for partial return based on remaining items
      let newSubtotalCents = 0;
      if (!isFullReturn) {
        const remainingItems = await tx.purchaseItem.findMany({
          where: { purchaseId: purchase.id },
        });
        for (const item of remainingItems) {
          newSubtotalCents += item.totalCents;
        }
      }

      // paidCents adjusts based on supplier refund received
      const newPaidCents = Math.max(0, purchase.paidCents - returnData.refundAmountCents);
      const newDueCents = Math.max(0, newTotalCents - newPaidCents);

      // Determine final status
      let finalStatus: 'CANCELLED' | 'RECEIVED' = 'CANCELLED';
      if (!isFullReturn) {
        const remainingItemsCount = await tx.purchaseItem.count({
          where: { purchaseId: purchase.id },
        });
        if (remainingItemsCount > 0) {
          finalStatus = 'RECEIVED'; // Keep RECEIVED but adjusted
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
      const purchaseUpdateData: any = {
        status: finalStatus,
        subtotalCents: newSubtotalCents,
        totalCents: newTotalCents,
        paidCents: newPaidCents,
        dueCents: newDueCents,
        paymentStatus,
        notes: purchase.notes ? `${purchase.notes}${appendNotes}` : `Items returned.${appendNotes}`,
      };

      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: purchaseUpdateData,
        include: { items: true },
      });

      // 3. Create cash refund record (Payment RECEIVED) if refund is paid back by supplier
      if (returnData.refundAmountCents > 0) {
        await tx.payment.create({
          data: {
            shopId,
            type: 'RECEIVED', // money incoming to shop from supplier
            method: 'CASH', // default refund to Cash
            amountCents: returnData.refundAmountCents,
            payableType: 'purchase',
            payableId: purchase.id,
            notes: `Cash refund received for returned items on purchase PO ${purchase.referenceNumber}`,
            recordedBy: userId,
            purchaseId: purchase.id,
          },
        });
      }

      // 4. Update Supplier ledger stats & Khata adjustment
      if (purchase.supplierId) {
        const totalSuppliedDiff = originalTotalCents - newTotalCents;
        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: {
            totalSuppliedCents: { decrement: totalSuppliedDiff },
          },
        });

        // Debit the supplier's Khata if outstanding dues were reduced
        // Less dues = we owe them less, so balance increases towards 0 (+ve debit)
        const dueCentsDiff = originalDueCents - newDueCents;
        if (dueCentsDiff > 0) {
          const khata = await tx.khataAccount.findFirst({
            where: { shopId, partyType: 'SUPPLIER', partyId: purchase.supplierId },
          });

          if (khata) {
            const newBalance = khata.balanceCents + dueCentsDiff;
            await tx.khataAccount.update({
              where: { id: khata.id },
              data: { balanceCents: newBalance },
            });

            await tx.khataEntry.create({
              data: {
                shopId,
                khataAccountId: khata.id,
                type: 'DEBIT',
                amountCents: dueCentsDiff,
                runningBalanceCents: newBalance,
                description: `Credit adjust for return on purchase order ${purchase.referenceNumber}`,
                referenceType: 'purchase',
                referenceId: purchase.id,
                recordedBy: userId,
              },
            });
          }
        }
      }

      return updatedPurchase;
    });
  }

  // Find paginated KhataEntry history for a party
  async findLedgerEntries(
    shopId: string,
    partyType: 'CUSTOMER' | 'SUPPLIER',
    partyId: string,
    options: { limit: number; cursor?: string },
  ) {
    const khata = await this.prisma.khataAccount.findFirst({
      where: { shopId, partyType, partyId },
    });

    if (!khata) {
      return { data: [], total: 0 };
    }

    const whereClause = { shopId, khataAccountId: khata.id };
    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { entryDate: 'desc' },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.khataEntry.findMany(queryOptions),
      this.prisma.khataEntry.count({ where: whereClause }),
    ]);

    return { data, total };
  }
}
