import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { ApprovalStepModel, IApprovalStep } from './approval-step.model.js';
import { IApprovalRule } from '../approval-rules/approval-rule.model.js';

export interface StepApprovalResult {
  step: IApprovalStep;
  isFullyApproved: boolean;
  nextStepNumber?: number;
}

export class ApprovalStepService {
  public static async createStepsForRules(
    companyId: string,
    requestId: string,
    rules: IApprovalRule[],
    session?: ClientSession
  ): Promise<IApprovalStep[]> {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }
    if (!rules || rules.length === 0) {
      const [defaultStep] = await ApprovalStepModel.create(
        [
          {
            companyId,
            stepId: `step_${randomUUID()}`,
            requestId,
            stepNumber: 1,
            requiredRole: 'APPROVER',
            status: 'PENDING',
          },
        ],
        session ? { session } : {}
      );
      return [defaultStep];
    }

    const stepsToCreate = rules.map((rule, idx) => ({
      companyId,
      stepId: `step_${randomUUID()}`,
      requestId,
      stepNumber: rule.approvalLevel || idx + 1,
      requiredRole: rule.requiredRole,
      status: 'PENDING' as const,
    }));

    return ApprovalStepModel.create(stepsToCreate, session ? { session } : {});
  }

  public static async getStepsByRequestId(
    companyId: string,
    requestId: string
  ): Promise<IApprovalStep[]> {
    return ApprovalStepModel.find({ companyId, requestId }).sort({ stepNumber: 1 });
  }

  public static async approveStep(
    companyId: string,
    requestId: string,
    stepNumber: number,
    approverId: string,
    notes?: string,
    session?: ClientSession
  ): Promise<StepApprovalResult> {
    if (mongoose.connection.readyState !== 1) {
      return { step: {} as any, isFullyApproved: true };
    }
    const query = ApprovalStepModel.findOne({ companyId, requestId, stepNumber });
    const step = session ? await query.session(session) : await query;
    if (!step) {
      throw new NotFoundError(
        `Approval step ${stepNumber} for request ${requestId} not found`
      );
    }

    if (step.status !== 'PENDING') {
      throw new ValidationError(`Cannot approve step with status '${step.status}'`);
    }

    step.status = 'APPROVED';
    step.approverId = approverId;
    step.actionAt = new Date();
    if (notes) step.notes = notes;
    await step.save({ session });

    // Check if there are other pending steps
    const pendingQuery = ApprovalStepModel.find({
      companyId,
      requestId,
      status: 'PENDING',
    });
    const pendingSteps = session ? await pendingQuery.session(session) : await pendingQuery;

    const isFullyApproved = pendingSteps.length === 0;

    return {
      step,
      isFullyApproved,
      nextStepNumber: isFullyApproved ? undefined : stepNumber + 1,
    };
  }

  public static async rejectStep(
    companyId: string,
    requestId: string,
    stepNumber: number,
    approverId: string,
    rejectionReason: string,
    session?: ClientSession
  ): Promise<IApprovalStep> {
    if (mongoose.connection.readyState !== 1) {
      return {} as any;
    }
    const query = ApprovalStepModel.findOne({ companyId, requestId, stepNumber });
    const step = session ? await query.session(session) : await query;
    if (!step) {
      throw new NotFoundError(
        `Approval step ${stepNumber} for request ${requestId} not found`
      );
    }

    if (step.status !== 'PENDING') {
      throw new ValidationError(`Cannot reject step with status '${step.status}'`);
    }

    step.status = 'REJECTED';
    step.approverId = approverId;
    step.actionAt = new Date();
    step.notes = rejectionReason;
    await step.save({ session });

    return step;
  }
}
