import { randomUUID } from 'crypto';
import { ClientSession } from 'mongoose';
import { ConflictError, NotFoundError } from '@hvac/errors';
import { AccountModel, IAccount, AccountType, NormalBalance } from './account.model.js';

export interface CreateAccountInput {
  companyId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentAccountId?: string;
  currency?: string;
  isSystemAccount?: boolean;
}

export class AccountService {
  public static async createAccount(input: CreateAccountInput, session?: ClientSession): Promise<IAccount> {
    const query = AccountModel.findOne({
      companyId: input.companyId,
      accountCode: input.accountCode,
    });
    const existing = session ? await query.session(session) : await query;

    if (existing) {
      throw new ConflictError(`Account with code ${input.accountCode} already exists for this company`);
    }

    const accountId = randomUUID();
    const [account] = await AccountModel.create(
      [
        {
          companyId: input.companyId,
          accountId,
          accountCode: input.accountCode,
          accountName: input.accountName,
          accountType: input.accountType,
          normalBalance: input.normalBalance,
          parentAccountId: input.parentAccountId,
          currency: input.currency || 'EGP',
          isSystemAccount: input.isSystemAccount || false,
        },
      ],
      { session }
    );

    return account;
  }

  public static async getAccountByCode(companyId: string, accountCode: string, session?: ClientSession): Promise<IAccount> {
    const query = AccountModel.findOne({ companyId, accountCode });
    const account = session ? await query.session(session) : await query;
    if (!account) {
      throw new NotFoundError(`Account ${accountCode} not found`);
    }
    return account;
  }

  public static async getAccountsByCompany(companyId: string): Promise<IAccount[]> {
    return AccountModel.find({ companyId, isActive: true }).sort({ accountCode: 1 });
  }

  /**
   * Seeds standard standard chart of accounts for a company if not already seeded
   */
  public static async ensureStandardAccounts(companyId: string, session?: ClientSession): Promise<void> {
    const standard = [
      { code: '101001', name: 'Cash on Hand (Treasury)', type: 'ASSET' as AccountType, normal: 'DEBIT' as NormalBalance },
      { code: '101002', name: 'Bank Accounts', type: 'ASSET' as AccountType, normal: 'DEBIT' as NormalBalance },
      { code: '102001', name: 'Accounts Receivable', type: 'ASSET' as AccountType, normal: 'DEBIT' as NormalBalance },
      { code: '103001', name: 'Merchandise Inventory Asset', type: 'ASSET' as AccountType, normal: 'DEBIT' as NormalBalance },
      { code: '201001', name: 'Accounts Payable', type: 'LIABILITY' as AccountType, normal: 'CREDIT' as NormalBalance },
      { code: '401001', name: 'Sales Revenue', type: 'REVENUE' as AccountType, normal: 'CREDIT' as NormalBalance },
      { code: '501001', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE' as AccountType, normal: 'DEBIT' as NormalBalance },
    ];

    for (const item of standard) {
      const query = AccountModel.findOne({ companyId, accountCode: item.code });
      const exists = session ? await query.session(session) : await query;
      if (!exists) {
        await AccountModel.create(
          [
            {
              companyId,
              accountId: randomUUID(),
              accountCode: item.code,
              accountName: item.name,
              accountType: item.type,
              normalBalance: item.normal,
              currency: 'EGP',
              isSystemAccount: true,
            },
          ],
          { session }
        );
      }
    }
  }
}
