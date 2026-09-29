import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { Money } from '@hvac/money';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { ReceivableModel, IReceivable, ReceivableStatus } from './receivable.model.js';

export interface CreateReceivableInput {
  companyId: string;
  customerId: string;
  orderId?: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number | string;
  dueDate: Date;
}

export interface ReceivablesAgingSummary {
  totalReceivables: number;
  current: number; // Not yet due
  days1To30: number;
  days31To60: number;
  days61To90: number;
  daysOver90: number;
  count: number;
}

export class ReceivablesService {
  public static async createReceivable(
    input: CreateReceivableInput,
    session?: ClientSession
  ): Promise<IReceivable> {
    const amountMoney = Money.from(input.amount, 'EGP');
    const receivableId = randomUUID();

    const [receivable] = await ReceivableModel.create(
      [
        {
          companyId: input.companyId,
          receivableId,
          customerId: input.customerId,
          orderId: input.orderId,
          invoiceId: input.invoiceId,
          invoiceNumber: input.invoiceNumber,
          originalAmount: mongoose.Types.Decimal128.fromString(amountMoney.toFixed(2)),
          paidAmount: mongoose.Types.Decimal128.fromString('0.00'),
          remainingAmount: mongoose.Types.Decimal128.fromString(amountMoney.toFixed(2)),
          dueDate: input.dueDate,
          status: 'OUTSTANDING',
        },
      ],
      { session }
    );

    return receivable;
  }

  public static async applyPayment(
    companyId: string,
    invoiceId: string,
    paymentAmount: number | string,
    session?: ClientSession
  ): Promise<IReceivable> {
    const query = ReceivableModel.findOne({ companyId, invoiceId });
    const receivable = session ? await query.session(session) : await query;

    if (!receivable) {
      throw new NotFoundError(`Receivable for invoice ${invoiceId} not found`);
    }

    const payMoney = Money.from(paymentAmount, 'EGP');
    const remainingMoney = Money.from(receivable.remainingAmount.toString(), 'EGP');
    const paidMoney = Money.from(receivable.paidAmount.toString(), 'EGP');

    if (payMoney.isGreaterThan(remainingMoney)) {
      throw new ValidationError(
        `Payment ${payMoney.toFixed(2)} exceeds remaining balance ${remainingMoney.toFixed(2)}`
      );
    }

    const newPaid = paidMoney.add(payMoney);
    const newRemaining = remainingMoney.subtract(payMoney);

    receivable.paidAmount = mongoose.Types.Decimal128.fromString(newPaid.toFixed(2));
    receivable.remainingAmount = mongoose.Types.Decimal128.fromString(newRemaining.toFixed(2));
    receivable.status = newRemaining.isZero() ? 'PAID' : 'PARTIALLY_PAID';

    await receivable.save({ session });
    return receivable;
  }

  public static async getAgingSummary(
    companyId: string,
    customerId?: string
  ): Promise<ReceivablesAgingSummary> {
    const query: Record<string, unknown> = {
      companyId,
      status: { $in: ['OUTSTANDING', 'PARTIALLY_PAID', 'OVERDUE'] },
    };
    if (customerId) query.customerId = customerId;

    const outstanding = await ReceivableModel.find(query);
    const now = new Date();

    let totalMoney = Money.from(0, 'EGP');
    let currentMoney = Money.from(0, 'EGP');
    let d1To30Money = Money.from(0, 'EGP');
    let d31To60Money = Money.from(0, 'EGP');
    let d61To90Money = Money.from(0, 'EGP');
    let dOver90Money = Money.from(0, 'EGP');

    for (const rec of outstanding) {
      const rem = Money.from(rec.remainingAmount.toString(), 'EGP');
      totalMoney = totalMoney.add(rem);

      const daysDiff = Math.floor((now.getTime() - rec.dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 0) {
        currentMoney = currentMoney.add(rem);
      } else if (daysDiff <= 30) {
        d1To30Money = d1To30Money.add(rem);
      } else if (daysDiff <= 60) {
        d31To60Money = d31To60Money.add(rem);
      } else if (daysDiff <= 90) {
        d61To90Money = d61To90Money.add(rem);
      } else {
        dOver90Money = dOver90Money.add(rem);
      }
    }

    return {
      totalReceivables: totalMoney.toNumber(),
      current: currentMoney.toNumber(),
      days1To30: d1To30Money.toNumber(),
      days31To60: d31To60Money.toNumber(),
      days61To90: d61To90Money.toNumber(),
      daysOver90: dOver90Money.toNumber(),
      count: outstanding.length,
    };
  }

  public static async listReceivables(
    companyId: string,
    filter: { customerId?: string; status?: ReceivableStatus } = {}
  ): Promise<IReceivable[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.customerId) query.customerId = filter.customerId;
    if (filter.status) query.status = filter.status;

    return ReceivableModel.find(query).sort({ dueDate: 1 });
  }
}
