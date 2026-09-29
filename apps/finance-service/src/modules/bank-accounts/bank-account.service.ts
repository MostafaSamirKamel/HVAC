import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { ConflictError, NotFoundError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { BankAccountModel, IBankAccount } from './bank-account.model.js';

export interface CreateBankAccountInput {
  companyId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban?: string;
  branchId?: string;
  currency?: string;
  openingBalance?: number | string;
}

export class BankAccountService {
  public static async createBankAccount(input: CreateBankAccountInput): Promise<IBankAccount> {
    const existing = await BankAccountModel.findOne({
      companyId: input.companyId,
      accountNumber: input.accountNumber,
    });

    if (existing) {
      throw new ConflictError(`Bank account with number '${input.accountNumber}' already exists`);
    }

    const openingMoney = Money.from(input.openingBalance || 0, input.currency || 'EGP');

    const [account] = await BankAccountModel.create([
      {
        companyId: input.companyId,
        bankAccountId: randomUUID(),
        bankName: input.bankName,
        accountName: input.accountName,
        accountNumber: input.accountNumber,
        iban: input.iban,
        branchId: input.branchId,
        currency: input.currency || 'EGP',
        currentBalance: mongoose.Types.Decimal128.fromString(openingMoney.toFixed(2)),
        isActive: true,
      },
    ]);

    return account;
  }

  public static async getBankAccountById(
    companyId: string,
    bankAccountId: string
  ): Promise<IBankAccount> {
    const account = await BankAccountModel.findOne({ companyId, bankAccountId });
    if (!account) {
      throw new NotFoundError(`Bank account ${bankAccountId} not found`);
    }
    return account;
  }

  public static async listBankAccounts(
    companyId: string,
    filter: { branchId?: string; isActive?: boolean } = {}
  ): Promise<IBankAccount[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;

    return BankAccountModel.find(query).sort({ bankName: 1, accountName: 1 });
  }
}
