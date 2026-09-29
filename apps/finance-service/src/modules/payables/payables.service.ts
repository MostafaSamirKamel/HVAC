import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { Money } from '@hvac/money';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { PayableModel, IPayable, PayableStatus } from './payable.model.js';

export interface CreatePayableInput {
  companyId: string;
  supplierId: string;
  vendorBillId: string;
  billNumber: string;
  amount: number | string;
  dueDate: Date;
}

export interface PayablesAgingSummary {
  totalPayables: number;
  current: number; // Not yet due
  days1To30: number;
  days31To60: number;
  days61To90: number;
  daysOver90: number;
  count: number;
}

export class PayablesService {
  public static async createPayable(
    input: CreatePayableInput,
    session?: ClientSession
  ): Promise<IPayable> {
    const amountMoney = Money.from(input.amount, 'EGP');
    const payableId = randomUUID();

    const [payable] = await PayableModel.create(
      [
        {
          companyId: input.companyId,
          payableId,
          supplierId: input.supplierId,
          vendorBillId: input.vendorBillId,
          billNumber: input.billNumber,
          originalAmount: mongoose.Types.Decimal128.fromString(amountMoney.toFixed(2)),
          paidAmount: mongoose.Types.Decimal128.fromString('0.00'),
          remainingAmount: mongoose.Types.Decimal128.fromString(amountMoney.toFixed(2)),
          dueDate: input.dueDate,
          status: 'OUTSTANDING',
        },
      ],
      { session }
    );

    return payable;
  }

  public static async applyPayment(
    companyId: string,
    vendorBillId: string,
    paymentAmount: number | string,
    session?: ClientSession
  ): Promise<IPayable> {
    const query = PayableModel.findOne({ companyId, vendorBillId });
    const payable = session ? await query.session(session) : await query;

    if (!payable) {
      throw new NotFoundError(`Payable for bill ${vendorBillId} not found`);
    }

    const payMoney = Money.from(paymentAmount, 'EGP');
    const remainingMoney = Money.from(payable.remainingAmount.toString(), 'EGP');
    const paidMoney = Money.from(payable.paidAmount.toString(), 'EGP');

    if (payMoney.isGreaterThan(remainingMoney)) {
      throw new ValidationError(
        `Payment ${payMoney.toFixed(2)} exceeds remaining balance ${remainingMoney.toFixed(2)}`
      );
    }

    const newPaid = paidMoney.add(payMoney);
    const newRemaining = remainingMoney.subtract(payMoney);

    payable.paidAmount = mongoose.Types.Decimal128.fromString(newPaid.toFixed(2));
    payable.remainingAmount = mongoose.Types.Decimal128.fromString(newRemaining.toFixed(2));
    payable.status = newRemaining.isZero() ? 'PAID' : 'PARTIALLY_PAID';

    await payable.save({ session });
    return payable;
  }

  public static async getAgingSummary(
    companyId: string,
    supplierId?: string
  ): Promise<PayablesAgingSummary> {
    const query: Record<string, unknown> = {
      companyId,
      status: { $in: ['OUTSTANDING', 'PARTIALLY_PAID', 'OVERDUE'] },
    };
    if (supplierId) query.supplierId = supplierId;

    const outstanding = await PayableModel.find(query);
    const now = new Date();

    let totalMoney = Money.from(0, 'EGP');
    let currentMoney = Money.from(0, 'EGP');
    let d1To30Money = Money.from(0, 'EGP');
    let d31To60Money = Money.from(0, 'EGP');
    let d61To90Money = Money.from(0, 'EGP');
    let dOver90Money = Money.from(0, 'EGP');

    for (const pay of outstanding) {
      const rem = Money.from(pay.remainingAmount.toString(), 'EGP');
      totalMoney = totalMoney.add(rem);

      const daysDiff = Math.floor((now.getTime() - pay.dueDate.getTime()) / (1000 * 60 * 60 * 24));

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
      totalPayables: totalMoney.toNumber(),
      current: currentMoney.toNumber(),
      days1To30: d1To30Money.toNumber(),
      days31To60: d31To60Money.toNumber(),
      days61To90: d61To90Money.toNumber(),
      daysOver90: dOver90Money.toNumber(),
      count: outstanding.length,
    };
  }

  public static async listPayables(
    companyId: string,
    filter: { supplierId?: string; status?: PayableStatus } = {}
  ): Promise<IPayable[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.supplierId) query.supplierId = filter.supplierId;
    if (filter.status) query.status = filter.status;

    return PayableModel.find(query).sort({ dueDate: 1 });
  }
}
