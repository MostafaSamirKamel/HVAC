import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { AccountModel } from '../../../apps/finance-service/src/modules/chart-of-accounts/account.model.js';
import { AccountService } from '../../../apps/finance-service/src/modules/chart-of-accounts/account.service.js';
import { JournalEntryModel } from '../../../apps/finance-service/src/modules/journal-entries/journal-entry.model.js';
import { JournalEntryService } from '../../../apps/finance-service/src/modules/journal-entries/journal-entry.service.js';
import { TreasuryModel } from '../../../apps/finance-service/src/modules/treasuries/treasury.model.js';
import { TreasuryService } from '../../../apps/finance-service/src/modules/treasuries/treasury.service.js';
import { TreasuryLedgerModel } from '../../../apps/finance-service/src/modules/treasury-ledger/treasury-ledger.model.js';
import { PaymentModel } from '../../../apps/finance-service/src/modules/payments/payment.model.js';
import { PaymentService } from '../../../apps/finance-service/src/modules/payments/payment.service.js';
import { CashTransferModel } from '../../../apps/finance-service/src/modules/cash-transfers/cash-transfer.model.js';
import { CashTransferService } from '../../../apps/finance-service/src/modules/cash-transfers/cash-transfer.service.js';
import { ExpenseModel } from '../../../apps/finance-service/src/modules/expenses/expense.model.js';
import { ExpenseService } from '../../../apps/finance-service/src/modules/expenses/expense.service.js';
import { CustomerLedgerModel } from '../../../apps/finance-service/src/modules/customer-ledger/customer-ledger.model.js';
import { CustomerLedgerService } from '../../../apps/finance-service/src/modules/customer-ledger/customer-ledger.service.js';
import { SupplierLedgerModel } from '../../../apps/finance-service/src/modules/supplier-ledger/supplier-ledger.model.js';
import { SupplierLedgerService } from '../../../apps/finance-service/src/modules/supplier-ledger/supplier-ledger.service.js';
import { ReceivableModel } from '../../../apps/finance-service/src/modules/receivables/receivable.model.js';
import { ReceivablesService } from '../../../apps/finance-service/src/modules/receivables/receivables.service.js';
import { PayableModel } from '../../../apps/finance-service/src/modules/payables/payable.model.js';
import { PayablesService } from '../../../apps/finance-service/src/modules/payables/payables.service.js';
import { FinancialPeriodModel } from '../../../apps/finance-service/src/modules/financial-periods/period.model.js';
import { FinancialPeriodService } from '../../../apps/finance-service/src/modules/financial-periods/period.service.js';
import { ProfitLossService } from '../../../apps/finance-service/src/modules/profit-loss/profit-loss.service.js';
import { CashFlowService } from '../../../apps/finance-service/src/modules/cash-flow/cash-flow.service.js';
import { FinanceDashboardService } from '../../../apps/finance-service/src/modules/financial-entries/dashboard.service.js';
import { BankAccountModel } from '../../../apps/finance-service/src/modules/bank-accounts/bank-account.model.js';
import { OutboxEventModel } from '@hvac/database';
import { ValidationError, ConflictError } from '@hvac/errors';

