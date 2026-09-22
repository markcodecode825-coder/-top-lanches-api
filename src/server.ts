import { buildApp } from './app';
import { env } from './config/env';

async function start(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Encerrando API');
    await app.close();
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT').finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM').finally(() => process.exit(0));
  });

  try {
    await app.listen({ host: '0.0.0.0', port: env.PORT });
  } catch (error) {
    app.log.fatal({ err: error }, 'Falha ao iniciar a API');
    process.exitCode = 1;
    await app.close();
  }
}

void start();
