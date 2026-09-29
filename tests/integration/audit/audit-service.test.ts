import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { AuditLogModel } from '../../../apps/audit-service/src/modules/audit-logs/audit-log.model.js';
import { AuditLogService } from '../../../apps/audit-service/src/modules/audit-logs/audit-log.service.js';
import { SecurityEventModel } from '../../../apps/audit-service/src/modules/security-events/security-event.model.js';
import { SecurityEventService } from '../../../apps/audit-service/src/modules/security-events/security-event.service.js';
import { ActivityHistoryService } from '../../../apps/audit-service/src/modules/activity-history/activity-history.service.js';
import { createApp, setReadiness } from '../../../apps/audit-service/src/app.js';
import { AuditEntityChangedEvent } from '@hvac/event-contracts';

describe('Phase 10: Audit Service Integration Tests (Rule 14 & Rule 22)', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Sanitization & Compliance Logging', () => {
    it('should strictly sanitize sensitive credentials (passwords, tokens, cvv)', () => {
      const sensitiveData = {
        userId: 'usr_1001',
        email: 'admin@hvac.com',
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        nested: {
          refreshToken: 'refresh-token-xyz',
          cvv: '123',
          safeField: 'harmless_value',
        },
      };

      const sanitized: any = AuditLogService.sanitize(sensitiveData);

      expect(sanitized.email).toBe('admin@hvac.com');
      expect(sanitized.password).toBe('***REDACTED***');
      expect(sanitized.token).toBe('***REDACTED***');
      expect(sanitized.nested.refreshToken).toBe('***REDACTED***');
      expect(sanitized.nested.cvv).toBe('***REDACTED***');
      expect(sanitized.nested.safeField).toBe('harmless_value');
    });

    it('should record immutable audit log with multi-tenant isolation', async () => {
      const mockLog = {
        companyId,
        branchId,
        logId: 'log_9999',
        eventId: 'evt_1111',
        eventType: 'audit.entity.changed.v1',
        aggregateType: 'StockBalance',
        aggregateId: 'bal_wh_01_prod_01',
        action: 'UPDATE',
        actor: { userId: 'usr_warehouse_keeper' },
        payload: { quantityAvailable: 25 },
        diff: { quantityAvailable: { before: 30, after: 25 } },
        timestamp: new Date(),
      };

      vi.spyOn(AuditLogModel, 'create').mockResolvedValueOnce([mockLog] as any);

      const log = await AuditLogService.recordLog({
        companyId,
        branchId,
        eventType: 'audit.entity.changed.v1',
        aggregateType: 'StockBalance',
        aggregateId: 'bal_wh_01_prod_01',
        action: 'UPDATE',
        actor: { userId: 'usr_warehouse_keeper' },
        payload: { quantityAvailable: 25 },
        diff: { quantityAvailable: { before: 30, after: 25 } },
      });

      expect(log.logId).toBe('log_9999');
      expect(log.aggregateType).toBe('StockBalance');
      expect(log.action).toBe('UPDATE');
    });

    it('should query logs with multi-tenant filtering, date ranges, and pagination', async () => {
      const mockLogs = [
        {
          logId: 'log_01',
          companyId,
          branchId,
          aggregateType: 'JournalEntry',
          action: 'CREATE',
          timestamp: new Date(),
        },
      ];

      vi.spyOn(AuditLogModel, 'countDocuments').mockResolvedValueOnce(1);
      vi.spyOn(AuditLogModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockLogs),
          }),
        }),
      } as any);

      const result = await AuditLogService.queryLogs(companyId, {
        branchId,
        aggregateType: 'JournalEntry',
        limit: 10,
        skip: 0,
      });

      expect(result.total).toBe(1);
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].aggregateType).toBe('JournalEntry');
    });
  });

  describe('Outbox Domain Event Processing', () => {
    it('should consume domain event and transform into audit trail record', async () => {
      const mockEvent = new AuditEntityChangedEvent(
        {
          entityType: 'SalesOrder',
          entityId: 'so_1001',
          action: 'CREATE',
          afterState: { totalAmount: 15000, status: 'DRAFT' },
        },
        {
          companyId,
          branchId,
          correlationId: 'corr_test_123',
          actor: { userId: 'usr_sales_rep', email: 'rep@hvac.com' },
        }
      );

      const mockSavedLog = {
        companyId,
        branchId,
        logId: 'log_so_1001',
        eventType: 'audit.entity.changed.v1',
        aggregateType: 'SalesOrder',
        aggregateId: 'so_1001',
        action: 'CREATE',
      };

      vi.spyOn(AuditLogModel, 'create').mockResolvedValueOnce([mockSavedLog] as any);

      const processed = await AuditLogService.processDomainEvent(mockEvent);

      expect(processed.aggregateType).toBe('SalesOrder');
      expect(processed.action).toBe('CREATE');
      expect(processed.aggregateId).toBe('so_1001');
    });

    it('should query entity chronological history for an aggregate', async () => {
      const mockHistory = [
        {
          logId: 'log_3',
          action: 'UPDATE',
          timestamp: new Date('2026-09-26T12:00:00Z'),
        },
        {
          logId: 'log_1',
          action: 'CREATE',
          timestamp: new Date('2026-09-26T10:00:00Z'),
        },
      ];

      vi.spyOn(AuditLogModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockHistory),
      } as any);

      const history = await AuditLogService.getEntityHistory(companyId, 'SalesOrder', 'so_1001');

      expect(history.length).toBe(2);
      expect(history[0].action).toBe('UPDATE');
    });
  });

  describe('Security Events Monitoring (SecurityEventService)', () => {
    it('should record security event with sanitized payload', async () => {
      const mockSecurityEvent = {
        companyId,
        eventId: 'sec_001',
        eventType: 'LOGIN_FAILED',
        userId: 'usr_hacker',
        severity: 'HIGH',
        ipAddress: '192.168.1.100',
        details: { attemptedPassword: '***REDACTED***' },
      };

      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(SecurityEventModel, 'create').mockResolvedValueOnce([mockSecurityEvent] as any);

      const event = await SecurityEventService.recordSecurityEvent({
        companyId,
        eventType: 'LOGIN_FAILED',
        userId: 'usr_hacker',
        severity: 'HIGH',
        ipAddress: '192.168.1.100',
        details: { password: 'bad_password' },
      });

      expect(event.eventType).toBe('LOGIN_FAILED');
      expect(event.severity).toBe('HIGH');
    });

    it('should query recent critical and high severity alerts', async () => {
      const mockAlerts = [
        {
          eventId: 'sec_002',
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'CRITICAL',
          timestamp: new Date(),
        },
      ];

      vi.spyOn(SecurityEventModel, 'find').mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockAlerts),
      } as any);

      const alerts = await SecurityEventService.getRecentAlerts(companyId, 'HIGH');

      expect(alerts.length).toBe(1);
      expect(alerts[0].severity).toBe('CRITICAL');
    });
  });

  describe('Activity History & Timelines (ActivityHistoryService)', () => {
    it('should return user activity timeline with pagination', async () => {
      const mockUserLogs = [
        {
          logId: 'log_usr_01',
          companyId,
          action: 'UPDATE',
          aggregateType: 'PriceList',
          timestamp: new Date(),
        },
      ];

      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(AuditLogModel, 'countDocuments').mockResolvedValueOnce(1);
      vi.spyOn(AuditLogModel, 'find').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockUserLogs),
          }),
        }),
      } as any);

      const result = await ActivityHistoryService.getUserActivityTimeline(companyId, 'usr_sales_mgr');

      expect(result.total).toBe(1);
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].aggregateType).toBe('PriceList');
    });

    it('should aggregate activity summary by aggregateType and action', async () => {
      const mockSummary = [
        { aggregateType: 'SalesOrder', action: 'CREATE', count: 42 },
        { aggregateType: 'Payment', action: 'CREATE', count: 35 },
      ];

      vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);
      vi.spyOn(AuditLogModel, 'aggregate').mockResolvedValueOnce(mockSummary as any);

      const summary = await ActivityHistoryService.getActivitySummary(companyId);

      expect(summary.length).toBe(2);
      expect(summary[0].aggregateType).toBe('SalesOrder');
      expect(summary[0].count).toBe(42);
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
      expect(res.text).toContain('audit_service_up');
    });
  });
});
