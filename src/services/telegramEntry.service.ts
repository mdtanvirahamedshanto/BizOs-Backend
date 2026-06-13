import { CustomerRepository } from '@/repositories/customer.repository';
import { KhataRepository } from '@/repositories/khata.repository';
import { SalesRepository } from '@/repositories/sales.repository';
import { ProductRepository } from '@/repositories/product.repository';
import { ExpenseRepository } from '@/repositories/expense.repository';
import { khataEvents } from '@/events/khata.events';
import { salesEvents } from '@/events/sales.events';
import { expenseEvents } from '@/events/expense.events';
import type { ParsedEntry } from '@/bot/nlp/parser';
import { ConflictError } from '@/utils/errors';

export interface EntryResult {
  type: ParsedEntry['type'];
  message: string;
  data: Record<string, unknown>;
}

function formatBdt(cents: number): string {
  return `৳${(cents / 100).toFixed(2)}`;
}

export class TelegramEntryService {
  constructor(
    private customerRepo: CustomerRepository,
    private khataRepo: KhataRepository,
    private salesRepo: SalesRepository,
    private productRepo: ProductRepository,
    private expenseRepo: ExpenseRepository,
  ) {}

  async processEntry(shopId: string, userId: string, entry: ParsedEntry): Promise<EntryResult> {
    switch (entry.type) {
      case 'customer_due':
        return this.recordCustomerDue(shopId, userId, entry.customerName!, entry.amountCents, entry.raw);
      case 'sale':
        return this.recordQuickSale(shopId, userId, entry.amountCents, entry.raw);
      case 'expense':
        return this.recordExpense(shopId, userId, entry.amountCents, entry.title!, entry.raw);
      default:
        throw new ConflictError('Unsupported entry type');
    }
  }

  private async recordCustomerDue(
    shopId: string,
    userId: string,
    customerName: string,
    amountCents: number,
    raw: string,
  ): Promise<EntryResult> {
    let customer = await this.customerRepo.findBestMatchByName(shopId, customerName);
    let createdCustomer = false;

    if (!customer) {
      customer = await this.customerRepo.create(shopId, { name: customerName });
      createdCustomer = true;
    }

    const account = await this.khataRepo.findOrCreateCustomerAccount(shopId, customer.id);
    const result = await this.khataRepo.recordAdjustment(shopId, account.id, userId, {
      type: 'DEBIT',
      amountCents,
      description: `Telegram: ${raw}`,
    });

    khataEvents.entryAdded({
      shopId,
      khataAccountId: account.id,
      entryId: result.entry.id,
      amountCents,
      type: 'DEBIT',
    });

    return {
      type: 'customer_due',
      message: `${createdCustomer ? 'Created customer and recorded' : 'Recorded'} ${formatBdt(amountCents)} due for ${customer.name}. New balance: ${formatBdt(result.account.balanceCents)}.`,
      data: {
        customerId: customer.id,
        customerName: customer.name,
        khataAccountId: account.id,
        balanceCents: result.account.balanceCents,
      },
    };
  }

  private async recordQuickSale(
    shopId: string,
    userId: string,
    amountCents: number,
    raw: string,
  ): Promise<EntryResult> {
    const product = await this.productRepo.findOrCreateQuickSaleProduct(shopId);
    const invoiceNumber = await this.salesRepo.generateNextInvoiceNumber(shopId);

    const sale = await this.salesRepo.createSale(shopId, userId, invoiceNumber, {
      customerId: null,
      saleDate: new Date(),
      status: 'COMPLETED',
      subtotalCents: amountCents,
      discountType: null,
      discountValue: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: amountCents,
      paidCents: amountCents,
      dueCents: 0,
      paymentStatus: 'PAID',
      notes: `Telegram: ${raw}`,
      items: [
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPriceCents: amountCents,
          discountCents: 0,
          taxCents: 0,
          totalCents: amountCents,
        },
      ],
      payment: {
        amountCents,
        method: 'CASH',
        reference: null,
      },
    });

    salesEvents.created({
      shopId,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      totalCents: sale.totalCents,
    });
    salesEvents.completed({
      shopId,
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      totalCents: sale.totalCents,
    });

    return {
      type: 'sale',
      message: `Sale recorded: ${formatBdt(amountCents)} (${sale.invoiceNumber}).`,
      data: {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        totalCents: sale.totalCents,
      },
    };
  }

  private async recordExpense(
    shopId: string,
    userId: string,
    amountCents: number,
    title: string,
    raw: string,
  ): Promise<EntryResult> {
    const expense = await this.expenseRepo.createExpense(shopId, userId, {
      title,
      amountCents,
      paymentMethod: 'CASH',
      description: `Telegram: ${raw}`,
    });

    expenseEvents.created({
      shopId,
      expenseId: expense.id,
      amountCents: expense.amountCents,
      title: expense.title,
    });

    return {
      type: 'expense',
      message: `Expense recorded: ${title} — ${formatBdt(amountCents)}.`,
      data: {
        expenseId: expense.id,
        title: expense.title,
        amountCents: expense.amountCents,
      },
    };
  }
}
