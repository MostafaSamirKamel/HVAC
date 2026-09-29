import pino, { type Logger as PinoLogger } from 'pino';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
}

export function createLogger(options: LoggerOptions): PinoLogger {
  const isDev = process.env.NODE_ENV !== 'production';

  return pino({
    name: options.serviceName,
    level: options.level || process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    transport: isDev
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    base: {
      service: options.serviceName,
      env: process.env.NODE_ENV || 'development',
    },
  });
}

export type Logger = PinoLogger;
