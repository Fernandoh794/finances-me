import 'dotenv/config';
import { z } from 'zod';

const requiredString = z.string().trim().min(1);

const commaSeparatedList = requiredString.transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TZ: requiredString.default('America/Sao_Paulo'),

  PLUGGY_CLIENT_ID: requiredString,
  PLUGGY_CLIENT_SECRET: requiredString,
  PLUGGY_ITEM_IDS: commaSeparatedList.pipe(z.array(z.string()).min(1)),

  FIREBASE_PROJECT_ID: requiredString,
  FIREBASE_CLIENT_EMAIL: z.email(),
  // Arquivos .env costumam guardar a chave com "\n" literais.
  FIREBASE_PRIVATE_KEY: requiredString.transform((value) => value.replace(/\\n/g, '\n')),

  GEMINI_API_KEY: requiredString,
  GEMINI_MODEL: requiredString,

  OWNER_PHONE_NUMBER: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{10,15}$/, 'deve conter DDI + DDD + número, só dígitos')),

  SYNC_CRON: requiredString.default('0 7,19 * * *'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
