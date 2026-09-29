import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { ApprovalRequestModel } from '../../../apps/approval-service/src/modules/approval-requests/approval-request.model.js';
import { ApprovalRequestService } from '../../../apps/approval-service/src/modules/approval-requests/approval-request.service.js';
import { ApprovalRuleModel } from '../../../apps/approval-service/src/modules/approval-rules/approval-rule.model.js';
import { ApprovalRuleService } from '../../../apps/approval-service/src/modules/approval-rules/approval-rule.service.js';
import { ApprovalStepModel } from '../../../apps/approval-service/src/modules/approval-steps/approval-step.model.js';
import { ApprovalStepService } from '../../../apps/approval-service/src/modules/approval-steps/approval-step.service.js';
import { ApprovalHistoryModel } from '../../../apps/approval-service/src/modules/approval-history/approval-history.model.js';
import { ApprovalHistoryService } from '../../../apps/approval-service/src/modules/approval-history/approval-history.service.js';
import { createApp, setReadiness } from '../../../apps/approval-service/src/app.js';
import { OutboxEventModel } from '@hvac/database';
import { ConflictError, ValidationError, NotFoundError } from '@hvac/errors';

describe('Phase 9: Approval Service Integration Tests (Rule 13 & Rule 22)', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Approval Request Creation', () => {
    it('should create approval request in PENDING state and emit outbox event', async () => {
      const mockRequest = {
        companyId,
        branchId,
        requestId: 'apr_1001',
        requestNumber: 'APR-2026-1001',
        requestType: 'DISCOUNT_OVERRIDE',
        referenceType: 'SalesOrder',
        referenceId: 'so_9999',
        requestedBy: 'user_sales_rep',
        status: 'PENDING',
        amount: mongoose.Types.Decimal128.fromString('500.00'),
        metadata: { originalDiscount: 5, requestedDiscount: 15 },
      };

      vi.spyOn(ApprovalRequestModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      } as any);
      vi.spyOn(ApprovalRequestModel, 'create').mockResolvedValueOnce([mockRequest] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const req = await ApprovalRequestService.createRequest({
        companyId,
        branchId,
        requestType: 'DISCOUNT_OVERRIDE',
        referenceType: 'SalesOrder',
        referenceId: 'so_9999',
        requestedBy: 'user_sales_rep',
        amount: 500,
        metadata: { originalDiscount: 5, requestedDiscount: 15 },
      });

      expect(req.status).toBe('PENDING');
      expect(req.requestType).toBe('DISCOUNT_OVERRIDE');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject creating duplicate pending approval request for same reference', async () => {
      vi.spyOn(ApprovalRequestModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue({ requestNumber: 'APR-2026-1001' }),
      } as any);

      await expect(
        ApprovalRequestService.createRequest({
          companyId,
          branchId,
          requestType: 'DISCOUNT_OVERRIDE',
          referenceType: 'SalesOrder',
          referenceId: 'so_9999',
          requestedBy: 'user_sales_rep',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Approval Decision Execution', () => {
    it('should approve pending request and emit approval.request.approved outbox event', async () => {
      const mockRequest: any = {
        companyId,
        branchId,
        requestId: 'apr_1001',
        requestType: 'CASH_TRANSFER',
        referenceType: 'CashTransfer',
        referenceId: 'xfer_555',
        status: 'PENDING',
        metadata: { fromTreasury: 'safe_01', toTreasury: 'safe_02' },
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(ApprovalRequestModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockRequest),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const approved = await ApprovalRequestService.approveRequest(
        companyId,
        'apr_1001',
        'mgr_financial_director'
      );

      expect(approved.status).toBe('APPROVED');
      expect(approved.approverId).toBe('mgr_financial_director');
      expect(mockRequest.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject request with mandatory reason and emit outbox event', async () => {
      const mockRequest: any = {
        companyId,
        branchId,
        requestId: 'apr_1001',
        requestType: 'PRICE_OVERRIDE',
        referenceType: 'SalesOrder',
        referenceId: 'so_9999',
        status: 'PENDING',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(ApprovalRequestModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockRequest),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const rejected = await ApprovalRequestService.rejectRequest(
        companyId,
        'apr_1001',
        'mgr_sales_director',
        'Discount exceeds maximum allowable branch threshold'
      );

      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toBe('Discount exceeds maximum allowable branch threshold');
      expect(mockRequest.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should fail if attempting to approve an already approved or rejected request', async () => {
      const mockRequest: any = {
        companyId,
        requestId: 'apr_1001',
        status: 'APPROVED',
      };

      vi.spyOn(ApprovalRequestModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockRequest),
      } as any);

      await expect(
        ApprovalRequestService.approveRequest(companyId, 'apr_1001', 'mgr_director')
      ).rejects.toThrow(ValidationError);
    });

    it('should cancel pending approval request by the creator', async () => {
      const mockRequest: any = {
        companyId,
        requestId: 'apr_1001',
        requestedBy: 'user_sales_rep',
        status: 'PENDING',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(ApprovalRequestModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockRequest),
      } as any);

      const cancelled = await ApprovalRequestService.cancelRequest(
        companyId,
        'apr_1001',
        'user_sales_rep',
        'Client decided not to proceed'
      );

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toBe('Client decided not to proceed');
      expect(mockRequest.save).toHaveBeenCalled();
    });
  });

  describe('Approval Rules Configuration (ApprovalRuleService)', () => {
    it('should create an approval rule for high-value purchase orders', async () => {
      const mockRule = {
        companyId,
        ruleId: 'rule_po_high',
        ruleName: 'High Value PO Approval',
        requestType: 'PURCHASE_ORDER',
        minAmount: mongoose.Types.Decimal128.fromString('100000.00'),
        requiredRole: 'CFO',
        approvalLevel: 2,
        isActive: true,
      };

      vi.spyOn(ApprovalRuleModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
        then: (resolve: any) => Promise.resolve(null).then(resolve),
      } as any);
      vi.spyOn(ApprovalRuleModel, 'create').mockResolvedValueOnce([mockRule] as any);

      const rule = await ApprovalRuleService.createRule({
        companyId,
        ruleId: 'rule_po_high',
        ruleName: 'High Value PO Approval',
        requestType: 'PURCHASE_ORDER',
        minAmount: 100000,
        requiredRole: 'CFO',
        approvalLevel: 2,
      });

      expect(rule.ruleId).toBe('rule_po_high');
      expect(rule.requestType).toBe('PURCHASE_ORDER');
      expect(rule.requiredRole).toBe('CFO');
      expect(rule.approvalLevel).toBe(2);
    });

    it('should reject creating rule with duplicate ruleId or level', async () => {
      const duplicate = { ruleId: 'rule_po_high' };
      vi.spyOn(ApprovalRuleModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(duplicate),
        then: (resolve: any) => Promise.resolve(duplicate).then(resolve),
      } as any);

      await expect(
        ApprovalRuleService.createRule({
          companyId,
          ruleId: 'rule_po_high',
          ruleName: 'Duplicate Rule',
          requestType: 'PURCHASE_ORDER',
          requiredRole: 'CFO',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should match rules by amount and discount thresholds', async () => {
      const activeRules = [
        {
          ruleId: 'rule_disc_lvl1',
          ruleName: 'Discount 10%',
          requestType: 'DISCOUNT_OVERRIDE',
          minDiscountPercent: 10,
          maxDiscountPercent: 20,
          requiredRole: 'BRANCH_MANAGER',
          approvalLevel: 1,
        },
        {
          ruleId: 'rule_disc_lvl2',
          ruleName: 'Discount 20%+',
          requestType: 'DISCOUNT_OVERRIDE',
          minDiscountPercent: 20,
          requiredRole: 'SALES_DIRECTOR',
          approvalLevel: 2,
        },
      ];

      // Simulate connected state
      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(ApprovalRuleModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          session: vi.fn().mockResolvedValue(activeRules),
          then: (resolve: any) => Promise.resolve(activeRules).then(resolve),
        }),
      } as any);

      const matched = await ApprovalRuleService.matchRulesForRequest(
        companyId,
        'DISCOUNT_OVERRIDE',
        undefined,
        15
      );

      expect(matched.length).toBe(1);
      expect(matched[0].ruleId).toBe('rule_disc_lvl1');
      expect(matched[0].requiredRole).toBe('BRANCH_MANAGER');
    });

    it('should update an existing approval rule', async () => {
      const mockRule: any = {
        companyId,
        ruleId: 'rule_exp_01',
        ruleName: 'Expense Approval',
        requiredRole: 'FINANCE_MANAGER',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(ApprovalRuleModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockRule),
        then: (resolve: any) => Promise.resolve(mockRule).then(resolve),
      } as any);

      const updated = await ApprovalRuleService.updateRule(companyId, 'rule_exp_01', {
        requiredRole: 'FINANCE_DIRECTOR',
        minAmount: 50000,
      });

      expect(updated.requiredRole).toBe('FINANCE_DIRECTOR');
      expect(mockRule.save).toHaveBeenCalled();
    });
  });

  describe('Multi-Tier Step Approvals (ApprovalStepService)', () => {
    it('should approve step 1 and advance to step 2 when multiple steps exist', async () => {
      const mockStep1: any = {
        companyId,
        requestId: 'apr_multi_01',
        stepNumber: 1,
        status: 'PENDING',
        requiredRole: 'BRANCH_MANAGER',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(ApprovalStepModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockStep1),
        then: (resolve: any) => Promise.resolve(mockStep1).then(resolve),
      } as any);

      // Remaining pending step 2 exists
      vi.spyOn(ApprovalStepModel, 'find').mockReturnValue({
        session: vi.fn().mockResolvedValue([{ stepNumber: 2, status: 'PENDING' }]),
        then: (resolve: any) => Promise.resolve([{ stepNumber: 2, status: 'PENDING' }]).then(resolve),
      } as any);

      const result = await ApprovalStepService.approveStep(
        companyId,
        'apr_multi_01',
        1,
        'usr_branch_mgr',
        'Branch level approval granted'
      );

      expect(result.step.status).toBe('APPROVED');
      expect(result.isFullyApproved).toBe(false);
      expect(result.nextStepNumber).toBe(2);
      expect(mockStep1.save).toHaveBeenCalled();
    });

    it('should mark workflow as fully approved when the final step is approved', async () => {
      const mockStep2: any = {
        companyId,
        requestId: 'apr_multi_01',
        stepNumber: 2,
        status: 'PENDING',
        requiredRole: 'GENERAL_MANAGER',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(ApprovalStepModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockStep2),
        then: (resolve: any) => Promise.resolve(mockStep2).then(resolve),
      } as any);

      // No more pending steps
      vi.spyOn(ApprovalStepModel, 'find').mockReturnValue({
        session: vi.fn().mockResolvedValue([]),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
      } as any);

      const result = await ApprovalStepService.approveStep(
        companyId,
        'apr_multi_01',
        2,
        'usr_gm',
        'Executive approval granted'
      );

      expect(result.step.status).toBe('APPROVED');
      expect(result.isFullyApproved).toBe(true);
      expect(result.nextStepNumber).toBeUndefined();
    });
  });

  describe('Approval Audit History (ApprovalHistoryService)', () => {
    it('should record approval actions and retrieve history in chronological order', async () => {
      const mockHistory = [
        {
          historyId: 'hist_01',
          companyId,
          requestId: 'apr_1001',
          action: 'REQUEST_CREATED',
          actorId: 'usr_sales',
          createdAt: new Date('2026-09-27T10:00:00Z'),
        },
        {
          historyId: 'hist_02',
          companyId,
          requestId: 'apr_1001',
          action: 'REQUEST_APPROVED',
          actorId: 'usr_manager',
          createdAt: new Date('2026-09-27T10:15:00Z'),
        },
      ];

      vi.spyOn(ApprovalHistoryModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue(Promise.resolve(mockHistory)),
      } as any);

      const history = await ApprovalHistoryService.getHistoryByRequestId(companyId, 'apr_1001');

      expect(history.length).toBe(2);
      expect(history[0].action).toBe('REQUEST_CREATED');
      expect(history[1].action).toBe('REQUEST_APPROVED');
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
      expect(res.text).toContain('approval_service_up');
    });
  });
});
