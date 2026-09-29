import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { ConflictError, NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { ApprovalRuleModel, IApprovalRule } from './approval-rule.model.js';

export interface CreateApprovalRuleInput {
  companyId: string;
  branchId?: string;
  ruleId?: string;
  ruleName: string;
  requestType: string;
  minAmount?: number | string;
  maxAmount?: number | string;
  minDiscountPercent?: number;
  maxDiscountPercent?: number;
  requiredRole: string;
  approvalLevel?: number;
  autoApproveBelowMin?: boolean;
  isActive?: boolean;
  description?: string;
}

export interface UpdateApprovalRuleInput {
  ruleName?: string;
  minAmount?: number | string | null;
  maxAmount?: number | string | null;
  minDiscountPercent?: number | null;
  maxDiscountPercent?: number | null;
  requiredRole?: string;
  approvalLevel?: number;
  autoApproveBelowMin?: boolean;
  isActive?: boolean;
  description?: string;
}

export interface ListApprovalRulesFilter {
  requestType?: string;
  isActive?: boolean;
  branchId?: string;
}

export class ApprovalRuleService {
  public static async createRule(
    input: CreateApprovalRuleInput,
    session?: ClientSession
  ): Promise<IApprovalRule> {
    const ruleId = input.ruleId || `rule_${randomUUID()}`;
    const approvalLevel = input.approvalLevel ?? 1;

    // Check conflict
    const existingQuery = ApprovalRuleModel.findOne({
      companyId: input.companyId,
      $or: [
        { ruleId },
        {
          requestType: input.requestType,
          approvalLevel,
          ...(input.branchId ? { branchId: input.branchId } : { branchId: { $exists: false } }),
        },
      ],
    });
    const existing = session ? await existingQuery.session(session) : await existingQuery;
    if (existing) {
      throw new ConflictError(
        `Approval rule with id '${ruleId}' or level ${approvalLevel} for '${input.requestType}' already exists`
      );
    }

    let minAmountDecimal: mongoose.Types.Decimal128 | undefined;
    let maxAmountDecimal: mongoose.Types.Decimal128 | undefined;

    if (input.minAmount !== undefined && input.minAmount !== null) {
      const minMoney = Money.from(input.minAmount, 'EGP');
      minAmountDecimal = mongoose.Types.Decimal128.fromString(minMoney.toFixed(2));
    }
    if (input.maxAmount !== undefined && input.maxAmount !== null) {
      const maxMoney = Money.from(input.maxAmount, 'EGP');
      maxAmountDecimal = mongoose.Types.Decimal128.fromString(maxMoney.toFixed(2));
    }

    const [rule] = await ApprovalRuleModel.create(
      [
        {
          companyId: input.companyId,
          branchId: input.branchId,
          ruleId,
          ruleName: input.ruleName,
          requestType: input.requestType,
          minAmount: minAmountDecimal,
          maxAmount: maxAmountDecimal,
          minDiscountPercent: input.minDiscountPercent,
          maxDiscountPercent: input.maxDiscountPercent,
          requiredRole: input.requiredRole,
          approvalLevel,
          autoApproveBelowMin: input.autoApproveBelowMin ?? false,
          isActive: input.isActive ?? true,
          description: input.description,
        },
      ],
      { session }
    );

    return rule;
  }

  public static async updateRule(
    companyId: string,
    ruleId: string,
    update: UpdateApprovalRuleInput,
    session?: ClientSession
  ): Promise<IApprovalRule> {
    const query = ApprovalRuleModel.findOne({ companyId, ruleId });
    const rule = session ? await query.session(session) : await query;
    if (!rule) {
      throw new NotFoundError(`Approval rule '${ruleId}' not found`);
    }

    if (update.ruleName !== undefined) rule.ruleName = update.ruleName;
    if (update.requiredRole !== undefined) rule.requiredRole = update.requiredRole;
    if (update.approvalLevel !== undefined) rule.approvalLevel = update.approvalLevel;
    if (update.autoApproveBelowMin !== undefined) rule.autoApproveBelowMin = update.autoApproveBelowMin;
    if (update.isActive !== undefined) rule.isActive = update.isActive;
    if (update.description !== undefined) rule.description = update.description;
    if (update.minDiscountPercent !== undefined) {
      rule.minDiscountPercent = update.minDiscountPercent === null ? undefined : update.minDiscountPercent;
    }
    if (update.maxDiscountPercent !== undefined) {
      rule.maxDiscountPercent = update.maxDiscountPercent === null ? undefined : update.maxDiscountPercent;
    }

    if (update.minAmount !== undefined) {
      if (update.minAmount === null) {
        rule.minAmount = undefined;
      } else {
        const money = Money.from(update.minAmount, 'EGP');
        rule.minAmount = mongoose.Types.Decimal128.fromString(money.toFixed(2));
      }
    }

    if (update.maxAmount !== undefined) {
      if (update.maxAmount === null) {
        rule.maxAmount = undefined;
      } else {
        const money = Money.from(update.maxAmount, 'EGP');
        rule.maxAmount = mongoose.Types.Decimal128.fromString(money.toFixed(2));
      }
    }

    await rule.save({ session });
    return rule;
  }

  public static async getRuleById(companyId: string, ruleId: string): Promise<IApprovalRule> {
    const rule = await ApprovalRuleModel.findOne({ companyId, ruleId });
    if (!rule) {
      throw new NotFoundError(`Approval rule '${ruleId}' not found`);
    }
    return rule;
  }

  public static async listRules(
    companyId: string,
    filter: ListApprovalRulesFilter = {}
  ): Promise<IApprovalRule[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.requestType) query.requestType = filter.requestType;
    if (filter.isActive !== undefined) query.isActive = filter.isActive;
    if (filter.branchId) {
      query.$or = [{ branchId: filter.branchId }, { branchId: { $exists: false } }, { branchId: null }];
    }

    return ApprovalRuleModel.find(query).sort({ requestType: 1, approvalLevel: 1 });
  }

  public static async deleteRule(companyId: string, ruleId: string): Promise<void> {
    const rule = await ApprovalRuleModel.findOne({ companyId, ruleId });
    if (!rule) {
      throw new NotFoundError(`Approval rule '${ruleId}' not found`);
    }
    await ApprovalRuleModel.deleteOne({ companyId, ruleId });
  }

  public static async matchRulesForRequest(
    companyId: string,
    requestType: string,
    amount?: number,
    discountPercent?: number,
    branchId?: string,
    session?: ClientSession
  ): Promise<IApprovalRule[]> {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }
    const query = ApprovalRuleModel.find({
      companyId,
      requestType,
      isActive: true,
      ...(branchId
        ? { $or: [{ branchId }, { branchId: { $exists: false } }, { branchId: null }] }
        : {}),
    }).sort({ approvalLevel: 1 });

    const activeRules = session ? await query.session(session) : await query;
    if (!activeRules || activeRules.length === 0) {
      return [];
    }

    return activeRules.filter((rule) => {
      // Amount check
      if (amount !== undefined) {
        if (rule.minAmount) {
          const minNum = parseFloat(rule.minAmount.toString());
          if (amount < minNum) return false;
        }
        if (rule.maxAmount) {
          const maxNum = parseFloat(rule.maxAmount.toString());
          if (amount > maxNum) return false;
        }
      }

      // Discount check
      if (discountPercent !== undefined) {
        if (rule.minDiscountPercent !== undefined && discountPercent < rule.minDiscountPercent) {
          return false;
        }
        if (rule.maxDiscountPercent !== undefined && discountPercent > rule.maxDiscountPercent) {
          return false;
        }
      }

      return true;
    });
  }
}
