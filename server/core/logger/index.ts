/**
 * CORE LOGGER - Production-Ready Pino Implementation
 * PHASE 4 - Hard CTO Mode
 */
import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';
const isTest = process.env['NODE_ENV'] === 'test';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? (isProduction ? 'info' : 'debug'),
  transport: (!isProduction && !isTest) ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
  base: {
    env: process.env['NODE_ENV'] ?? 'development',
    service: 'servicall-backend',
  },
});

export default logger;
