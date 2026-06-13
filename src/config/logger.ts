import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { env } from '@/env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom format for console
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(meta).length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }
  if (stack) {
    log += `\n${stack}`;
  }
  return log;
});

const isProd = env.NODE_ENV === 'production';

// Create Winston logger instance
export const winstonLogger = winston.createLogger({
  level: env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json(),
  ),
  defaultMeta: { service: 'bizos-backend' },
  transports: [
    new winston.transports.Console({
      format: isProd 
        ? combine(timestamp(), json()) 
        : combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat),
    }),
    // Daily rotate file for general logs
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
    }),
    // Daily rotate file for errors only
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
  ],
});

// Dedicated Audit Logger
export const auditLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json(),
  ),
  defaultMeta: { service: 'bizos-backend', type: 'audit' },
  transports: [
    new winston.transports.Console({
      format: isProd 
        ? combine(timestamp(), json()) 
        : combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat),
    }),
    // Daily rotate file for audit logs (longer retention for compliance)
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      level: 'info',
    }),
  ],
});

/**
 * Wrapper to maintain compatibility with Pino's `logger.info({ obj }, 'msg')` signature
 * while using Winston under the hood.
 */
export class LoggerWrapper {
  private moduleName?: string;

  constructor(moduleName?: string) {
    this.moduleName = moduleName;
  }

  private formatArgs(args: any[]): [string, any] {
    if (args.length === 0) return ['', {}];
    if (args.length === 1) {
      if (typeof args[0] === 'string') return [args[0], this.getBaseMeta()];
      return ['', { ...this.getBaseMeta(), ...args[0] }];
    }
    
    // Pino style: logger.info({ obj }, 'msg')
    if (typeof args[0] === 'object' && typeof args[1] === 'string') {
      return [args[1], { ...this.getBaseMeta(), ...args[0] }];
    }
    
    // Winston style fallback: logger.info('msg', { obj })
    if (typeof args[0] === 'string' && typeof args[1] === 'object') {
      return [args[0], { ...this.getBaseMeta(), ...args[1] }];
    }

    return [String(args[0]), this.getBaseMeta()];
  }

  private getBaseMeta() {
    return this.moduleName ? { module: this.moduleName } : {};
  }

  info(...args: any[]) {
    const [msg, meta] = this.formatArgs(args);
    winstonLogger.info(msg, meta);
  }

  error(...args: any[]) {
    const [msg, meta] = this.formatArgs(args);
    winstonLogger.error(msg, meta);
  }

  warn(...args: any[]) {
    const [msg, meta] = this.formatArgs(args);
    winstonLogger.warn(msg, meta);
  }

  debug(...args: any[]) {
    const [msg, meta] = this.formatArgs(args);
    winstonLogger.debug(msg, meta);
  }

  audit(action: string, meta: Record<string, any>) {
    auditLogger.info(action, { ...this.getBaseMeta(), ...meta });
  }
}

export const logger = new LoggerWrapper();

export function createModuleLogger(module: string) {
  return new LoggerWrapper(module);
}
