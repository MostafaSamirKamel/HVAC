import { AsyncLocalStorage } from 'node:async_hooks';

export interface TracingContext {
  requestId: string;
  correlationId: string;
  userId?: string;
  branchId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TracingContext>();

export const CorrelationManager = {
  run<T>(context: TracingContext, callback: () => T): T {
    return asyncLocalStorage.run(context, callback);
  },

  getContext(): TracingContext | undefined {
    return asyncLocalStorage.getStore();
  },

  getCorrelationId(): string {
    return asyncLocalStorage.getStore()?.correlationId || crypto.randomUUID();
  },

  getRequestId(): string {
    return asyncLocalStorage.getStore()?.requestId || crypto.randomUUID();
  },
};
