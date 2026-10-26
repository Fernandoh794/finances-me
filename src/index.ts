import { buildApp } from './app/container.js';
import { getEnv } from './config/env.js';
import { logger } from './config/logger.js';

async function main(): Promise<void> {
  const env = getEnv();
  logger.info(
    { llm: env.LLM_PROVIDER, data: env.DATA_SOURCE, channel: env.CHANNEL },
    'Agente financeiro iniciando',
  );

  const { handler, channel } = buildApp(env, logger);

  const shutdown = () => {
    void channel.stop();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await channel.start(handler);
  logger.info('Agente financeiro encerrado');
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Falha ao iniciar');
  process.exitCode = 1;
});
