import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { CustomerModel } from '../../../apps/customer-service/src/modules/customers/customer.model.js';
import { CustomerService } from '../../../apps/customer-service/src/modules/customers/customer.service.js';
import { CustomerAddressModel } from '../../../apps/customer-service/src/modules/customer-addresses/customer-address.model.js';
import { CustomerCreditProfileModel } from '../../../apps/customer-service/src/modules/customer-credit-profiles/customer-credit-profile.model.js';
import { CustomerCreditProfileService } from '../../../apps/customer-service/src/modules/customer-credit-profiles/customer-credit-profile.service.js';
import { CustomerEquipmentModel } from '../../../apps/customer-service/src/modules/customer-equipment/customer-equipment.model.js';
import { CustomerEquipmentService } from '../../../apps/customer-service/src/modules/customer-equipment/customer-equipment.service.js';
import { OutboxEventModel } from '@hvac/database';
import { ValidationError, ConflictError } from '@hvac/errors';

describe('Phase 6: Customer Service Integration Tests', () => {
  const companyId = 'comp_cairo_hvac';
  const branchId = 'br_nasr_city';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Customer Profiles & Multi-tenant Hierarchy', () => {
    it('should create an individual customer with initial installation address and emit outbox event', async () => {
      const mockCustomer = {
        companyId,
        customerId: 'cust_ahmed_01',
        customerNumber: 'CUST-2026-1001',
        name: 'Ahmed Mohamed',
        type: 'INDIVIDUAL',
        phone: '+201012345678',
        branchId,
        creditLimit: mongoose.Types.Decimal128.fromString('0.00'),
        outstandingBalance: mongoose.Types.Decimal128.fromString('0.00'),
        isActive: true,
      };

      vi.spyOn(CustomerModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      } as any);
      vi.spyOn(CustomerModel, 'create').mockResolvedValueOnce([mockCustomer] as any);
      vi.spyOn(CustomerAddressModel, 'create').mockResolvedValueOnce([{} as any]);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const customer = await CustomerService.createCustomer({
        companyId,
        name: 'Ahmed Mohamed',
        type: 'INDIVIDUAL',
        phone: '+201012345678',
        branchId,
        initialAddress: {
          title: 'Home Villa',
          governorate: 'Cairo',
          city: 'Nasr City',
          street: 'Makram Ebeid St.',
          buildingNumber: '12',
        },
      });

      expect(customer.name).toBe('Ahmed Mohamed');
      expect(customer.phone).toBe('+201012345678');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject customer creation with duplicate phone number in same company', async () => {
      vi.spyOn(CustomerModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue({ phone: '+201012345678' }),
      } as any);

      await expect(
        CustomerService.createCustomer({
          companyId,
          name: 'Another Customer',
          phone: '+201012345678',
          branchId,
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Commercial Credit Limits & Eligibility Verification', () => {
    it('should update credit limit with exact Decimal128 and emit outbox event', async () => {
      const mockCustomer: any = {
        companyId,
        customerId: 'cust_corp_01',
        name: 'El Sewedy Electric',
        type: 'COMMERCIAL',
        branchId,
        creditLimit: mongoose.Types.Decimal128.fromString('100000.00'),
        outstandingBalance: mongoose.Types.Decimal128.fromString('0.00'),
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(CustomerModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockCustomer),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const updated = await CustomerService.updateCreditLimit(
        companyId,
        'cust_corp_01',
        '250000.00',
        'Annual contract expansion'
      );

      expect(updated.creditLimit.toString()).toBe('250000.00');
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should correctly evaluate credit limit eligibility based on outstanding balance', async () => {
      const mockCustomer = {
        companyId,
        customerId: 'cust_corp_01',
        creditLimit: mongoose.Types.Decimal128.fromString('200000.00'),
        outstandingBalance: mongoose.Types.Decimal128.fromString('150000.00'),
      };

      vi.spyOn(CustomerModel, 'findOne').mockResolvedValue(mockCustomer as any);

      // Order 40,000 <= 50,000 available: eligible
      const check1 = await CustomerService.verifyCreditLimit(companyId, 'cust_corp_01', '40000.00');
      expect(check1.eligible).toBe(true);
      expect(check1.availableCredit).toBe(50000);

      // Order 60,000 > 50,000 available: not eligible
      const check2 = await CustomerService.verifyCreditLimit(companyId, 'cust_corp_01', '60000.00');
      expect(check2.eligible).toBe(false);
    });
  });

  describe('Multi-Site Address Management', () => {
    it('should add secondary installation site to customer profile', async () => {
      const mockCustomer = { companyId, customerId: 'cust_ahmed_01' };
      const mockAddress = {
        companyId,
        addressId: 'addr_chalet_01',
        customerId: 'cust_ahmed_01',
        title: 'North Coast Chalet',
        governorate: 'Matrouh',
        city: 'Marina',
        street: 'Gate 4, Villa 12',
      };

      vi.spyOn(CustomerModel, 'findOne').mockResolvedValueOnce(mockCustomer as any);
      vi.spyOn(CustomerAddressModel, 'create').mockResolvedValueOnce([mockAddress] as any);

      const address = await CustomerService.addAddress({
        companyId,
        customerId: 'cust_ahmed_01',
        title: 'North Coast Chalet',
        governorate: 'Matrouh',
        city: 'Marina',
        street: 'Gate 4, Villa 12',
      });

      expect(address.title).toBe('North Coast Chalet');
      expect(address.city).toBe('Marina');
    });
  });

  describe('Commercial Credit Profiles & Risk Evaluation', () => {
    it('should upsert credit profile, update customer credit limit and emit outbox event', async () => {
      const mockCustomer: any = {
        companyId,
        branchId,
        customerId: 'cust_corp_02',
        name: 'Arab Contractors',
        creditLimit: mongoose.Types.Decimal128.fromString('100000.00'),
        save: vi.fn().mockResolvedValue(true),
      };

      const mockProfile: any = {
        companyId,
        customerId: 'cust_corp_02',
        creditRating: 'A',
        creditStatus: 'ACTIVE',
        approvedCreditLimit: mongoose.Types.Decimal128.fromString('500000.00'),
        paymentTermsDays: 60,
      };

      vi.spyOn(CustomerModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockCustomer),
      } as any);
      vi.spyOn(CustomerCreditProfileModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      } as any);
      vi.spyOn(CustomerCreditProfileModel, 'create').mockResolvedValueOnce([mockProfile] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const profile = await CustomerCreditProfileService.upsertProfile({
        companyId,
        customerId: 'cust_corp_02',
        creditRating: 'A',
        approvedCreditLimit: '500000.00',
        paymentTermsDays: 60,
        guarantees: { bankGuarantee: true },
        reviewedBy: 'usr_risk_manager_tamer',
      });

      expect(profile.creditRating).toBe('A');
      expect(profile.approvedCreditLimit.toString()).toBe('500000.00');
      expect(mockCustomer.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should block customer credit and emit customer.credit.blocked event', async () => {
      const mockCustomer: any = {
        companyId,
        branchId,
        customerId: 'cust_corp_02',
      };

      const mockProfile: any = {
        companyId,
        customerId: 'cust_corp_02',
        creditStatus: 'ACTIVE',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(CustomerModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockCustomer),
      } as any);
      vi.spyOn(CustomerCreditProfileModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockProfile),
      } as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const blocked = await CustomerCreditProfileService.blockCredit(
        companyId,
        'cust_corp_02',
        'Overdue payment exceeding 90 days',
        'usr_finance_director'
      );

      expect(blocked.creditStatus).toBe('BLOCKED');
      expect(blocked.blockReason).toBe('Overdue payment exceeding 90 days');
      expect(mockProfile.save).toHaveBeenCalled();
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should evaluate comprehensive credit eligibility considering credit status and requested amount', async () => {
      const mockCustomer = {
        companyId,
        customerId: 'cust_corp_02',
        creditLimit: mongoose.Types.Decimal128.fromString('500000.00'),
        outstandingBalance: mongoose.Types.Decimal128.fromString('100000.00'),
      };

      const mockProfile = {
        companyId,
        customerId: 'cust_corp_02',
        creditStatus: 'ACTIVE',
        creditRating: 'A',
        approvedCreditLimit: mongoose.Types.Decimal128.fromString('500000.00'),
        usedCredit: mongoose.Types.Decimal128.fromString('100000.00'),
      };

      vi.spyOn(CustomerModel, 'findOne').mockResolvedValue(mockCustomer as any);
      vi.spyOn(CustomerCreditProfileModel, 'findOne').mockResolvedValue(mockProfile as any);

      // Available 400,000, Request 300,000 -> eligible
      const check1 = await CustomerCreditProfileService.evaluateCreditEligibility(
        companyId,
        'cust_corp_02',
        '300000.00'
      );
      expect(check1.eligible).toBe(true);
      expect(check1.availableCredit).toBe(400000);

      // Available 400,000, Request 450,000 -> not eligible
      const check2 = await CustomerCreditProfileService.evaluateCreditEligibility(
        companyId,
        'cust_corp_02',
        '450000.00'
      );
      expect(check2.eligible).toBe(false);
    });
  });

  describe('Customer Equipment & Installed Asset Tracking', () => {
    it('should register customer AC unit with 5-year warranty and emit customer.equipment.registered event', async () => {
      const mockCustomer = { companyId, customerId: 'cust_ahmed_01' };
      const mockAddress = { companyId, addressId: 'addr_chalet_01' };

      const mockEquipment = {
        companyId,
        branchId,
        equipmentId: 'eq_carrier_3hp_01',
        customerId: 'cust_ahmed_01',
        addressId: 'addr_chalet_01',
        serialNumber: 'SN-CR3HP-998877',
        brand: 'Carrier',
        equipmentType: 'SPLIT',
        capacityHP: 3,
        warrantyStatus: 'ACTIVE',
      };

      vi.spyOn(CustomerModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockCustomer),
      } as any);
      vi.spyOn(CustomerAddressModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockAddress),
      } as any);
      vi.spyOn(CustomerEquipmentModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(null),
      } as any);
      vi.spyOn(CustomerEquipmentModel, 'create').mockResolvedValueOnce([mockEquipment] as any);
      const outboxSpy = vi.spyOn(OutboxEventModel, 'create').mockResolvedValueOnce([{} as any]);

      const equipment = await CustomerEquipmentService.registerEquipment({
        companyId,
        branchId,
        customerId: 'cust_ahmed_01',
        addressId: 'addr_chalet_01',
        serialNumber: 'SN-CR3HP-998877',
        brand: 'Carrier',
        equipmentType: 'SPLIT',
        capacityHP: 3,
        installationDate: new Date('2026-05-01'),
      });

      expect(equipment.serialNumber).toBe('SN-CR3HP-998877');
      expect(equipment.brand).toBe('Carrier');
      expect(outboxSpy).toHaveBeenCalled();
    });

    it('should reject duplicate equipment serial number within same company', async () => {
      const mockCustomer = { companyId, customerId: 'cust_ahmed_01' };
      const mockAddress = { companyId, addressId: 'addr_chalet_01' };

      vi.spyOn(CustomerModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockCustomer),
      } as any);
      vi.spyOn(CustomerAddressModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue(mockAddress),
      } as any);
      vi.spyOn(CustomerEquipmentModel, 'findOne').mockReturnValue({
        session: vi.fn().mockResolvedValue({ serialNumber: 'SN-CR3HP-998877' }),
      } as any);

      await expect(
        CustomerEquipmentService.registerEquipment({
          companyId,
          branchId,
          customerId: 'cust_ahmed_01',
          addressId: 'addr_chalet_01',
          serialNumber: 'SN-CR3HP-998877',
          brand: 'Carrier',
          installationDate: new Date('2026-05-01'),
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should add maintenance service history record to equipment', async () => {
      const mockEquipment: any = {
        companyId,
        equipmentId: 'eq_carrier_3hp_01',
        serviceHistory: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(CustomerEquipmentModel, 'findOne').mockResolvedValueOnce(mockEquipment);

      const updated = await CustomerEquipmentService.addServiceRecord({
        companyId,
        equipmentId: 'eq_carrier_3hp_01',
        serviceType: 'PERIODIC_MAINTENANCE',
        description: 'Cleaned indoor filters, recharged R410A refrigerant',
        technicianId: 'tech_tariq_01',
      });

      expect(updated.serviceHistory).toHaveLength(1);
      expect(updated.serviceHistory[0].serviceType).toBe('PERIODIC_MAINTENANCE');
      expect(mockEquipment.save).toHaveBeenCalled();
    });

    it('should verify warranty status accurately and calculate remaining days', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 365); // 1 year left

      const mockEquipment = {
        companyId,
        equipmentId: 'eq_carrier_3hp_01',
        warrantyStatus: 'ACTIVE',
        warrantyStartDate: new Date('2025-01-01'),
        warrantyEndDate: futureDate,
      };

      vi.spyOn(CustomerEquipmentModel, 'findOne').mockResolvedValueOnce(mockEquipment as any);

      const verification = await CustomerEquipmentService.verifyWarranty(
        companyId,
        'eq_carrier_3hp_01'
      );

      expect(verification.isUnderWarranty).toBe(true);
      expect(verification.warrantyStatus).toBe('ACTIVE');
      expect(verification.remainingDays).toBeGreaterThan(360);
    });
  });
});
