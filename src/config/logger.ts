import { pino, type LoggerOptions } from 'pino';

// Lê direto de process.env para que o logger funcione antes (ou sem) a validação completa do env.
const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development';

export const REDACTED_PATHS = [
  'apiKey',
  'clientSecret',
  'password',
  'token',
  'authorization',
  'privateKey',
  '*.apiKey',
  '*.clientSecret',
  '*.password',
  '*.token',
  '*.authorization',
  '*.privateKey',
  'headers.authorization',
  'headers["x-api-key"]',
  '*.headers.authorization',
  '*.headers["x-api-key"]',
];

export const loggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
  base: { app: 'finances' },
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard' },
    },
  }),
};

export const logger = pino(loggerOptions);
