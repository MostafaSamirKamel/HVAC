import { randomUUID } from 'crypto';
import { ClientSession } from 'mongoose';
import { ConflictError, NotFoundError } from '@hvac/errors';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { CustomerEquipmentRegisteredEvent } from '@hvac/event-contracts';
import {
  CustomerEquipmentModel,
  ICustomerEquipment,
  EquipmentType,
  WarrantyStatus,
} from './customer-equipment.model.js';
import { CustomerModel } from '../customers/customer.model.js';
import { CustomerAddressModel } from '../customer-addresses/customer-address.model.js';

export interface RegisterEquipmentInput {
  companyId: string;
  branchId: string;
  customerId: string;
  addressId: string;
  serialNumber: string;
  brand: string;
  modelNumber?: string;
  equipmentType?: EquipmentType;
  capacityHP?: number;
  capacityTonnage?: number;
  installationDate: Date;
  warrantyYears?: number;
  warrantyEndDate?: Date;
  serviceContractId?: string;
  notes?: string;
}

export interface AddServiceHistoryInput {
  companyId: string;
  equipmentId: string;
  serviceDate?: Date;
  workOrderId?: string;
  technicianId?: string;
  serviceType: string;
  description: string;
}

export class CustomerEquipmentService {
  public static async registerEquipment(
    input: RegisterEquipmentInput,
    existingSession?: ClientSession
  ): Promise<ICustomerEquipment> {
    const runner = async (session: ClientSession) => {
      const customer = await CustomerModel.findOne({
        companyId: input.companyId,
        customerId: input.customerId,
      }).session(session);

      if (!customer) {
        throw new NotFoundError(`Customer ${input.customerId} not found`);
      }

      const address = await CustomerAddressModel.findOne({
        companyId: input.companyId,
        addressId: input.addressId,
      }).session(session);

      if (!address) {
        throw new NotFoundError(`Address ${input.addressId} not found`);
      }

      const existingSerial = await CustomerEquipmentModel.findOne({
        companyId: input.companyId,
        serialNumber: input.serialNumber,
      }).session(session);

      if (existingSerial) {
        throw new ConflictError(
          `Equipment with serial number ${input.serialNumber} already registered`
        );
      }

      const equipmentId = randomUUID();
      const warrantyYears = input.warrantyYears || 5; // Standard 5-year warranty on HVAC compressors/units
      const warrantyStartDate = new Date(input.installationDate);
      const warrantyEndDate =
        input.warrantyEndDate ||
        new Date(
          new Date(input.installationDate).setFullYear(
            warrantyStartDate.getFullYear() + warrantyYears
          )
        );

      const [equipment] = await CustomerEquipmentModel.create(
        [
          {
            companyId: input.companyId,
            branchId: input.branchId,
            equipmentId,
            customerId: input.customerId,
            addressId: input.addressId,
            serialNumber: input.serialNumber,
            brand: input.brand,
            modelNumber: input.modelNumber,
            equipmentType: input.equipmentType || 'SPLIT',
            capacityHP: input.capacityHP,
            capacityTonnage: input.capacityTonnage,
            installationDate: input.installationDate,
            warrantyStartDate,
            warrantyEndDate,
            warrantyStatus: 'ACTIVE',
            serviceContractId: input.serviceContractId,
            notes: input.notes,
            serviceHistory: [],
          },
        ],
        { session }
      );

      const event = new CustomerEquipmentRegisteredEvent(
        {
          equipmentId,
          customerId: input.customerId,
          serialNumber: input.serialNumber,
          brand: input.brand,
          capacityHP: input.capacityHP,
          equipmentType: equipment.equipmentType,
          installationDate: input.installationDate.toISOString(),
          warrantyEndDate: warrantyEndDate.toISOString(),
          branchId: input.branchId,
        },
        {
          companyId: input.companyId,
          branchId: input.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return equipment;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getEquipmentByCustomer(
    companyId: string,
    customerId: string
  ): Promise<ICustomerEquipment[]> {
    return CustomerEquipmentModel.find({ companyId, customerId }).sort({ installationDate: -1 });
  }

  public static async getEquipmentBySerial(
    companyId: string,
    serialNumber: string
  ): Promise<ICustomerEquipment> {
    const equipment = await CustomerEquipmentModel.findOne({ companyId, serialNumber });
    if (!equipment) {
      throw new NotFoundError(`Equipment with serial number ${serialNumber} not found`);
    }
    return equipment;
  }

  public static async getEquipmentById(
    companyId: string,
    equipmentId: string
  ): Promise<ICustomerEquipment> {
    const equipment = await CustomerEquipmentModel.findOne({ companyId, equipmentId });
    if (!equipment) {
      throw new NotFoundError(`Equipment ${equipmentId} not found`);
    }
    return equipment;
  }

  public static async addServiceRecord(
    input: AddServiceHistoryInput,
    session?: ClientSession
  ): Promise<ICustomerEquipment> {
    const query = CustomerEquipmentModel.findOne({
      companyId: input.companyId,
      equipmentId: input.equipmentId,
    });
    const equipment = session ? await query.session(session) : await query;
    if (!equipment) {
      throw new NotFoundError(`Equipment ${input.equipmentId} not found`);
    }

    const serviceDate = input.serviceDate || new Date();
    equipment.serviceHistory.push({
      serviceDate,
      workOrderId: input.workOrderId,
      technicianId: input.technicianId,
      serviceType: input.serviceType,
      description: input.description,
    });
    equipment.lastServiceDate = serviceDate;

    await equipment.save({ session });
    return equipment;
  }

  public static async verifyWarranty(
    companyId: string,
    equipmentId: string
  ): Promise<{
    isUnderWarranty: boolean;
    warrantyStatus: WarrantyStatus;
    warrantyStartDate: Date;
    warrantyEndDate: Date;
    remainingDays: number;
  }> {
    const equipment = await CustomerEquipmentModel.findOne({ companyId, equipmentId });
    if (!equipment) {
      throw new NotFoundError(`Equipment ${equipmentId} not found`);
    }

    const now = new Date();
    const isExpired = now > equipment.warrantyEndDate;
    let warrantyStatus = equipment.warrantyStatus;

    if (isExpired && warrantyStatus === 'ACTIVE') {
      warrantyStatus = 'EXPIRED';
      equipment.warrantyStatus = 'EXPIRED';
      await equipment.save();
    }

    const diffTime = equipment.warrantyEndDate.getTime() - now.getTime();
    const remainingDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    return {
      isUnderWarranty: warrantyStatus === 'ACTIVE' && !isExpired,
      warrantyStatus,
      warrantyStartDate: equipment.warrantyStartDate,
      warrantyEndDate: equipment.warrantyEndDate,
      remainingDays,
    };
  }
}
