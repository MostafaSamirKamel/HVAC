import { randomUUID } from 'crypto';
import { ClientSession } from 'mongoose';
import { ConflictError, NotFoundError } from '@hvac/errors';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { WarrantyRegisteredEvent } from '@hvac/event-contracts';
import { WarrantyModel, IWarranty } from './warranty.model.js';

export interface RegisterWarrantyInput {
  companyId: string;
  serialNumber: string;
  productId: string;
  customerId: string;
  workOrderId?: string;
  startDate?: Date;
  machineWarrantyYears?: number; // default 2
  compressorWarrantyYears?: number; // default 5
  terms?: string;
  branchId: string;
}

export class WarrantyService {
  public static async registerWarranty(
    input: RegisterWarrantyInput,
    existingSession?: ClientSession
  ): Promise<IWarranty> {
    const runner = async (session: ClientSession) => {
      const existing = await WarrantyModel.findOne({
        companyId: input.companyId,
        serialNumber: input.serialNumber,
      }).session(session);

      if (existing) {
        throw new ConflictError(`Warranty for serial number ${input.serialNumber} already registered`);
      }

      const warrantyId = randomUUID();
      const startDate = input.startDate || new Date();
      const machineYears = input.machineWarrantyYears || 2;
      const compressorYears = input.compressorWarrantyYears || 5;

      const machineExpiryDate = new Date(startDate.getTime());
      machineExpiryDate.setFullYear(machineExpiryDate.getFullYear() + machineYears);

      const compressorExpiryDate = new Date(startDate.getTime());
      compressorExpiryDate.setFullYear(compressorExpiryDate.getFullYear() + compressorYears);

      const [warranty] = await WarrantyModel.create(
        [
          {
            companyId: input.companyId,
            warrantyId,
            serialNumber: input.serialNumber,
            productId: input.productId,
            customerId: input.customerId,
            workOrderId: input.workOrderId,
            startDate,
            machineExpiryDate,
            compressorExpiryDate,
            status: 'ACTIVE',
            terms: input.terms || 'Standard Manufacturer Warranty Coverage',
          },
        ],
        { session }
      );

      // Outbox Event
      const event = new WarrantyRegisteredEvent(
        {
          warrantyId,
          serialNumber: input.serialNumber,
          productId: input.productId,
          customerId: input.customerId,
          startDate: startDate.toISOString(),
          machineExpiryDate: machineExpiryDate.toISOString(),
          compressorExpiryDate: compressorExpiryDate.toISOString(),
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

      return warranty;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async checkCoverage(
    companyId: string,
    serialNumber: string
  ): Promise<{
    isValid: boolean;
    isMachineCovered: boolean;
    isCompressorCovered: boolean;
    warranty?: IWarranty;
  }> {
    const warranty = await WarrantyModel.findOne({ companyId, serialNumber });
    if (!warranty || warranty.status !== 'ACTIVE') {
      return { isValid: false, isMachineCovered: false, isCompressorCovered: false };
    }

    const now = new Date();
    const isMachineCovered = now <= warranty.machineExpiryDate;
    const isCompressorCovered = now <= warranty.compressorExpiryDate;

    return {
      isValid: isMachineCovered || isCompressorCovered,
      isMachineCovered,
      isCompressorCovered,
      warranty,
    };
  }
}
