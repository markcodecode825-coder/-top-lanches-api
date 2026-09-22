import { execFileSync } from 'node:child_process';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

export default async function globalSetup() {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('top_lanches_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = container.getConnectionUri();
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.ADMIN_PASSWORD = 'change-me';
  process.env.ADMIN_NAME = 'Administrador';
  process.env.CORS_ORIGINS = 'http://localhost:3000';
  process.env.BUSINESS_TIMEZONE = 'America/Fortaleza';
  process.env.LOG_LEVEL = 'silent';
  process.env.RATE_LIMIT_MAX = '1000';
  process.env.LOGIN_RATE_LIMIT_MAX = '1000';
  process.env.ORDER_RATE_LIMIT_MAX = '1000';
  process.env.SEARCH_RATE_LIMIT_MAX = '1000';
  process.env.WHATSAPP_CLOUD_ENABLED = 'true';
  process.env.WHATSAPP_BOT_ENABLED = 'false';
  process.env.WHATSAPP_BOT_SESSION_TTL_MINUTES = '30';
  process.env.WHATSAPP_GRAPH_API_VERSION = 'v26.0';
  process.env.WHATSAPP_VERIFY_TOKEN = 'test-whatsapp-verify-token';
  process.env.WHATSAPP_APP_SECRET = 'test-whatsapp-app-secret';
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-whatsapp-access-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890';
  process.env.WHATSAPP_WABA_ID = '9876543210';
  process.env.WHATSAPP_DEFAULT_COUNTRY_CODE = '55';
  process.env.WHATSAPP_WEBHOOK_RATE_LIMIT_MAX = '1000';
  process.env.WHATSAPP_HTTP_TIMEOUT_MS = '10000';

  const commandEnv = { ...process.env };
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'migrate', 'deploy'], {
    env: commandEnv,
    stdio: 'inherit'
  });
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'db', 'seed'], {
    env: commandEnv,
    stdio: 'inherit'
  });

  return async () => {
    await container.stop();
  };
}
