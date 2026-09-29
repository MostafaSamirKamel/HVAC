import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { ConflictError, NotFoundError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { SupplierModel, ISupplier } from './supplier.model.js';

export interface CreateSupplierInput {
  companyId: string;
  code: string;
  name: string;
  taxNumber?: string;
  commercialRegister?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  paymentTermsDays?: number;
  currency?: string;
  creditLimit?: number | string;
}

export class SupplierService {
  public static async createSupplier(
    input: CreateSupplierInput,
    session?: ClientSession
  ): Promise<ISupplier> {
    const query = SupplierModel.findOne({ companyId: input.companyId, code: input.code });
    const existing = session ? await query.session(session) : await query;

    if (existing) {
      throw new ConflictError(`Supplier with code ${input.code} already exists`);
    }

    const creditLimitMoney = Money.from(input.creditLimit || 0, input.currency || 'EGP');
    const supplierId = randomUUID();

    const [supplier] = await SupplierModel.create(
      [
        {
          companyId: input.companyId,
          supplierId,
          code: input.code,
          name: input.name,
          taxNumber: input.taxNumber,
          commercialRegister: input.commercialRegister,
          contactPerson: input.contactPerson,
          phone: input.phone,
          email: input.email,
          address: input.address,
          paymentTermsDays: input.paymentTermsDays || 30,
          currency: input.currency || 'EGP',
          creditLimit: mongoose.Types.Decimal128.fromString(creditLimitMoney.toFixed(2)),
          isActive: true,
        },
      ],
      { session }
    );

    return supplier;
  }

  public static async getSupplierById(companyId: string, supplierId: string): Promise<ISupplier> {
    const supplier = await SupplierModel.findOne({ companyId, supplierId });
    if (!supplier) {
      throw new NotFoundError(`Supplier ${supplierId} not found`);
    }
    return supplier;
  }

  public static async listSuppliers(companyId: string): Promise<ISupplier[]> {
    return SupplierModel.find({ companyId, isActive: true }).sort({ name: 1 });
  }
}
