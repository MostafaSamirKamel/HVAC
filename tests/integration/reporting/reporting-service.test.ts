import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { DailyClosingModel } from '../../../apps/reporting-service/src/modules/dashboard/daily-closing.model.js';
import { ReportingService } from '../../../apps/reporting-service/src/modules/dashboard/reporting.service.js';
import { SalesReportService } from '../../../apps/reporting-service/src/modules/sales-reports/sales-report.service.js';
import { InventoryReportService } from '../../../apps/reporting-service/src/modules/inventory-reports/inventory-report.service.js';
import { TechnicianReportService } from '../../../apps/reporting-service/src/modules/technician-reports/technician-report.service.js';
import { FinanceReportService } from '../../../apps/reporting-service/src/modules/finance-reports/finance-report.service.js';
import { createApp, setReadiness } from '../../../apps/reporting-service/src/app.js';
import { ConflictError } from '@hvac/errors';

describe('Phase 12: Reporting Service Integration Tests (Rule 17, 18 & 22)', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';
  const treasuryId = 'trs_main_safe';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Daily Treasury Closing & Reconciliation', () => {
    it('should balance exactly with zero variance and BALANCED status', async () => {
      // Opening: 10,000, In: 5,000, Out: 2,000 => Expected System: 13,000. Actual: 13,000 => Variance: 0.00
      const mockClosing = {
        companyId,
        branchId,
        treasuryId,
        openingBalance: mongoose.Types.Decimal128.fromString('10000.00'),
        totalCashIn: mongoose.Types.Decimal128.fromString('5000.00'),
        totalCashOut: mongoose.Types.Decimal128.fromString('2000.00'),
        systemBalance: mongoose.Types.Decimal128.fromString('13000.00'),
        actualBalance: mongoose.Types.Decimal128.fromString('13000.00'),
        variance: mongoose.Types.Decimal128.fromString('0.00'),
        status: 'BALANCED',
      };

      vi.spyOn(DailyClosingModel, 'findOne').mockResolvedValueOnce(null);
      vi.spyOn(DailyClosingModel, 'create').mockResolvedValueOnce([mockClosing] as any);

      const closing = await ReportingService.recordDailyClosing({
        companyId,
        branchId,
        treasuryId,
        closingDate: new Date('2026-09-26T18:00:00Z'),
        openingBalance: 10000,
        totalCashIn: 5000,
        totalCashOut: 2000,
        actualBalance: 13000,
        closedBy: 'usr_cashier_01',
      });

      expect(closing.status).toBe('BALANCED');
      expect(closing.variance.toString()).toBe('0.00');
      expect(closing.systemBalance.toString()).toBe('13000.00');
    });

    it('should flag status as PENDING_APPROVAL when variance exceeds approval threshold', async () => {
      // Opening: 5,000, In: 1,000, Out: 500 => System: 5,500. Actual: 5,300 => Variance: -200 (Deficit > 50 EGP threshold)
      const mockClosing = {
        companyId,
        branchId,
        treasuryId,
        systemBalance: mongoose.Types.Decimal128.fromString('5500.00'),
        actualBalance: mongoose.Types.Decimal128.fromString('5300.00'),
        variance: mongoose.Types.Decimal128.fromString('-200.00'),
        status: 'PENDING_APPROVAL',
      };

      vi.spyOn(DailyClosingModel, 'findOne').mockResolvedValueOnce(null);
      vi.spyOn(DailyClosingModel, 'create').mockResolvedValueOnce([mockClosing] as any);

      const closing = await ReportingService.recordDailyClosing({
        companyId,
        branchId,
        treasuryId,
        closingDate: new Date('2026-09-26T18:00:00Z'),
        openingBalance: 5000,
        totalCashIn: 1000,
        totalCashOut: 500,
        actualBalance: 5300,
        closedBy: 'usr_cashier_01',
        varianceApprovalThreshold: 50,
      });

      expect(closing.status).toBe('PENDING_APPROVAL');
      expect(closing.variance.toString()).toBe('-200.00');
    });

    it('should reject duplicate daily closing for the same branch and safe on the same day', async () => {
      vi.spyOn(DailyClosingModel, 'findOne').mockResolvedValueOnce({
        closingId: 'cls_already_done',
      } as any);

      await expect(
        ReportingService.recordDailyClosing({
          companyId,
          branchId,
          treasuryId,
          closingDate: new Date('2026-09-26T18:00:00Z'),
          openingBalance: 1000,
          totalCashIn: 0,
          totalCashOut: 0,
          actualBalance: 1000,
          closedBy: 'usr_cashier_01',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Executive Dashboard & Sales Analytics Projections', () => {
    it('should retrieve consolidated company executive analytics', async () => {
      const dashboard = await ReportingService.getExecutiveDashboard(companyId);

      expect(dashboard.companyId).toBe(companyId);
      expect(dashboard.summary.totalRevenueYTD).toBeGreaterThan(0);
      expect(dashboard.branchPerformance.length).toBeGreaterThan(0);
    });

    it('should project sales funnel conversion stages', async () => {
      const funnel = await SalesReportService.getSalesFunnel(companyId, { branchId });

      expect(funnel.companyId).toBe(companyId);
      expect(funnel.stages.length).toBe(5);
      expect(funnel.stages[0].stage).toBe('LEADS');
      expect(funnel.stages[4].stage).toBe('PAID');
    });

    it('should project sales by product categories', async () => {
      const categories = await SalesReportService.getSalesByProductCategory(companyId);

      expect(categories.companyId).toBe(companyId);
      expect(categories.categories.length).toBeGreaterThan(0);
      expect(categories.categories[0].category).toBe('SPLIT_AIR_CONDITIONER');
    });
  });

  describe('Inventory Analytics Projections', () => {
    it('should project inventory valuation and category breakdown', async () => {
      const valuation = await InventoryReportService.getInventoryValuation(companyId);

      expect(valuation.companyId).toBe(companyId);
      expect(valuation.totalValuation).toBe(18900000.0);
      expect(valuation.warehouses.length).toBe(3);
      expect(valuation.categoryBreakdown.length).toBe(3);
    });

    it('should project inventory turnover and slow-moving items', async () => {
      const turnover = await InventoryReportService.getInventoryTurnover(companyId);

      expect(turnover.annualizedTurnoverRatio).toBe(6.4);
      expect(turnover.fastMovingItems.length).toBeGreaterThan(0);
      expect(turnover.slowMovingItems.length).toBeGreaterThan(0);
    });
  });

  describe('Technician & Service Performance Projections', () => {
    it('should project technician first-time fix rate and SLA metrics', async () => {
      const techReport = await TechnicianReportService.getTechnicianPerformanceSummary(companyId, { branchId });

      expect(techReport.summary.totalWorkOrders).toBe(156);
      expect(techReport.summary.firstTimeFixRate).toBe(94.2);
      expect(techReport.summary.averageCustomerRating).toBe(4.8);
      expect(techReport.technicians.length).toBe(2);
    });
  });

  describe('Financial Statements Projections', () => {
    it('should project profit and loss statement with operating margins', async () => {
      const pl = await FinanceReportService.getProfitAndLossSummary(companyId);

      expect(pl.companyId).toBe(companyId);
      expect(pl.financialStatement.grossProfit).toBe(6125000.0);
      expect(pl.financialStatement.netOperatingIncome).toBe(3275000.0);
      expect(pl.financialStatement.grossMarginPercentage).toBe(25.0);
    });

    it('should project cash flow statement with operating, investing, and financing flows', async () => {
      const cf = await FinanceReportService.getCashFlowSummary(companyId);

      expect(cf.companyId).toBe(companyId);
      expect(cf.cashFlow.operatingActivities.netCashFromOperatingActivities).toBe(3670000.0);
      expect(cf.cashFlow.endingCashBalance).toBe(6120000.0);
    });
  });

  describe('Observability Probes & Health (Rule 22)', () => {
    it('should respond 200 on /health/live', async () => {
      const app = createApp();
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('live');
    });

    it('should respond 200 on /health/ready when service is ready and MongoDB is connected', async () => {
      const app = createApp();
      setReadiness(true);
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.mongo).toBe('connected');
    });

    it('should respond 503 on /health/ready when service is not ready', async () => {
      const app = createApp();
      setReadiness(false);

      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unavailable');
    });

    it('should return Prometheus metrics on /metrics', async () => {
      const app = createApp();
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain('reporting_service_up');
    });
  });
});
