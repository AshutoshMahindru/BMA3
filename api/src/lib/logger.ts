/**
 * Structured Logger
 *
 * Pino-based structured logger for the compute pipeline and API layer.
 * All compute nodes should import `logger` from this module instead of
 * using bare `console.*` calls so that every message is machine-readable
 * JSON with consistent metadata fields.
 *
 * Usage:
 *   import { logger } from '../../lib/logger';
 *   logger.info({ activeDecisionsCount: 5 }, 'Decisions resolved');
 *   logger.warn({ decisionId: '...' }, 'Scope mismatch');
 */

import pino from 'pino';

export const logger = pino({
  name: 'bma3-api',
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
