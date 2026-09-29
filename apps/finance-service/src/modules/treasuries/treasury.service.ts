import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { ConflictError, NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { TreasuryMovementRecordedEvent } from '@hvac/event-contracts';
import { TreasuryModel, ITreasury, TreasuryType } from './treasury.model.js';
import {
  TreasuryLedgerModel,
  ITreasuryLedger,
  MovementType,
  TreasuryReferenceType,
} from '../treasury-ledger/treasury-ledger.model.js';

export interface CreateTreasuryInput {
  companyId: string;
  code: string;
  name: string;
  type: TreasuryType;
  branchId: string;
  custodianUserId?: string;
  accountId?: string;
  currency?: string;
  initialBalance?: number | string;
}

export interface RecordMovementInput {
  companyId: string;
  treasuryId: string;
  movementType: MovementType;
  amount: number | string;
  referenceType: TreasuryReferenceType;
  referenceId: string;
  description: string;
  performedBy: string;
  journalEntryId?: string;
}

export class TreasuryService {
  public static async createTreasury(
    input: CreateTreasuryInput,
    session?: ClientSession
  ): Promise<ITreasury> {
    const existing = await TreasuryModel.findOne({
      companyId: input.companyId,
      code: input.code,
    }).session(session || null);

    if (existing) {
      throw new ConflictError(`Treasury with code ${input.code} already exists for this company`);
    }

    const treasuryId = randomUUID();
    const initialMoney = Money.from(input.initialBalance || 0, input.currency || 'EGP');

    const [treasury] = await TreasuryModel.create(
      [
        {
          companyId: input.companyId,
          treasuryId,
          code: input.code,
          name: input.name,
          type: input.type,
          branchId: input.branchId,
          custodianUserId: input.custodianUserId,
          accountId: input.accountId,
          currency: input.currency || 'EGP',
          currentBalance: mongoose.Types.Decimal128.fromString(initialMoney.toString()),
          isActive: true,
        },
      ],
      { session }
    );

    return treasury;
  }

  /**
   * Atomically records a movement in the Immutable TreasuryLedger and updates
   * the materialized Treasury.currentBalance within a single MongoDB transaction (Rule 10).
   */
  public static async recordMovement(
    input: RecordMovementInput,
    existingSession?: ClientSession
  ): Promise<{ treasury: ITreasury; movement: ITreasuryLedger }> {
    const runner = async (session: ClientSession) => {
      const treasury = await TreasuryModel.findOne({
        companyId: input.companyId,
        treasuryId: input.treasuryId,
      }).session(session);

      if (!treasury) {
        throw new NotFoundError(`Treasury ${input.treasuryId} not found`);
      }

      if (!treasury.isActive) {
        throw new ValidationError(`Treasury ${treasury.code} is inactive`);
      }

      const movementMoney = Money.from(input.amount, treasury.currency);
      if (!movementMoney.isPositive()) {
        throw new ValidationError('Movement amount must be greater than zero');
      }

      const currentMoney = Money.from(treasury.currentBalance.toString(), treasury.currency);

      let newBalanceMoney: Money;
      if (input.movementType === 'INFLOW') {
        newBalanceMoney = currentMoney.add(movementMoney);
      } else {
        if (currentMoney.isLessThan(movementMoney)) {
          throw new ValidationError(
            `Insufficient treasury balance in ${treasury.name}. Available: ${currentMoney.toString()}, Required: ${movementMoney.toString()}`
          );
        }
        newBalanceMoney = currentMoney.subtract(movementMoney);
      }

      // Materialized balance update (Rule 10)
      treasury.currentBalance = mongoose.Types.Decimal128.fromString(newBalanceMoney.toFixed(2));
      await treasury.save({ session });

      const movementId = randomUUID();
      const [movement] = await TreasuryLedgerModel.create(
        [
          {
            companyId: input.companyId,
            movementId,
            treasuryId: input.treasuryId,
            branchId: treasury.branchId,
            movementType: input.movementType,
            amount: mongoose.Types.Decimal128.fromString(movementMoney.toFixed(2)),
            balanceAfter: mongoose.Types.Decimal128.fromString(newBalanceMoney.toFixed(2)),
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            description: input.description,
            performedBy: input.performedBy,
            journalEntryId: input.journalEntryId,
            timestamp: new Date(),
          },
        ],
        { session }
      );

      // Outbox Event
      const event = new TreasuryMovementRecordedEvent(
        {
          movementId,
          treasuryId: input.treasuryId,
          movementType: input.movementType,
          amount: movementMoney.toNumber(),
          balanceAfter: newBalanceMoney.toNumber(),
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          branchId: treasury.branchId,
        },
        {
          companyId: input.companyId,
          branchId: treasury.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
          actor: { userId: input.performedBy },
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return { treasury, movement };
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getTreasuryById(companyId: string, treasuryId: string): Promise<ITreasury> {
    const treasury = await TreasuryModel.findOne({ companyId, treasuryId });
    if (!treasury) {
      throw new NotFoundError(`Treasury ${treasuryId} not found`);
    }
    return treasury;
  }

  public static async getTreasuriesByBranch(companyId: string, branchId: string): Promise<ITreasury[]> {
    return TreasuryModel.find({ companyId, branchId, isActive: true });
  }

  public static async getLedgerHistory(
    companyId: string,
    treasuryId: string,
    limit: number = 50
  ): Promise<ITreasuryLedger[]> {
    return TreasuryLedgerModel.find({ companyId, treasuryId })
      .sort({ timestamp: -1 })
      .limit(limit);
  }
}