describe('Phase 4: Finance & Treasury Service Integration Tests', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Chart of Accounts & Multi-tenant Hierarchy', () => {
    it('should create an account with proper type and debit/credit normal balance', async () => {
      const mockAccount = {
        companyId,
        accountId: 'acc_cash_01',
        accountCode: '101001',
        accountName: 'Cash on Hand',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
        currency: 'EGP',
        isActive: true,
      };

      vi.spyOn(AccountModel, 'findOne').mockResolvedValueOnce(null);
      vi.spyOn(AccountModel, 'create').mockResolvedValueOnce([mockAccount] as any);

      const created = await AccountService.createAccount({
        companyId,
        accountCode: '101001',
        accountName: 'Cash on Hand',
        accountType: 'ASSET',
        normalBalance: 'DEBIT',
      });

      expect(created.accountCode).toBe('101001');
      expect(created.normalBalance).toBe('DEBIT');
    });

    it('should reject duplicate account code for the same company', async () => {
      vi.spyOn(AccountModel, 'findOne').mockResolvedValueOnce({ accountCode: '101001' } as any);

      await expect(
        AccountService.createAccount({
          companyId,
          accountCode: '101001',
          accountName: 'Duplicate Cash',
          accountType: 'ASSET',
          normalBalance: 'DEBIT',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Journal Entries & Double-Entry Invariant (Rule 10)', () => {
    it('should post a valid balanced journal entry and emit outbox event', async () => {
      const mockEntry = {
        companyId,
        journalEntryId: 'je_1001',
        entryNumber: 'JE-2026-10001',
        status: 'POSTED',
        sourceModule: 'SALES',
        lines: [
          {
            accountId: 'acc_cash',
            accountCode: '101001',
            accountName: 'Cash',
            debit: mongoose.Types.Decimal128.fromString('48500.00'),
            credit: mongoose.Types.Decimal128.fromString('0.00'),
          },
          {
            accountId: 'acc_rev',
            accountCode: '401001',
            accountName: 'Revenue',
            debit: mongoose.Types.Decimal128.fromString('0.00'),
            credit: mongoose.Types.Decimal128.fromString('48500.00'),
          },
        ],
        totalDebit: mongoose.Types.Decimal128.fromString('48500.00'),
        totalCredit: mongoose.Types.Decimal128.fromString('48500.00'),
      };

      vi.spyOn(JournalEntryModel, 'create').mockResolvedValueOnce([mockEntry] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const entry = await JournalEntryService.createAndPostEntry({
        companyId,
        sourceModule: 'SALES',
        description: 'Cash sale revenue recognition',
        postedBy: 'usr_accountant_ali',
        lines: [
          {
            accountId: 'acc_cash',
            accountCode: '101001',
            accountName: 'Cash',
            debit: '48500.00',
            credit: 0,
          },
          {
            accountId: 'acc_rev',
            accountCode: '401001',
            accountName: 'Revenue',
            debit: 0,
            credit: '48500.00',
          },
        ],
      });

      expect(entry.status).toBe('POSTED');
      expect(entry.totalDebit.toString()).toBe('48500.00');
      expect(entry.totalCredit.toString()).toBe('48500.00');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject unbalanced journal entry (zero drift / exact balance invariant)', async () => {
      await expect(
        JournalEntryService.createAndPostEntry({
          companyId,
          sourceModule: 'MANUAL',
          description: 'Unbalanced entry attempt',
          postedBy: 'usr_accountant_ali',
          lines: [
            {
              accountId: 'acc_cash',
              accountCode: '101001',
              accountName: 'Cash',
              debit: '100.00',
              credit: 0,
            },
            {
              accountId: 'acc_rev',
              accountCode: '401001',
              accountName: 'Revenue',
              debit: 0,
              credit: '99.99', // 0.01 mismatch
            },
          ],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should reverse a posted journal entry by swapping debits and credits', async () => {
      const originalEntry: any = {
        companyId,
        journalEntryId: 'je_orig_01',
        entryNumber: 'JE-2026-0001',
        status: 'POSTED',
        sourceModule: 'SALES',
        currency: 'EGP',
        lines: [
          {
            accountId: 'acc_cash',
            accountCode: '101001',
            accountName: 'Cash',
            debit: mongoose.Types.Decimal128.fromString('1000.00'),
            credit: mongoose.Types.Decimal128.fromString('0.00'),
          },
          {
            accountId: 'acc_rev',
            accountCode: '401001',
            accountName: 'Revenue',
            debit: mongoose.Types.Decimal128.fromString('0.00'),
            credit: mongoose.Types.Decimal128.fromString('1000.00'),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(JournalEntryModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(originalEntry),
      } as any);

      const mockReversal = {
        companyId,
        journalEntryId: 'je_rev_02',
        entryNumber: 'JE-2026-0002',
        status: 'POSTED',
      };
      vi.spyOn(JournalEntryModel, 'create').mockResolvedValueOnce([mockReversal] as any);
      vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const reversal = await JournalEntryService.reverseJournalEntry(
        companyId,
        'je_orig_01',
        'Sales invoice cancellation',
        'usr_manager'
      );

      expect(originalEntry.status).toBe('VOIDED');
      expect(originalEntry.reversedByEntryId).toBe('je_rev_02');
      expect(reversal.status).toBe('POSTED');
    });
  });

  describe('Treasury Vaults & Immutable Movement Ledger (Rule 10)', () => {
    it('should record INFLOW, atomically update currentBalance, and write TreasuryLedger', async () => {
      const mockTreasury: any = {
        companyId,
        treasuryId: 'tr_main_01',
        code: 'TR-CAI-01',
        name: 'Nasr City Main Safe',
        branchId,
        currency: 'EGP',
        currentBalance: mongoose.Types.Decimal128.fromString('10000.00'),
        isActive: true,
        save: vi.fn().mockResolvedValue(true),
      };

      const mockMovement = {
        movementId: 'mov_in_01',
        treasuryId: 'tr_main_01',
        movementType: 'INFLOW',
        amount: mongoose.Types.Decimal128.fromString('5000.00'),
        balanceAfter: mongoose.Types.Decimal128.fromString('15000.00'),
        referenceType: 'CASH_SALE',
        referenceId: 'inv_1001',
      };

      vi.spyOn(TreasuryModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockTreasury),
      } as any);

      vi.spyOn(TreasuryLedgerModel, 'create').mockResolvedValueOnce([mockMovement] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const result = await TreasuryService.recordMovement({
        companyId,
        treasuryId: 'tr_main_01',
        movementType: 'INFLOW',
        amount: '5000.00',
        referenceType: 'CASH_SALE',
        referenceId: 'inv_1001',
        description: 'Customer payment collection',
        performedBy: 'usr_cashier_rana',
      });

      expect(mockTreasury.currentBalance.toString()).toBe('15000.00');
      expect(mockTreasury.save).toHaveBeenCalled();
      expect(result.movement.balanceAfter.toString()).toBe('15000.00');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject OUTFLOW when balance is insufficient (no overdraft allowed)', async () => {
      const mockTreasury: any = {
        companyId,
        treasuryId: 'tr_main_01',
        code: 'TR-CAI-01',
        name: 'Nasr City Main Safe',
        branchId,
        currency: 'EGP',
        currentBalance: mongoose.Types.Decimal128.fromString('200.00'),
        isActive: true,
      };

      vi.spyOn(TreasuryModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockTreasury),
      } as any);

      await expect(
        TreasuryService.recordMovement({
          companyId,
          treasuryId: 'tr_main_01',
          movementType: 'OUTFLOW',
          amount: '500.00',
          referenceType: 'EXPENSE',
          referenceId: 'exp_01',
          description: 'Office supplies',
          performedBy: 'usr_cashier_rana',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Payment Service & Cash Sale Saga Step 4 & 6 Integration', () => {
    it('should collect payment, update treasury vault, and create Payment document', async () => {
      const mockTreasury: any = {
        companyId,
        treasuryId: 'tr_main_01',
        code: 'TR-CAI-01',
        name: 'Nasr City Main Safe',
        branchId,
        currency: 'EGP',
        currentBalance: mongoose.Types.Decimal128.fromString('5000.00'),
        isActive: true,
        save: vi.fn().mockResolvedValue(true),
      };

      const mockMovement = {
        movementId: 'mov_in_99',
        treasuryId: 'tr_main_01',
      };

      const mockPayment = {
        companyId,
        paymentId: 'pay_saga_01',
        paymentNumber: 'PAY-2026-9999',
        invoiceId: 'inv_1001',
        orderId: 'ord_1001',
        treasuryId: 'tr_main_01',
        branchId,
        amount: mongoose.Types.Decimal128.fromString('48500.00'),
        currency: 'EGP',
        paymentMethod: 'CASH',
        status: 'COLLECTED',
      };

      vi.spyOn(TreasuryModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockTreasury),
      } as any);
      vi.spyOn(PaymentModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      } as any);
      vi.spyOn(TreasuryLedgerModel, 'create').mockResolvedValueOnce([mockMovement] as any);
      vi.spyOn(PaymentModel, 'create').mockResolvedValueOnce([mockPayment] as any);
      vi.spyOn(OutboxEventModel, 'create').mockResolvedValue([{} as any]);

      const payment = await PaymentService.collectPayment({
        companyId,
        branchId,
        treasuryId: 'tr_main_01',
        invoiceId: 'inv_1001',
        orderId: 'ord_1001',
        amount: '48500.00',
        paymentMethod: 'CASH',
        collectedBy: 'usr_cashier_rana',
      });

      expect(payment.status).toBe('COLLECTED');
      expect(payment.amount.toString()).toBe('48500.00');
    });

    it('should rollback payment idempotently during saga compensation (Rule 6)', async () => {
      const mockTreasury: any = {
        companyId,
        treasuryId: 'tr_main_01',
        branchId,
        currency: 'EGP',
        currentBalance: mongoose.Types.Decimal128.fromString('60000.00'),
        isActive: true,
        save: vi.fn().mockResolvedValue(true),
      };

      const mockPayment: any = {
        companyId,
        paymentId: 'pay_saga_01',
        treasuryId: 'tr_main_01',
        branchId,
        amount: mongoose.Types.Decimal128.fromString('48500.00'),
        currency: 'EGP',
        status: 'COLLECTED',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(PaymentModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockPayment),
      } as any);
      vi.spyOn(TreasuryModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockTreasury),
      } as any);
      vi.spyOn(TreasuryLedgerModel, 'create').mockResolvedValueOnce([{ movementId: 'mov_comp_01' }] as any);
      vi.spyOn(OutboxEventModel, 'create').mockResolvedValue([{} as any]);

      const res = await PaymentService.rollbackPayment({
        companyId,
        paymentId: 'pay_saga_01',
        reason: 'Downstream saga step failed',
      });

      expect(res.refunded).toBe(true);
      expect(mockPayment.status).toBe('REFUNDED');
      expect(mockTreasury.currentBalance.toString()).toBe('11500.00'); // 60000 - 48500
    });
  });

  describe('Inter-branch / Safe-to-Safe Cash Transfers', () => {
    it('should complete two-phase cash transfer and balance inter-branch general ledger', async () => {
      const sourceTreasury: any = {
        companyId,
        treasuryId: 'tr_cairo',
        code: 'TR-CAI-01',
        name: 'Cairo Safe',
        branchId: 'br_cairo',
        currency: 'EGP',
        currentBalance: mongoose.Types.Decimal128.fromString('50000.00'),
        isActive: true,
        save: vi.fn().mockResolvedValue(true),
      };

      const targetTreasury: any = {
        companyId,
        treasuryId: 'tr_giza',
        code: 'TR-GIZ-01',
        name: 'Giza Safe',
        branchId: 'br_giza',
        currency: 'EGP',
        currentBalance: mongoose.Types.Decimal128.fromString('10000.00'),
        isActive: true,
        save: vi.fn().mockResolvedValue(true),
      };

      const mockTransfer: any = {
        companyId,
        transferId: 'trf_01',
        transferNumber: 'TRF-2026-1001',
        sourceTreasuryId: 'tr_cairo',
        targetTreasuryId: 'tr_giza',
        sourceBranchId: 'br_cairo',
        targetBranchId: 'br_giza',
        amount: mongoose.Types.Decimal128.fromString('15000.00'),
        status: 'IN_TRANSIT',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(CashTransferModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockTransfer),
      } as any);
      vi.spyOn(TreasuryModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(targetTreasury),
      } as any);
      vi.spyOn(AccountModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue({
          accountId: 'acc_cash_std',
          accountCode: '101001',
          accountName: 'Cash on Hand',
        }),
      } as any);
      vi.spyOn(TreasuryLedgerModel, 'create').mockResolvedValueOnce([{ movementId: 'mov_trf_in' }] as any);
      vi.spyOn(JournalEntryModel, 'create').mockResolvedValueOnce([{
        journalEntryId: 'je_trf_01',
        entryNumber: 'JE-2026-9999',
      }] as any);
      vi.spyOn(OutboxEventModel, 'create').mockResolvedValue([{} as any]);

      const completed = await CashTransferService.completeTransfer(
        companyId,
        'trf_01',
        'usr_giza_manager'
      );

      expect(completed.status).toBe('COMPLETED');
      expect(completed.receivedBy).toBe('usr_giza_manager');
      expect(targetTreasury.currentBalance.toString()).toBe('25000.00'); // 10000 + 15000
    });
  });

  describe('Expense Management & Double-Entry Posting (SRS Section 28 & 29)', () => {
    it('should record an approved expense, deduct from treasury safe, and post a balanced journal entry', async () => {
      const mockTreasury: any = {
        companyId,
        treasuryId: 'tr_cairo_01',
        name: 'Nasr City Cash Safe',
        currentBalance: mongoose.Types.Decimal128.fromString('15000.00'),
        save: vi.fn().mockResolvedValue(true),
      };

      const mockAccount: any = {
        companyId,
        accountId: 'acc_rent_01',
        accountCode: '52001',
        accountName: 'Office Rent Expense',
        accountType: 'EXPENSE',
      };

      const mockExpense: any = {
        companyId,
        branchId,
        expenseId: 'exp_rent_01',
        expenseNumber: 'EXP-2026-1001',
        amount: mongoose.Types.Decimal128.fromString('3500.00'),
        approvalStatus: 'APPROVED',
      };

      vi.spyOn(TreasuryModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockTreasury),
      } as any);
      vi.spyOn(AccountModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockAccount),
      } as any);
      vi.spyOn(TreasuryLedgerModel, 'create').mockResolvedValueOnce([{ movementId: 'mov_exp_01' }] as any);
      vi.spyOn(JournalEntryModel, 'create').mockResolvedValueOnce([{ journalEntryId: 'je_exp_01' }] as any);
      vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);
      vi.spyOn(ExpenseModel, 'create').mockResolvedValueOnce([mockExpense] as any);

      const expense = await ExpenseService.recordExpense({
        companyId,
        branchId,
        categoryId: 'cat_rent',
        categoryName: 'Rent',
        amount: 3500,
        paymentSourceType: 'TREASURY',
        treasuryId: 'tr_cairo_01',
        description: 'October Office Rent',
        expenseAccountId: 'acc_rent_01',
        recordedBy: 'usr_accountant_01',
        approvalThreshold: 5000,
      });

      expect(expense.approvalStatus).toBe('APPROVED');
      expect(mockTreasury.save).toHaveBeenCalled();
      // 15,000 - 3,500 = 11,500
      expect(mockTreasury.currentBalance.toString()).toBe('11500.00');
    });

    it('should set approvalStatus to PENDING_APPROVAL when expense exceeds threshold', async () => {
      const mockExpense: any = {
        companyId,
        branchId,
        expenseId: 'exp_capex_01',
        expenseNumber: 'EXP-2026-1002',
        amount: mongoose.Types.Decimal128.fromString('25000.00'),
        approvalStatus: 'PENDING_APPROVAL',
      };

      vi.spyOn(ExpenseModel, 'create').mockResolvedValueOnce([mockExpense] as any);

      const expense = await ExpenseService.recordExpense({
        companyId,
        branchId,
        categoryId: 'cat_equip',
        categoryName: 'Equipment',
        amount: 25000,
        paymentSourceType: 'TREASURY',
        treasuryId: 'tr_cairo_01',
        description: 'New Industrial Vacuum Pump',
        expenseAccountId: 'acc_equip_01',
        recordedBy: 'usr_accountant_01',
        approvalThreshold: 5000,
      });

      expect(expense.approvalStatus).toBe('PENDING_APPROVAL');
    });
  });

  describe('Customer & Supplier Sub-Ledgers (SRS Section 23 & 24)', () => {
    it('should compute exact customer running balance across sales and payments', async () => {
      const priorEntry: any = {
        runningBalance: mongoose.Types.Decimal128.fromString('5000.00'),
      };

      const mockNewEntry: any = {
        companyId,
        customerId: 'cust_01',
        debit: mongoose.Types.Decimal128.fromString('0.00'),
        credit: mongoose.Types.Decimal128.fromString('2000.00'),
        runningBalance: mongoose.Types.Decimal128.fromString('3000.00'),
      };

      vi.spyOn(CustomerLedgerModel, 'findOne').mockReturnValue({
        sort: vi.fn().mockResolvedValue(priorEntry),
      } as any);
      vi.spyOn(CustomerLedgerModel, 'create').mockResolvedValueOnce([mockNewEntry] as any);

      const entry = await CustomerLedgerService.recordEntry({
        companyId,
        customerId: 'cust_01',
        branchId,
        entryType: 'PAYMENT',
        debit: 0,
        credit: 2000,
        referenceId: 'pay_1001',
        referenceType: 'CustomerPayment',
        description: 'Partial payment on invoice',
        performedBy: 'usr_cashier_01',
      });

      // 5,000 previous - 2,000 credit = 3,000 running balance
      expect(entry.runningBalance.toString()).toBe('3000.00');
    });

    it('should compute exact supplier running balance across bills and disbursements', async () => {
      const priorEntry: any = {
        runningBalance: mongoose.Types.Decimal128.fromString('80000.00'),
      };

      const mockNewEntry: any = {
        companyId,
        supplierId: 'sup_carrier',
        debit: mongoose.Types.Decimal128.fromString('30000.00'),
        credit: mongoose.Types.Decimal128.fromString('0.00'),
        runningBalance: mongoose.Types.Decimal128.fromString('50000.00'),
      };

      vi.spyOn(SupplierLedgerModel, 'findOne').mockReturnValue({
        sort: vi.fn().mockResolvedValue(priorEntry),
      } as any);
      vi.spyOn(SupplierLedgerModel, 'create').mockResolvedValueOnce([mockNewEntry] as any);

      const entry = await SupplierLedgerService.recordEntry({
        companyId,
        supplierId: 'sup_carrier',
        branchId,
        entryType: 'PAYMENT',
        debit: 30000,
        credit: 0,
        referenceId: 'spay_1001',
        referenceType: 'SupplierPayment',
        description: 'Bank transfer to Carrier Egypt',
        performedBy: 'usr_accountant_01',
      });

      // 80,000 previous - 30,000 debit = 50,000 remaining payable
      expect(entry.runningBalance.toString()).toBe('50000.00');
    });
  });

  describe('Receivables & Payables Aging Engine (SRS Section 21 & 22)', () => {
    it('should categorize receivables into correct aging buckets', async () => {
      const now = new Date();
      const mockReceivables: any[] = [
        {
          remainingAmount: mongoose.Types.Decimal128.fromString('10000.00'),
          dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // Not yet due (Current)
        },
        {
          remainingAmount: mongoose.Types.Decimal128.fromString('5000.00'),
          dueDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days overdue (1-30)
        },
        {
          remainingAmount: mongoose.Types.Decimal128.fromString('8000.00'),
          dueDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days overdue (31-60)
        },
        {
          remainingAmount: mongoose.Types.Decimal128.fromString('12000.00'),
          dueDate: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000), // 100 days overdue (>90)
        },
      ];

      vi.spyOn(ReceivableModel, 'find').mockResolvedValueOnce(mockReceivables as any);

      const aging = await ReceivablesService.getAgingSummary(companyId);

      expect(aging.totalReceivables).toBe(35000);
      expect(aging.current).toBe(10000);
      expect(aging.days1To30).toBe(5000);
      expect(aging.days31To60).toBe(8000);
      expect(aging.daysOver90).toBe(12000);
    });

    it('should categorize payables into correct aging buckets', async () => {
      const now = new Date();
      const mockPayables: any[] = [
        {
          remainingAmount: mongoose.Types.Decimal128.fromString('20000.00'),
          dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // Current
        },
        {
          remainingAmount: mongoose.Types.Decimal128.fromString('15000.00'),
          dueDate: new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000), // 61-90 days
        },
      ];

      vi.spyOn(PayableModel, 'find').mockResolvedValueOnce(mockPayables as any);

      const aging = await PayablesService.getAgingSummary(companyId);

      expect(aging.totalPayables).toBe(35000);
      expect(aging.current).toBe(20000);
      expect(aging.days61To90).toBe(15000);
    });
  });

  describe('Financial Period Lock & Audit Protection (SRS Section 34)', () => {
    it('should reject transactions posted into a CLOSED or LOCKED financial period', async () => {
      const mockPeriod: any = {
        periodName: '2026-08',
        status: 'CLOSED',
      };

      vi.spyOn(FinancialPeriodModel, 'findOne').mockResolvedValueOnce(mockPeriod as any);

      await expect(
        FinancialPeriodService.validateDateInOpenPeriod(
          companyId,
          new Date('2026-08-15T00:00:00Z')
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should permit transactions when financial period is OPEN', async () => {
      const mockPeriod: any = {
        periodName: '2026-09',
        status: 'OPEN',
      };

      vi.spyOn(FinancialPeriodModel, 'findOne').mockResolvedValueOnce(mockPeriod as any);

      await expect(
        FinancialPeriodService.validateDateInOpenPeriod(
          companyId,
          new Date('2026-09-15T00:00:00Z')
        )
      ).resolves.not.toThrow();
    });
  });

  describe('Profit & Loss and Cash Flow Statements (SRS Section 15 & 16)', () => {
    it('should calculate revenue, COGS, gross profit, expenses, and net profit', async () => {
      const mockAccounts = [
        { accountId: 'acc_sales', accountCode: '4100', accountName: 'AC Sales', accountType: 'REVENUE' },
        { accountId: 'acc_cogs', accountCode: '5001', accountName: 'COGS Units', accountType: 'EXPENSE' },
        { accountId: 'acc_rent', accountCode: '5101', accountName: 'Rent', accountType: 'EXPENSE' },
      ];

      const mockEntries: any[] = [
        {
          lines: [
            { accountId: 'acc_sales', debit: { toString: () => '0' }, credit: { toString: () => '100000' } },
            { accountId: 'acc_cogs', debit: { toString: () => '70000' }, credit: { toString: () => '0' } },
            { accountId: 'acc_rent', debit: { toString: () => '10000' }, credit: { toString: () => '0' } },
          ],
        },
      ];

      vi.spyOn(JournalEntryModel, 'find').mockResolvedValueOnce(mockEntries as any);
      vi.spyOn(AccountModel, 'find').mockResolvedValueOnce(mockAccounts as any);

      const pnl = await ProfitLossService.generateReport(companyId);

      expect(pnl.revenue).toBe(100000);
      expect(pnl.cogs).toBe(70000);
      expect(pnl.grossProfit).toBe(30000); // 100,000 - 70,000
      expect(pnl.totalExpenses).toBe(10000);
      expect(pnl.netProfit).toBe(20000); // 30,000 - 10,000
    });

    it('should calculate operating cash in, cash out, and net cash flow from treasury movements', async () => {
      const mockMovements: any[] = [
        { movementType: 'INFLOW', referenceType: 'CASH_SALE', amount: { toString: () => '50000' } },
        { movementType: 'OUTFLOW', referenceType: 'VENDOR_PAYMENT', amount: { toString: () => '30000' } },
        { movementType: 'OUTFLOW', referenceType: 'EXPENSE', amount: { toString: () => '5000' } },
      ];

      vi.spyOn(TreasuryLedgerModel, 'find').mockResolvedValueOnce(mockMovements as any);

      const cf = await CashFlowService.generateReport(companyId);

      expect(cf.operatingCashIn).toBe(50000);
      expect(cf.operatingCashOut).toBe(35000);
      expect(cf.netOperatingCashFlow).toBe(15000); // 50,000 - 35,000
    });
  });

  describe('Executive Finance Dashboard (SRS Section 25)', () => {
    it('should aggregate cash, bank, receivables, payables, and P&L into dashboard KPIs', async () => {
      vi.spyOn(TreasuryModel, 'find').mockResolvedValueOnce([
        { currentBalance: mongoose.Types.Decimal128.fromString('45000.00') },
      ] as any);

      vi.spyOn(BankAccountModel, 'find').mockResolvedValueOnce([
        { currentBalance: mongoose.Types.Decimal128.fromString('120000.00') },
      ] as any);

      vi.spyOn(ReceivablesService, 'getAgingSummary').mockResolvedValueOnce({
        totalReceivables: 65000,
      } as any);

      vi.spyOn(PayablesService, 'getAgingSummary').mockResolvedValueOnce({
        totalPayables: 40000,
      } as any);

      vi.spyOn(ProfitLossService, 'generateReport').mockResolvedValueOnce({
        revenue: 250000,
        grossProfit: 75000,
        totalExpenses: 25000,
        netProfit: 50000,
      } as any);

      vi.spyOn(CashFlowService, 'generateReport').mockResolvedValueOnce({
        netTotalCashMovement: 35000,
      } as any);

      const dashboard = await FinanceDashboardService.getDashboardSummary(companyId);

      expect(dashboard.cashBalance).toBe(45000);
      expect(dashboard.bankBalance).toBe(120000);
      expect(dashboard.totalReceivables).toBe(65000);
      expect(dashboard.totalPayables).toBe(40000);
      expect(dashboard.netProfit).toBe(50000);
      expect(dashboard.netCashFlow).toBe(35000);
    });
  });
});
