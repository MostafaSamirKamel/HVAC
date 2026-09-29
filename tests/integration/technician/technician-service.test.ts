import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { TechnicianModel } from '../../../apps/technician-service/src/modules/technicians/technician.model.js';
import { TechnicianService } from '../../../apps/technician-service/src/modules/technicians/technician.service.js';
import { TechnicianSettlementModel } from '../../../apps/technician-service/src/modules/settlements/settlement.model.js';
import { OutboxEventModel } from '@hvac/database';
import { ConflictError, NotFoundError } from '@hvac/errors';

describe('Phase 9: Technician Service Integration Tests', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Technician Profile Management', () => {
    it('should create technician profile with 0 initial custody and commission', async () => {
      const mockTech = {
        companyId,
        technicianId: 'tech_1001',
        code: 'TECH-001',
        name: 'Mahmoud Hassan',
        phone: '01012345678',
        branchId,
        skills: ['VRF_INSTALLATION', 'TROUBLESHOOTING'],
        totalCommissionEarned: mongoose.Types.Decimal128.fromString('0.00'),
        currentCashCustody: mongoose.Types.Decimal128.fromString('0.00'),
        status: 'IDLE',
        isActive: true,
      };

      vi.spyOn(TechnicianModel, 'findOne').mockResolvedValueOnce(null);
      vi.spyOn(TechnicianModel, 'create').mockResolvedValueOnce([mockTech] as any);

      const tech = await TechnicianService.createTechnician({
        companyId,
        code: 'TECH-001',
        name: 'Mahmoud Hassan',
        phone: '01012345678',
        branchId,
        skills: ['VRF_INSTALLATION', 'TROUBLESHOOTING'],
      });

      expect(tech.code).toBe('TECH-001');
      expect(tech.name).toBe('Mahmoud Hassan');
      expect(tech.status).toBe('IDLE');
      expect(tech.totalCommissionEarned.toString()).toBe('0.00');
    });

    it('should reject technician creation if code already exists', async () => {
      vi.spyOn(TechnicianModel, 'findOne').mockResolvedValueOnce({ code: 'TECH-001' } as any);

      await expect(
        TechnicianService.createTechnician({
          companyId,
          code: 'TECH-001',
          name: 'Mahmoud Hassan',
          phone: '01012345678',
          branchId,
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Technician Commissions & Outbox Events', () => {
    it('should record earned commission with exact Money addition and emit outbox event', async () => {
      const mockTech: any = {
        companyId,
        technicianId: 'tech_1001',
        branchId,
        totalCommissionEarned: mongoose.Types.Decimal128.fromString('150.00'),
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(TechnicianModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockTech),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const updated = await TechnicianService.recordCommission(
        companyId,
        'tech_1001',
        'wo_8888',
        250.50,
        'Carrier Inverter Split Installation Bonus'
      );

      expect(mockTech.save).toHaveBeenCalled();
      expect(mockTech.totalCommissionEarned.toString()).toBe('400.50');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should throw NotFoundError if technician does not exist when recording commission', async () => {
      vi.spyOn(TechnicianModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      } as any);

      await expect(
        TechnicianService.recordCommission(companyId, 'tech_non_existent', 'wo_8888', 100)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Daily Settlement & Treasury Integration', () => {
    it('should submit daily settlement, update custody and emit outbox event for finance', async () => {
      const mockTech: any = {
        companyId,
        technicianId: 'tech_1001',
        branchId,
        currentCashCustody: mongoose.Types.Decimal128.fromString('1200.00'),
        save: vi.fn().mockResolvedValue(true),
      };

      const mockSettlement = {
        companyId,
        settlementId: 'stl_5001',
        settlementNumber: 'STL-2026-1234',
        technicianId: 'tech_1001',
        branchId,
        treasuryId: 'trs_main_safe',
        cashCollected: mongoose.Types.Decimal128.fromString('1000.00'),
        status: 'SUBMITTED',
      };

      vi.spyOn(TechnicianModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockTech),
      } as any);
      vi.spyOn(TechnicianSettlementModel, 'create').mockResolvedValueOnce([mockSettlement] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const settlement = await TechnicianService.submitDailySettlement({
        companyId,
        technicianId: 'tech_1001',
        branchId,
        treasuryId: 'trs_main_safe',
        cashCollected: 1000.00,
        usedSpareParts: [{ productId: 'part_copper', quantity: 2 }],
        notes: 'Handover cash after 2 installations',
      });

      expect(settlement.status).toBe('SUBMITTED');
      expect(mockTech.save).toHaveBeenCalled();
      // 1200 - 1000 = 200 remaining custody
      expect(mockTech.currentCashCustody.toString()).toBe('200.00');
      expect(outboxSpy).toHaveBeenCalled();
    });
  });
});
