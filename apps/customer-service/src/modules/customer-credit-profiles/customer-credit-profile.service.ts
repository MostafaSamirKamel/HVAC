import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import {
  CustomerCreditLimitUpdatedEvent,
  CustomerCreditBlockedEvent,
} from '@hvac/event-contracts';
import {
  CustomerCreditProfileModel,
  ICustomerCreditProfile,
  CreditRating,
  CreditStatus,
} from './customer-credit-profile.model.js';
import { CustomerModel } from '../customers/customer.model.js';

export interface UpsertCreditProfileInput {
  companyId: string;
  customerId: string;
  creditRating?: CreditRating;
  approvedCreditLimit: number | string;
  paymentTermsDays?: number;
  guarantees?: {
    bankGuarantee?: boolean;
    chequeSecurity?: boolean;
    promissoryNote?: boolean;
  };
  riskNotes?: string;
  reviewedBy: string;
}

export class CustomerCreditProfileService {
  public static async upsertProfile(
    input: UpsertCreditProfileInput,
    existingSession?: ClientSession
  ): Promise<ICustomerCreditProfile> {
    const runner = async (session: ClientSession) => {
      const customer = await CustomerModel.findOne({
        companyId: input.companyId,
        customerId: input.customerId,
      }).session(session);

      if (!customer) {
        throw new NotFoundError(`Customer ${input.customerId} not found`);
      }

      const newLimitMoney = Money.from(input.approvedCreditLimit, 'EGP');
      const oldLimitMoney = Money.from(customer.creditLimit.toString(), 'EGP');

      let profile = await CustomerCreditProfileModel.findOne({
        companyId: input.companyId,
        customerId: input.customerId,
      }).session(session);

      if (!profile) {
        const [created] = await CustomerCreditProfileModel.create(
          [
            {
              companyId: input.companyId,
              customerId: input.customerId,
              creditRating: input.creditRating || 'B',
              creditStatus: 'ACTIVE',
              approvedCreditLimit: mongoose.Types.Decimal128.fromString(newLimitMoney.toFixed(2)),
              usedCredit: mongoose.Types.Decimal128.fromString('0.00'),
              paymentTermsDays: input.paymentTermsDays || 30,
              guarantees: {
                bankGuarantee: input.guarantees?.bankGuarantee || false,
                chequeSecurity: input.guarantees?.chequeSecurity || false,
                promissoryNote: input.guarantees?.promissoryNote || false,
              },
              lastReviewDate: new Date(),
              reviewedBy: input.reviewedBy,
              riskNotes: input.riskNotes,
            },
          ],
          { session }
        );
        profile = created;
      } else {
        if (input.creditRating) profile.creditRating = input.creditRating;
        profile.approvedCreditLimit = mongoose.Types.Decimal128.fromString(newLimitMoney.toFixed(2));
        if (input.paymentTermsDays) profile.paymentTermsDays = input.paymentTermsDays;
        if (input.guarantees) {
          profile.guarantees = {
            bankGuarantee: input.guarantees.bankGuarantee ?? profile.guarantees.bankGuarantee,
            chequeSecurity: input.guarantees.chequeSecurity ?? profile.guarantees.chequeSecurity,
            promissoryNote: input.guarantees.promissoryNote ?? profile.guarantees.promissoryNote,
          };
        }
        profile.lastReviewDate = new Date();
        profile.reviewedBy = input.reviewedBy;
        if (input.riskNotes) profile.riskNotes = input.riskNotes;
        await profile.save({ session });
      }

      // Sync customer core creditLimit
      customer.creditLimit = profile.approvedCreditLimit;
      await customer.save({ session });

      if (!oldLimitMoney.equals(newLimitMoney)) {
        const event = new CustomerCreditLimitUpdatedEvent(
          {
            customerId: customer.customerId,
            oldLimit: oldLimitMoney.toNumber(),
            newLimit: newLimitMoney.toNumber(),
            reason: input.riskNotes || 'Credit profile review',
            branchId: customer.branchId,
          },
          {
            companyId: input.companyId,
            branchId: customer.branchId,
            correlationId: randomUUID(),
            causationId: randomUUID(),
          }
        );
        await OutboxRepository.recordEvent(event, session);
      }

      return profile;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async blockCredit(
    companyId: string,
    customerId: string,
    reason: string,
    blockedBy: string,
    existingSession?: ClientSession
  ): Promise<ICustomerCreditProfile> {
    const runner = async (session: ClientSession) => {
      const customer = await CustomerModel.findOne({ companyId, customerId }).session(session);
      if (!customer) {
        throw new NotFoundError(`Customer ${customerId} not found`);
      }

      let profile = await CustomerCreditProfileModel.findOne({ companyId, customerId }).session(
        session
      );
      if (!profile) {
        const [created] = await CustomerCreditProfileModel.create(
          [
            {
              companyId,
              customerId,
              creditRating: 'D',
              creditStatus: 'BLOCKED',
              approvedCreditLimit: customer.creditLimit,
              usedCredit: customer.outstandingBalance,
              paymentTermsDays: 0,
              blockReason: reason,
              blockedAt: new Date(),
              blockedBy,
            },
          ],
          { session }
        );
        profile = created;
      } else {
        profile.creditStatus = 'BLOCKED';
        profile.blockReason = reason;
        profile.blockedAt = new Date();
        profile.blockedBy = blockedBy;
        await profile.save({ session });
      }

      const event = new CustomerCreditBlockedEvent(
        {
          customerId,
          creditStatus: 'BLOCKED',
          reason,
          blockedBy,
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

      return profile;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async unblockCredit(
    companyId: string,
    customerId: string,
    _unblockedBy: string,
    existingSession?: ClientSession
  ): Promise<ICustomerCreditProfile> {
    const runner = async (session: ClientSession) => {
      const profile = await CustomerCreditProfileModel.findOne({ companyId, customerId }).session(
        session
      );
      if (!profile) {
        throw new NotFoundError(`Credit profile for customer ${customerId} not found`);
      }

      profile.creditStatus = 'ACTIVE';
      profile.blockReason = undefined;
      profile.blockedAt = undefined;
      profile.blockedBy = undefined;
      await profile.save({ session });

      return profile;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async evaluateCreditEligibility(
    companyId: string,
    customerId: string,
    requestedAmount: number | string
  ): Promise<{
    eligible: boolean;
    creditStatus: CreditStatus;
    creditRating: CreditRating;
    approvedLimit: number;
    usedCredit: number;
    availableCredit: number;
    blockReason?: string;
  }> {
    const profile = await CustomerCreditProfileModel.findOne({ companyId, customerId });
    const customer = await CustomerModel.findOne({ companyId, customerId });

    if (!customer) {
      throw new NotFoundError(`Customer ${customerId} not found`);
    }

    const creditStatus = profile ? profile.creditStatus : 'ACTIVE';
    const creditRating = profile ? profile.creditRating : 'B';
    const limitMoney = profile
      ? Money.from(profile.approvedCreditLimit.toString(), 'EGP')
      : Money.from(customer.creditLimit.toString(), 'EGP');

    const usedMoney = profile
      ? Money.from(profile.usedCredit.toString(), 'EGP')
      : Money.from(customer.outstandingBalance.toString(), 'EGP');

    const availableCredit = limitMoney.subtract(usedMoney);
    const amountMoney = Money.from(requestedAmount, 'EGP');

    const hasSufficientCredit =
      availableCredit.isGreaterThan(amountMoney) || availableCredit.equals(amountMoney);
    const isStatusOk = creditStatus === 'ACTIVE';

    return {
      eligible: isStatusOk && hasSufficientCredit,
      creditStatus,
      creditRating,
      approvedLimit: limitMoney.toNumber(),
      usedCredit: usedMoney.toNumber(),
      availableCredit: availableCredit.toNumber(),
      blockReason: profile?.blockReason,
    };
  }

  public static async getProfile(
    companyId: string,
    customerId: string
  ): Promise<ICustomerCreditProfile | null> {
    return CustomerCreditProfileModel.findOne({ companyId, customerId });
  }
}
