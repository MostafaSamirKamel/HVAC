import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { InstallmentContractModel } from '../../../apps/installment-service/src/modules/installment-contracts/installment-contract.model.js';
import { InstallmentContractService } from '../../../apps/installment-service/src/modules/installment-contracts/installment-contract.service.js';
import { InstallmentScheduleModel } from '../../../apps/installment-service/src/modules/installment-schedules/installment-schedule.model.js';
import { InstallmentScheduleService } from '../../../apps/installment-service/src/modules/installment-schedules/installment-schedule.service.js';
import { InstallmentRescheduleModel } from '../../../apps/installment-service/src/modules/installment-reschedules/installment-reschedule.model.js';
import { InstallmentRescheduleService } from '../../../apps/installment-service/src/modules/installment-reschedules/installment-reschedule.service.js';
import { OverdueProcessingService } from '../../../apps/installment-service/src/modules/overdue-processing/overdue-processing.service.js';
import { OutboxEventModel } from '@hvac/database';
import { ValidationError } from '@hvac/errors';

describe('Phase 7: Installment Financing Service Integration Tests', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Contract Creation & Zero-Drift Amortization', () => {
    it('should create installment contract and generate schedules with exact zero-drift reconciliation', async () => {
      // 50,000 total - 10,000 down payment = 40,000 financed
      // 15% interest for 12 months = 6,000 interest
      // Total payable = 46,000
      const mockContract = {
        companyId,
        contractId: 'inst_1001',
        contractNumber: 'INST-2026-1001',
        customerId: 'cust_ahmed_01',
        branchId,
        totalFinancedAmount: mongoose.Types.Decimal128.fromString('40000.00'),
        downPayment: mongoose.Types.Decimal128.fromString('10000.00'),
        annualInterestRate: mongoose.Types.Decimal128.fromString('15.00'),
        totalInterest: mongoose.Types.Decimal128.fromString('6000.00'),
        totalPayable: mongoose.Types.Decimal128.fromString('46000.00'),
        totalPaid: mongoose.Types.Decimal128.fromString('0.00'),
        remainingBalance: mongoose.Types.Decimal128.fromString('46000.00'),
        tenorMonths: 12,
        monthlyInstallment: mongoose.Types.Decimal128.fromString('3833.33'),
        status: 'ACTIVE',
      };

      vi.spyOn(InstallmentContractModel, 'create').mockResolvedValueOnce([mockContract] as any);
      vi.spyOn(InstallmentScheduleModel, 'create').mockImplementationOnce(async (docs: any) => docs);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const result = await InstallmentContractService.createContract({
        companyId,
        customerId: 'cust_ahmed_01',
        branchId,
        orderTotalAmount: '50000.00',
        downPayment: '10000.00',
        annualInterestRate: 15,
        tenorMonths: 12,
        createdBy: 'usr_loan_officer',
      });

      expect(result.contract.status).toBe('ACTIVE');
      expect(result.contract.totalFinancedAmount.toString()).toBe('40000.00');
      expect(result.contract.totalInterest.toString()).toBe('6000.00');
      expect(result.contract.totalPayable.toString()).toBe('46000.00');
      expect(result.schedules.length).toBe(12);

      // Verify zero drift: sum of all monthly installments in schedules must equal 46000.00
      let scheduleSum = 0;
      for (const s of result.schedules) {
        scheduleSum += Number(s.totalAmount.toString());
      }
      expect(scheduleSum).toBeCloseTo(46000.0, 2);
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject contract when down payment exceeds total order amount', async () => {
      await expect(
        InstallmentContractService.createContract({
          companyId,
          customerId: 'cust_ahmed_01',
          branchId,
          orderTotalAmount: '20000.00',
          downPayment: '25000.00',
          annualInterestRate: 15,
          tenorMonths: 12,
          createdBy: 'usr_officer',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Installment Payment Collection', () => {
    it('should pay monthly installment, update schedule status to PAID, and decrement contract balance', async () => {
      const mockSchedule: any = {
        companyId,
        contractId: 'inst_1001',
        installmentNumber: 1,
        totalAmount: mongoose.Types.Decimal128.fromString('3833.33'),
        paidAmount: mongoose.Types.Decimal128.fromString('0.00'),
        remainingAmount: mongoose.Types.Decimal128.fromString('3833.33'),
        status: 'PENDING',
        currency: 'EGP',
        save: vi.fn().mockResolvedValue(true),
      };

      const mockContract: any = {
        companyId,
        contractId: 'inst_1001',
        branchId,
        currency: 'EGP',
        totalPayable: mongoose.Types.Decimal128.fromString('46000.00'),
        totalPaid: mongoose.Types.Decimal128.fromString('0.00'),
        remainingBalance: mongoose.Types.Decimal128.fromString('46000.00'),
        status: 'ACTIVE',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(InstallmentScheduleModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockSchedule),
      } as any);
      vi.spyOn(InstallmentContractModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockContract),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const res = await InstallmentContractService.payInstallment({
        companyId,
        contractId: 'inst_1001',
        installmentNumber: 1,
        amount: '3833.33',
        performedBy: 'usr_cashier_rana',
      });

      expect(res.schedule.status).toBe('PAID');
      expect(res.schedule.paidAmount.toString()).toBe('3833.33');
      expect(res.contract.totalPaid.toString()).toBe('3833.33');
      expect(res.contract.remainingBalance.toString()).toBe('42166.67');
      expect(outboxSpy).toHaveBeenCalled();
    });
  });

  describe('Overdue Processing & Late Fees', () => {
    it('should detect overdue installments, apply late fees, and emit outbox event', async () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const mockOverdueSchedule: any = {
        companyId,
        contractId: 'inst_1001',
        installmentNumber: 2,
        dueDate: pastDate,
        remainingAmount: mongoose.Types.Decimal128.fromString('3833.33'),
        status: 'PENDING',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(InstallmentScheduleModel, 'find').mockResolvedValueOnce([mockOverdueSchedule] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const processedCount = await InstallmentContractService.processOverdueInstallments(companyId);

      expect(processedCount).toBe(1);
      expect(mockOverdueSchedule.status).toBe('OVERDUE');
      expect(mockOverdueSchedule.lateFeeAmount.toString()).toBe('50.00');
      expect(outboxSpy).toHaveBeenCalled();
    });
  });

  describe('Early Settlement & Contract Liquidation', () => {
    it('should calculate early settlement preview waiving 100% of future unearned interest', async () => {
      const mockContract = {
        companyId,
        contractId: 'inst_1001',
        currency: 'EGP',
        status: 'ACTIVE',
      };

      const mockUnpaidSchedules = [
        {
          principalAmount: mongoose.Types.Decimal128.fromString('10000.00'),
          interestAmount: mongoose.Types.Decimal128.fromString('1500.00'),
        },
        {
          principalAmount: mongoose.Types.Decimal128.fromString('10000.00'),
          interestAmount: mongoose.Types.Decimal128.fromString('1500.00'),
        },
      ];

      vi.spyOn(InstallmentContractModel, 'findOne').mockResolvedValueOnce(mockContract as any);
      vi.spyOn(InstallmentScheduleModel, 'find').mockResolvedValueOnce(mockUnpaidSchedules as any);

      const preview = await InstallmentRescheduleService.calculateEarlySettlement(
        companyId,
        'inst_1001',
        100 // 100% waived
      );

      expect(preview.totalUnpaidPrincipal).toBe(20000);
      expect(preview.totalUnpaidInterest).toBe(3000);
      expect(preview.waivedInterest).toBe(3000);
      expect(preview.netSettlementAmount).toBe(20000);
    });

    it('should execute early settlement, mark all remaining schedules as PAID, and emit outbox event', async () => {
      const mockContract: any = {
        companyId,
        contractId: 'inst_1001',
        contractNumber: 'INST-2026-1001',
        customerId: 'cust_ahmed_01',
        branchId,
        currency: 'EGP',
        status: 'ACTIVE',
        totalPaid: mongoose.Types.Decimal128.fromString('20000.00'),
        remainingBalance: mongoose.Types.Decimal128.fromString('23000.00'),
        save: vi.fn().mockResolvedValue(true),
      };

      const mockUnpaidSchedules = [
        {
          principalAmount: mongoose.Types.Decimal128.fromString('10000.00'),
          interestAmount: mongoose.Types.Decimal128.fromString('1500.00'),
        },
        {
          principalAmount: mongoose.Types.Decimal128.fromString('10000.00'),
          interestAmount: mongoose.Types.Decimal128.fromString('1500.00'),
        },
      ];

      const mockContractQuery: any = {
        session: vi.fn().mockResolvedValue(mockContract),
        then: (resolve: any) => Promise.resolve(mockContract).then(resolve),
      };
      vi.spyOn(InstallmentContractModel, 'findOne').mockReturnValue(mockContractQuery);

      const mockScheduleQuery: any = {
        session: vi.fn().mockResolvedValue(mockUnpaidSchedules),
        then: (resolve: any) => Promise.resolve(mockUnpaidSchedules).then(resolve),
      };
      vi.spyOn(InstallmentScheduleModel, 'find').mockReturnValue(mockScheduleQuery);
      vi.spyOn(InstallmentScheduleModel, 'updateMany').mockResolvedValueOnce({ modifiedCount: 2 } as any);
      vi.spyOn(InstallmentRescheduleModel, 'create').mockResolvedValueOnce([
        {
          contractId: 'inst_1001',
          type: 'EARLY_SETTLEMENT',
          status: 'EXECUTED',
        },
      ] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const result = await InstallmentRescheduleService.executeEarlySettlement({
        companyId,
        contractId: 'inst_1001',
        waiveInterestPercentage: 100,
        reason: 'Customer requested full early payoff',
        requestedBy: 'usr_cashier_rana',
        approvedBy: 'usr_branch_manager',
      });

      expect(result.contract.status).toBe('COMPLETED');
      expect(result.contract.remainingBalance.toString()).toBe('0.00');
      expect(mockContract.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });
  });

  describe('Installment Tenor Rescheduling', () => {
    it('should reschedule remaining principal over extended tenor with zero drift and emit outbox event', async () => {
      const mockContract: any = {
        companyId,
        contractId: 'inst_1001',
        contractNumber: 'INST-2026-1001',
        customerId: 'cust_ahmed_01',
        branchId,
        currency: 'EGP',
        annualInterestRate: mongoose.Types.Decimal128.fromString('12.00'),
        status: 'ACTIVE',
        save: vi.fn().mockResolvedValue(true),
      };

      const mockUnpaidSchedules = [
        { principalAmount: mongoose.Types.Decimal128.fromString('12000.00') },
      ];

      vi.spyOn(InstallmentContractModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockContract),
      } as any);
      vi.spyOn(InstallmentScheduleModel, 'find').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockUnpaidSchedules),
      } as any);
      vi.spyOn(InstallmentScheduleModel, 'deleteMany').mockResolvedValueOnce({ deletedCount: 1 } as any);
      vi.spyOn(InstallmentScheduleModel, 'countDocuments').mockReturnValue({
        session: vi.fn().mockResolvedValue(6), // 6 paid so far
      } as any);
      vi.spyOn(InstallmentScheduleModel, 'create').mockImplementationOnce(async (docs: any) => docs);
      vi.spyOn(InstallmentRescheduleModel, 'create').mockResolvedValueOnce([
        {
          contractId: 'inst_1001',
          type: 'TENOR_EXTENSION',
          status: 'EXECUTED',
        },
      ] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const result = await InstallmentRescheduleService.rescheduleTenor({
        companyId,
        contractId: 'inst_1001',
        newAdditionalMonths: 12, // Extend remaining 12,000 principal over 12 months
        newAnnualInterestRate: 10,
        reason: 'Restructuring due to client cashflow constraints',
        requestedBy: 'usr_collection_officer',
        approvedBy: 'usr_credit_committee',
      });

      expect(result.contract.tenorMonths).toBe(18); // 6 paid + 12 new
      expect(result.newSchedules).toHaveLength(12);
      expect(mockContract.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });
  });

  describe('Overdue Processing & Aging Buckets', () => {
    it('should generate delinquency aging report with buckets (1-30, 31-60, 61-90, 90+)', async () => {
      const now = new Date();
      const mockOverdues = [
        {
          dueDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago -> currentDue
          remainingAmount: mongoose.Types.Decimal128.fromString('3000.00'),
          lateFeeAmount: mongoose.Types.Decimal128.fromString('50.00'),
        },
        {
          dueDate: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000), // 45 days ago -> pastDue30
          remainingAmount: mongoose.Types.Decimal128.fromString('4000.00'),
          lateFeeAmount: mongoose.Types.Decimal128.fromString('100.00'),
        },
      ];

      vi.spyOn(InstallmentScheduleModel, 'find').mockResolvedValueOnce(mockOverdues as any);

      const report = await OverdueProcessingService.getAgingReport(companyId);

      expect(report.currentDue.count).toBe(1);
      expect(report.currentDue.totalPrincipal).toBe(3000);
      expect(report.pastDue30.count).toBe(1);
      expect(report.pastDue30.totalPrincipal).toBe(4000);
      expect(report.totalOverdueAmount).toBe(7000);
      expect(report.totalLateFees).toBe(150);
    });

    it('should batch process overdue installments and flag contract as DEFAULTED when overdue exceeds 90 days', async () => {
      const pastDate95Days = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
      const mockSchedule: any = {
        companyId,
        contractId: 'inst_1001',
        installmentNumber: 3,
        dueDate: pastDate95Days,
        remainingAmount: mongoose.Types.Decimal128.fromString('5000.00'),
        save: vi.fn().mockResolvedValue(true),
      };

      const mockContract: any = {
        companyId,
        contractId: 'inst_1001',
        status: 'ACTIVE',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(InstallmentScheduleModel, 'find').mockResolvedValueOnce([mockSchedule] as any);
      vi.spyOn(InstallmentContractModel, 'findOne').mockResolvedValueOnce(mockContract);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const result = await OverdueProcessingService.processOverdues(companyId, {
        gracePeriodDays: 5,
        defaultAfterDays: 90,
      });

      expect(result.processedCount).toBe(1);
      expect(result.newlyOverdue).toBe(1);
      expect(result.newlyDefaulted).toBe(1);
      expect(mockSchedule.status).toBe('OVERDUE');
      expect(mockContract.status).toBe('DEFAULTED');
      expect(mockContract.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });
  });
});
