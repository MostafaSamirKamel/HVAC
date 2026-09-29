import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { ConflictError, NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { CustomerCreatedEvent, CustomerCreditLimitUpdatedEvent } from '@hvac/event-contracts';
import { CustomerModel, ICustomer, CustomerType } from './customer.model.js';
import { CustomerAddressModel, ICustomerAddress } from '../customer-addresses/customer-address.model.js';

export interface CreateCustomerInput {
  companyId: string;
  name: string;
  type?: CustomerType;
  nationalId?: string;
  taxNumber?: string;
  commercialRegister?: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  branchId: string;
  creditLimit?: number | string;
  tags?: string[];
  initialAddress?: {
    title: string;
    governorate: string;
    city: string;
    street: string;
    buildingNumber?: string;
    floor?: string;
    apartment?: string;
    landmark?: string;
  };
}

export interface AddAddressInput {
  companyId: string;
  customerId: string;
  title: string;
  governorate: string;
  city: string;
  street: string;
  buildingNumber?: string;
  floor?: string;
  apartment?: string;
  landmark?: string;
  isDefault?: boolean;
}

export class CustomerService {
  public static async createCustomer(
    input: CreateCustomerInput,
    existingSession?: ClientSession
  ): Promise<ICustomer> {
    const runner = async (session: ClientSession) => {
      const existingPhone = await CustomerModel.findOne({
        companyId: input.companyId,
        phone: input.phone,
      }).session(session);

      if (existingPhone) {
        throw new ConflictError(`Customer with phone number ${input.phone} already exists`);
      }

      const customerId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const customerNumber = `CUST-${new Date().getFullYear()}-${randomSuffix}`;
      const creditLimitMoney = Money.from(input.creditLimit || 0, 'EGP');

      const [customer] = await CustomerModel.create(
        [
          {
            companyId: input.companyId,
            customerId,
            customerNumber,
            name: input.name,
            type: input.type || 'INDIVIDUAL',
            nationalId: input.nationalId,
            taxNumber: input.taxNumber,
            commercialRegister: input.commercialRegister,
            phone: input.phone,
            secondaryPhone: input.secondaryPhone,
            email: input.email,
            branchId: input.branchId,
            creditLimit: mongoose.Types.Decimal128.fromString(creditLimitMoney.toFixed(2)),
            outstandingBalance: mongoose.Types.Decimal128.fromString('0.00'),
            isActive: true,
            tags: input.tags || [],
          },
        ],
        { session }
      );

      if (input.initialAddress) {
        await CustomerAddressModel.create(
          [
            {
              companyId: input.companyId,
              addressId: randomUUID(),
              customerId,
              title: input.initialAddress.title,
              governorate: input.initialAddress.governorate,
              city: input.initialAddress.city,
              street: input.initialAddress.street,
              buildingNumber: input.initialAddress.buildingNumber,
              floor: input.initialAddress.floor,
              apartment: input.initialAddress.apartment,
              landmark: input.initialAddress.landmark,
              isDefault: true,
            },
          ],
          { session }
        );
      }

      // Outbox Event
      const event = new CustomerCreatedEvent(
        {
          customerId,
          customerNumber,
          name: input.name,
          type: customer.type,
          phone: input.phone,
          creditLimit: creditLimitMoney.toNumber(),
          branchId: input.branchId,
        },
        {
          companyId: input.companyId,
          branchId: input.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return customer;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async updateCreditLimit(
    companyId: string,
    customerId: string,
    newLimit: number | string,
    reason?: string,
    existingSession?: ClientSession
  ): Promise<ICustomer> {
    const runner = async (session: ClientSession) => {
      const customer = await CustomerModel.findOne({ companyId, customerId }).session(session);
      if (!customer) {
        throw new NotFoundError(`Customer ${customerId} not found`);
      }

      const oldLimitMoney = Money.from(customer.creditLimit.toString(), 'EGP');
      const newLimitMoney = Money.from(newLimit, 'EGP');

      customer.creditLimit = mongoose.Types.Decimal128.fromString(newLimitMoney.toFixed(2));
      await customer.save({ session });

      const event = new CustomerCreditLimitUpdatedEvent(
        {
          customerId,
          oldLimit: oldLimitMoney.toNumber(),
          newLimit: newLimitMoney.toNumber(),
          reason,
          branchId: customer.branchId,
        },
        {
          companyId,
          branchId: customer.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return customer;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async verifyCreditLimit(
    companyId: string,
    customerId: string,
    orderAmount: number | string
  ): Promise<{ eligible: boolean; creditLimit: number; currentBalance: number; availableCredit: number }> {
    const customer = await CustomerModel.findOne({ companyId, customerId });
    if (!customer) {
      throw new NotFoundError(`Customer ${customerId} not found`);
    }

    const limitMoney = Money.from(customer.creditLimit.toString(), 'EGP');
    const balanceMoney = Money.from(customer.outstandingBalance.toString(), 'EGP');
    const amountMoney = Money.from(orderAmount, 'EGP');

    const availableCredit = limitMoney.subtract(balanceMoney);
    const eligible = availableCredit.isGreaterThan(amountMoney) || availableCredit.equals(amountMoney);

    return {
      eligible,
      creditLimit: limitMoney.toNumber(),
      currentBalance: balanceMoney.toNumber(),
      availableCredit: availableCredit.toNumber(),
    };
  }

  public static async addAddress(input: AddAddressInput): Promise<ICustomerAddress> {
    const customer = await CustomerModel.findOne({
      companyId: input.companyId,
      customerId: input.customerId,
    });
    if (!customer) {
      throw new NotFoundError(`Customer ${input.customerId} not found`);
    }

    const addressId = randomUUID();
    const [address] = await CustomerAddressModel.create([
      {
        companyId: input.companyId,
        addressId,
        customerId: input.customerId,
        title: input.title,
        governorate: input.governorate,
        city: input.city,
        street: input.street,
        buildingNumber: input.buildingNumber,
        floor: input.floor,
        apartment: input.apartment,
        landmark: input.landmark,
        isDefault: input.isDefault || false,
      },
    ]);

    return address;
  }

  public static async getCustomerById(companyId: string, customerId: string): Promise<ICustomer> {
    const customer = await CustomerModel.findOne({ companyId, customerId });
    if (!customer) {
      throw new NotFoundError(`Customer ${customerId} not found`);
    }
    return customer;
  }

  public static async listCustomers(
    companyId: string,
    filter: { branchId?: string; search?: string }
  ): Promise<ICustomer[]> {
    const query: Record<string, unknown> = { companyId, isActive: true };
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { phone: { $regex: filter.search, $options: 'i' } },
        { customerNumber: { $regex: filter.search, $options: 'i' } },
      ];
    }

    return CustomerModel.find(query).sort({ createdAt: -1 }).limit(100);
  }

  public static async getAddressesByCustomer(
    companyId: string,
    customerId: string
  ): Promise<ICustomerAddress[]> {
    return CustomerAddressModel.find({ companyId, customerId });
  }
}
