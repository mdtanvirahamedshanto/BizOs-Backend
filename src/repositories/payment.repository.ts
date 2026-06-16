import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { CashbookRepository } from './cashbook.repository';
import { KhataRepository } from './khata.repository';

export class PaymentRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(shopId: string, id: string) {
    return this.prisma.payment.findFirst({
      where: { id, shopId },
      include: {
        recorder: { select: { id: true, name: true } },
      },
    });
  }

  async findAndCountPayments(
    shopId: string,
    options: {
      payableType?: 'sale' | 'purchase' | 'khata';
      payableId?: string;
      type?: 'RECEIVED' | 'MADE';
      method?: 'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK' | 'CARD' | 'CHECK' | 'OTHER';
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const whereClause: any = { shopId };

    if (options.payableType) {
      whereClause.payableType = options.payableType;
    }

    if (options.payableId) {
      whereClause.payableId = options.payableId;
    }

    if (options.type) {
      whereClause.type = options.type;
    }

    if (options.method) {
      whereClause.method = options.method;
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'createdAt']: options.sortOrder || 'desc' },
      include: {
        recorder: { select: { name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany(queryOptions),
      this.prisma.payment.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async createPayment(
    shopId: string,
    userId: string,
    data: {
      payableType: 'sale' | 'purchase' | 'khata';
      payableId: string;
      amountCents: number;
      method: 'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK' | 'CARD' | 'CHECK' | 'OTHER';
      reference: string | null;
      notes: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // ==========================================
      // 1. PAYMENT AGAINST A SALE
      // ==========================================
      if (data.payableType === 'sale') {
        const sale = await tx.sale.findFirst({
          where: { id: data.payableId, shopId, deletedAt: null },
        });

        if (!sale) {
          throw new NotFoundError('Sale');
        }

        if (sale.status === 'RETURNED' || sale.status === 'VOID') {
          throw new ConflictError('Cannot record payment against a returned or voided sale');
        }

        if (data.amountCents > sale.dueCents) {
          throw new ConflictError(
            `Payment amount (${data.amountCents}) exceeds the outstanding due (${sale.dueCents})`,
          );
        }

        const newPaidCents = sale.paidCents + data.amountCents;
        const newDueCents = sale.dueCents - data.amountCents;

        let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' = 'UNPAID';
        if (newDueCents === 0) {
          paymentStatus = 'PAID';
        } else if (newPaidCents === 0) {
          paymentStatus = 'UNPAID';
        } else {
          paymentStatus = 'PARTIAL';
        }

        // Update Sale
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidCents: newPaidCents,
            dueCents: newDueCents,
            paymentStatus,
          },
        });

        // Create Payment record
        const payment = await tx.payment.create({
          data: {
            shopId,
            type: 'RECEIVED',
            method: data.method,
            amountCents: data.amountCents,
            payableType: 'sale',
            payableId: sale.id,
            reference: data.reference,
            notes: data.notes || 'Payment recorded against outstanding sale dues',
            recordedBy: userId,
            saleId: sale.id,
          },
        });

        // Log to Cashbook if method is CASH
        if (data.method === 'CASH') {
          await CashbookRepository.recordEntry(tx, shopId, {
            type: 'IN',
            amountCents: data.amountCents,
            description: `Payment received for Invoice ${sale.invoiceNumber}`,
            referenceType: 'payment',
            referenceId: payment.id,
            recordedBy: userId,
          });
        }

        // Adjust Customer Khata ledger
        if (sale.customerId) {
          let khata = await tx.khataAccount.findFirst({
            where: { shopId, partyType: 'CUSTOMER', partyId: sale.customerId },
          });

          if (!khata) {
            khata = await tx.khataAccount.create({
              data: {
                shopId,
                partyType: 'CUSTOMER',
                partyId: sale.customerId,
                balanceCents: 0,
                creditLimitCents: 0,
              },
            });
          }

          const newBalance = khata.balanceCents - data.amountCents;

          await tx.khataAccount.update({
            where: { id: khata.id },
            data: { balanceCents: newBalance },
          });

          await tx.khataEntry.create({
            data: {
              shopId,
              khataAccountId: khata.id,
              type: 'CREDIT',
              amountCents: data.amountCents,
              runningBalanceCents: newBalance,
              description: `Payment against Invoice ${sale.invoiceNumber}`,
              referenceType: 'payment',
              referenceId: payment.id,
              recordedBy: userId,
            },
          });
        }

        return payment;
      }

      // ==========================================
      // 2. PAYMENT AGAINST A PURCHASE
      // ==========================================
      if (data.payableType === 'purchase') {
        const purchase = await tx.purchase.findFirst({
          where: { id: data.payableId, shopId, deletedAt: null },
        });

        if (!purchase) {
          throw new NotFoundError('Purchase');
        }

        if (purchase.status === 'CANCELLED') {
          throw new ConflictError('Cannot record payment against a cancelled purchase');
        }

        if (data.amountCents > purchase.dueCents) {
          throw new ConflictError(
            `Payment amount (${data.amountCents}) exceeds the outstanding due (${purchase.dueCents})`,
          );
        }

        const newPaidCents = purchase.paidCents + data.amountCents;
        const newDueCents = purchase.dueCents - data.amountCents;

        let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' = 'UNPAID';
        if (newDueCents === 0) {
          paymentStatus = 'PAID';
        } else if (newPaidCents === 0) {
          paymentStatus = 'UNPAID';
        } else {
          paymentStatus = 'PARTIAL';
        }

        // Update Purchase
        await tx.purchase.update({
          where: { id: purchase.id },
          data: {
            paidCents: newPaidCents,
            dueCents: newDueCents,
            paymentStatus,
          },
        });

        // Create Payment record (MADE type since shop is paying supplier)
        const payment = await tx.payment.create({
          data: {
            shopId,
            type: 'MADE',
            method: data.method,
            amountCents: data.amountCents,
            payableType: 'purchase',
            payableId: purchase.id,
            reference: data.reference,
            notes: data.notes || 'Payment recorded against purchase order dues',
            recordedBy: userId,
            purchaseId: purchase.id,
          },
        });

        // Log to Cashbook if method is CASH
        if (data.method === 'CASH') {
          await CashbookRepository.recordEntry(tx, shopId, {
            type: 'OUT',
            amountCents: data.amountCents,
            description: `Payout made for Purchase Order ${purchase.referenceNumber}`,
            referenceType: 'payment',
            referenceId: payment.id,
            recordedBy: userId,
          });
        }

        // Adjust Supplier Khata ledger
        if (purchase.supplierId) {
          let khata = await tx.khataAccount.findFirst({
            where: { shopId, partyType: 'SUPPLIER', partyId: purchase.supplierId },
          });

          if (!khata) {
            khata = await tx.khataAccount.create({
              data: {
                shopId,
                partyType: 'SUPPLIER',
                partyId: purchase.supplierId,
                balanceCents: 0,
                creditLimitCents: 0,
              },
            });
          }

          // Balance semantics: -ve = shop owes the party (payable).
          // Shop paying supplier reduces the payable balance (-ve -> 0, so increment balanceCents towards 0)
          const newBalance = khata.balanceCents + data.amountCents;

          await tx.khataAccount.update({
            where: { id: khata.id },
            data: { balanceCents: newBalance },
          });

          await tx.khataEntry.create({
            data: {
              shopId,
              khataAccountId: khata.id,
              type: 'DEBIT',
              amountCents: data.amountCents,
              runningBalanceCents: newBalance,
              description: `Payment for Purchase Ref ${purchase.referenceNumber}`,
              referenceType: 'payment',
              referenceId: payment.id,
              recordedBy: userId,
            },
          });
        }

        return payment;
      }

      // ==========================================
      // 3. DIRECT PAYMENT POSTED TO KHATA
      // ==========================================
      if (data.payableType === 'khata') {
        const khataRepo = new KhataRepository(tx);
        const result = await khataRepo.recordKhataPayment(tx, shopId, data.payableId, userId, {
          amountCents: data.amountCents,
          method: data.method,
          reference: data.reference,
          notes: data.notes,
        });
        return result.payment;
      }

      throw new ConflictError('Invalid payable type specified');
    });
  }

  async refundPayment(shopId: string, paymentId: string, userId: string, notes: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, shopId },
      });

      if (!payment) {
        throw new NotFoundError('Payment');
      }

      // Check if refund already exists
      const existingRefund = await tx.payment.findFirst({
        where: {
          shopId,
          notes: { contains: `Refund for payment: ${paymentId}` },
        },
      });

      if (existingRefund) {
        throw new ConflictError('This payment transaction has already been refunded');
      }

      const isReceived = payment.type === 'RECEIVED';
      const refundType = isReceived ? 'MADE' : 'RECEIVED';
      const refundNotes = `Refund for payment: ${paymentId}. ${notes || ''}`;

      // Create refund Payment record
      const refundPayment = await tx.payment.create({
        data: {
          shopId,
          type: refundType,
          method: 'CASH', // default refunds to cash
          amountCents: payment.amountCents,
          payableType: payment.payableType,
          payableId: payment.payableId,
          notes: refundNotes,
          recordedBy: userId,
          saleId: payment.saleId,
          purchaseId: payment.purchaseId,
        },
      });

      // Log refund to Cashbook (refunds default to method: CASH)
      await CashbookRepository.recordEntry(tx, shopId, {
        type: isReceived ? 'OUT' : 'IN',
        amountCents: payment.amountCents,
        description: `Refund for payment transaction ${paymentId}`,
        referenceType: 'payment',
        referenceId: refundPayment.id,
        recordedBy: userId,
      });

      // ==========================================
      // 1. REVERSING SALE PAYMENT
      // ==========================================
      if (payment.payableType === 'sale' && payment.saleId) {
        const sale = await tx.sale.findFirst({
          where: { id: payment.saleId, shopId },
        });

        if (sale) {
          const newPaidCents = Math.max(0, sale.paidCents - payment.amountCents);
          const newDueCents = sale.dueCents + payment.amountCents;

          let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' = 'UNPAID';
          if (newDueCents === 0) {
            paymentStatus = 'PAID';
          } else if (newPaidCents === 0) {
            paymentStatus = 'UNPAID';
          } else {
            paymentStatus = 'PARTIAL';
          }

          // Adjust Sale
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              paidCents: newPaidCents,
              dueCents: newDueCents,
              paymentStatus,
            },
          });

          // Adjust Customer Khata (Customer owes shop again, so debit balance (+ve))
          if (sale.customerId) {
            const khata = await tx.khataAccount.findFirst({
              where: { shopId, partyType: 'CUSTOMER', partyId: sale.customerId },
            });

            if (khata) {
              const newBalance = khata.balanceCents + payment.amountCents;

              await tx.khataAccount.update({
                where: { id: khata.id },
                data: { balanceCents: newBalance },
              });

              await tx.khataEntry.create({
                data: {
                  shopId,
                  khataAccountId: khata.id,
                  type: 'DEBIT',
                  amountCents: payment.amountCents,
                  runningBalanceCents: newBalance,
                  description: `Refund adjust for payment ${paymentId}`,
                  referenceType: 'payment',
                  referenceId: refundPayment.id,
                  recordedBy: userId,
                },
              });
            }
          }
        }
      }

      // ==========================================
      // 2. REVERSING PURCHASE PAYMENT
      // ==========================================
      if (payment.payableType === 'purchase' && payment.purchaseId) {
        const purchase = await tx.purchase.findFirst({
          where: { id: payment.purchaseId, shopId },
        });

        if (purchase) {
          const newPaidCents = Math.max(0, purchase.paidCents - payment.amountCents);
          const newDueCents = purchase.dueCents + payment.amountCents;

          let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' = 'UNPAID';
          if (newDueCents === 0) {
            paymentStatus = 'PAID';
          } else if (newPaidCents === 0) {
            paymentStatus = 'UNPAID';
          } else {
            paymentStatus = 'PARTIAL';
          }

          // Adjust Purchase
          await tx.purchase.update({
            where: { id: purchase.id },
            data: {
              paidCents: newPaidCents,
              dueCents: newDueCents,
              paymentStatus,
            },
          });

          // Adjust Supplier Khata (Shop owes supplier again, so credit balance (-ve))
          if (purchase.supplierId) {
            const khata = await tx.khataAccount.findFirst({
              where: { shopId, partyType: 'SUPPLIER', partyId: purchase.supplierId },
            });

            if (khata) {
              const newBalance = khata.balanceCents - payment.amountCents;

              await tx.khataAccount.update({
                where: { id: khata.id },
                data: { balanceCents: newBalance },
              });

              await tx.khataEntry.create({
                data: {
                  shopId,
                  khataAccountId: khata.id,
                  type: 'CREDIT',
                  amountCents: payment.amountCents,
                  runningBalanceCents: newBalance,
                  description: `Refund adjust for payment ${paymentId}`,
                  referenceType: 'payment',
                  referenceId: refundPayment.id,
                  recordedBy: userId,
                },
              });
            }
          }
        }
      }

      // ==========================================
      // 3. REVERSING DIRECT KHATA PAYMENT
      // ==========================================
      if (payment.payableType === 'khata') {
        const khata = await tx.khataAccount.findFirst({
          where: { id: payment.payableId, shopId },
        });

        if (khata) {
          const isCustomer = khata.partyType === 'CUSTOMER';

          // Revert balance:
          // If customer: add refund amount back (+ve)
          // If supplier: subtract refund amount back (-ve)
          const newBalance = isCustomer
            ? khata.balanceCents + payment.amountCents
            : khata.balanceCents - payment.amountCents;

          const khataEntryType = isCustomer ? 'DEBIT' : 'CREDIT';

          await tx.khataAccount.update({
            where: { id: khata.id },
            data: { balanceCents: newBalance },
          });

          await tx.khataEntry.create({
            data: {
              shopId,
              khataAccountId: khata.id,
              type: khataEntryType,
              amountCents: payment.amountCents,
              runningBalanceCents: newBalance,
              description: `Refund adjust for payment ${paymentId}`,
              referenceType: 'payment',
              referenceId: refundPayment.id,
              recordedBy: userId,
            },
          });
        }
      }

      return refundPayment;
    });
  }
}
