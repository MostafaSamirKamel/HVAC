import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import {
  ApprovalHistoryModel,
  IApprovalHistory,
  ApprovalHistoryAction,
} from './approval-history.model.js';

export interface RecordHistoryInput {
  companyId: string;
  requestId: string;
  action: ApprovalHistoryAction | string;
  actorId: string;
  actorRole?: string;
  stepNumber?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export class ApprovalHistoryService {
  public static async recordAction(
    input: RecordHistoryInput,
    session?: ClientSession
  ): Promise<IApprovalHistory> {
    if (mongoose.connection.readyState !== 1) {
      return {} as any;
    }
    const historyId = `hist_${randomUUID()}`;

    const [entry] = await ApprovalHistoryModel.create(
      [
        {
          companyId: input.companyId,
          historyId,
          requestId: input.requestId,
          action: input.action,
          actorId: input.actorId,
          actorRole: input.actorRole,
          stepNumber: input.stepNumber,
          notes: input.notes,
          metadata: input.metadata,
        },
      ],
      session ? { session } : {}
    );

    return entry;
  }

  public static async getHistoryByRequestId(
    companyId: string,
    requestId: string
  ): Promise<IApprovalHistory[]> {
    return ApprovalHistoryModel.find({ companyId, requestId }).sort({ createdAt: 1 });
  }
}
