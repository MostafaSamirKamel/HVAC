import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface UserCreatedPayload {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  roles: string[];
  userBranchId?: string;
  allowedBranchIds: string[];
  isSuperAdmin: boolean;
}

export class UserCreatedEvent extends BaseDomainEvent<UserCreatedPayload> {
  constructor(payload: UserCreatedPayload, context: BaseEventContext) {
    super(
      'identity.user.created',
      1,
      'User',
      payload.userId,
      payload,
      context,
    );
  }
}

export interface CompanyCreatedPayload {
  companyId: string;
  name: string;
  taxNumber?: string;
  currency: string;
}

export class CompanyCreatedEvent extends BaseDomainEvent<CompanyCreatedPayload> {
  constructor(payload: CompanyCreatedPayload, context: BaseEventContext) {
    super(
      'identity.company.created',
      1,
      'Company',
      payload.companyId,
      payload,
      context,
    );
  }
}

export interface BranchCreatedPayload {
  branchId: string;
  companyId: string;
  name: string;
  code: string;
  isMainBranch: boolean;
}

export class BranchCreatedEvent extends BaseDomainEvent<BranchCreatedPayload> {
  constructor(payload: BranchCreatedPayload, context: BaseEventContext) {
    super(
      'identity.branch.created',
      1,
      'Branch',
      payload.branchId,
      payload,
      context,
    );
  }
}
