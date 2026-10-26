import { getEnv } from './config/env.js';
import { logger } from './config/logger.js';

function main(): void {
  const env = getEnv();
  logger.info(
    { nodeEnv: env.NODE_ENV, items: env.PLUGGY_ITEM_IDS.length, timeZone: env.TZ },
    'Agente financeiro iniciado',
  );
  // Fases 2–5: sync Pluggy, agente e WhatsApp serão conectados aqui.
}

try {
  main();
} catch (error) {
  logger.fatal({ err: error }, 'Falha ao iniciar');
  process.exitCode = 1;
}
