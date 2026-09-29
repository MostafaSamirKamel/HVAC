import { createLogger, Logger } from '@hvac/logger';

export const logger: Logger = createLogger({ serviceName: 'api-gateway' });
