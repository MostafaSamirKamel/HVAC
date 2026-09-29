import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { ConflictError, NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import {
  TechnicianSettlementSubmittedEvent,
  TechnicianCommissionEarnedEvent,
} from '@hvac/event-contracts';
import { TechnicianModel, ITechnician, TechnicianStatus } from './technician.model.js';
import {
  TechnicianSettlementModel,
  ITechnicianSettlement,
  IUsedPart,
} from '../settlements/settlement.model.js';

export interface CreateTechnicianInput {
  companyId: string;
  code: string;
  name: string;
  phone: string;
  branchId: string;
  skills?: string[];
  vanWarehouseId?: string;
  userId?: string;
}

export interface SubmitSettlementInput {
  companyId: string;
  technicianId: string;
  branchId: string;
  treasuryId?: string;
  cashCollected: number | string;
  usedSpareParts?: IUsedPart[];
  returnedSpareParts?: IUsedPart[];
  notes?: string;
}

export class TechnicianService {
  public static async createTechnician(
    input: CreateTechnicianInput,
    session?: ClientSession
  ): Promise<ITechnician> {
    const query = TechnicianModel.findOne({ companyId: input.companyId, code: input.code });
    const existing = session ? await query.session(session) : await query;

    if (existing) {
      throw new ConflictError(`Technician with code ${input.code} already exists`);
    }

    const technicianId = randomUUID();

    const [tech] = await TechnicianModel.create(
      [
        {
          companyId: input.companyId,
          technicianId,
          userId: input.userId,
          code: input.code,
          name: input.name,
          phone: input.phone,
          branchId: input.branchId,
          skills: input.skills || [],
          vanWarehouseId: input.vanWarehouseId,
          totalCommissionEarned: mongoose.Types.Decimal128.fromString('0.00'),
          currentCashCustody: mongoose.Types.Decimal128.fromString('0.00'),
          status: 'IDLE',
          isActive: true,
        },
      ],
      { session }
    );

    return tech;
  }

  public static async recordCommission(
    companyId: string,
    technicianId: string,
    workOrderId: string,
    amount: number | string,
    reason: string = 'Work Order Commission',
    existingSession?: ClientSession
  ): Promise<ITechnician> {
    const runner = async (session: ClientSession) => {
      const tech = await TechnicianModel.findOne({ companyId, technicianId }).session(session);
      if (!tech) {
        throw new NotFoundError(`Technician ${technicianId} not found`);
      }

      const commissionMoney = Money.from(amount, 'EGP');
      const currentEarned = Money.from(tech.totalCommissionEarned.toString(), 'EGP');
      const newTotalMoney = currentEarned.add(commissionMoney);

      tech.totalCommissionEarned = mongoose.Types.Decimal128.fromString(newTotalMoney.toFixed(2));
      await tech.save({ session });

      const event = new TechnicianCommissionEarnedEvent(
        {
          technicianId,
          workOrderId,
          commissionAmount: commissionMoney.toNumber(),
          reason,
          branchId: tech.branchId,
        },
        {
          companyId,
          branchId: tech.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return tech;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async submitDailySettlement(
    input: SubmitSettlementInput,
    existingSession?: ClientSession
  ): Promise<ITechnicianSettlement> {
    const runner = async (session: ClientSession) => {
      const tech = await TechnicianModel.findOne({
        companyId: input.companyId,
        technicianId: input.technicianId,
      }).session(session);

      if (!tech) {
        throw new NotFoundError(`Technician ${input.technicianId} not found`);
      }

      const cashMoney = Money.from(input.cashCollected, 'EGP');
      const settlementId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const settlementNumber = `STL-${new Date().getFullYear()}-${randomSuffix}`;
      const now = new Date();

      const [settlement] = await TechnicianSettlementModel.create(
        [
          {
            companyId: input.companyId,
            settlementId,
            settlementNumber,
            technicianId: input.technicianId,
            branchId: input.branchId,
            treasuryId: input.treasuryId,
            cashCollected: mongoose.Types.Decimal128.fromString(cashMoney.toFixed(2)),
            usedSpareParts: input.usedSpareParts || [],
            returnedSpareParts: input.returnedSpareParts || [],
            status: 'SUBMITTED',
            notes: input.notes,
            submittedAt: now,
          },
        ],
        { session }
      );

      // Reset / adjust technician cash custody
      const currentCustody = Money.from(tech.currentCashCustody.toString(), 'EGP');
      const newCustody = currentCustody.isGreaterThan(cashMoney)
        ? currentCustody.subtract(cashMoney)
        : Money.from(0, 'EGP');
      tech.currentCashCustody = mongoose.Types.Decimal128.fromString(newCustody.toFixed(2));
      await tech.save({ session });

      // Outbox Event (triggers treasury cash receipt in Finance Service)
      const event = new TechnicianSettlementSubmittedEvent(
        {
          settlementId,
          technicianId: input.technicianId,
          branchId: input.branchId,
          totalCashCollected: cashMoney.toNumber(),
          treasuryId: input.treasuryId,
          settledAt: now.toISOString(),
          usedSpareParts: input.usedSpareParts || [],
          returnedSpareParts: input.returnedSpareParts || [],
        },
        {
          companyId: input.companyId,
          branchId: input.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return settlement;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getTechnicianById(
    companyId: string,
    technicianId: string
  ): Promise<ITechnician> {
    const tech = await TechnicianModel.findOne({ companyId, technicianId });
    if (!tech) {
      throw new NotFoundError(`Technician ${technicianId} not found`);
    }
    return tech;
  }

  public static async listTechnicians(
    companyId: string,
    filter: { branchId?: string; status?: TechnicianStatus }
  ): Promise<ITechnician[]> {
    const query: Record<string, unknown> = { companyId, isActive: true };
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.status) query.status = filter.status;

    return TechnicianModel.find(query).sort({ name: 1 });
  }
}
