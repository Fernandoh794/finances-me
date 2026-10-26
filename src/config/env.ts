import 'dotenv/config';
import { z } from 'zod';

const requiredString = z.string().trim().min(1);

// Linhas como "CHAVE=" no .env chegam como string vazia: tratamos como ausentes.
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional(),
  );
}

const commaSeparatedList = requiredString
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )
  .pipe(z.array(z.string()).min(1, 'informe ao menos um ID'));

const phoneNumber = z
  .string()
  .transform((value) => value.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{10,15}$/, 'deve conter DDI + DDD + número, só dígitos'));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TZ: requiredString.default('America/Sao_Paulo'),

    // Modos de execução: os padrões permitem rodar tudo localmente sem nenhuma credencial.
    LLM_PROVIDER: z.enum(['fake', 'gemini']).default('fake'),
    DATA_SOURCE: z.enum(['demo', 'live']).default('demo'),
    CHANNEL: z.enum(['console', 'whatsapp']).default('console'),

    PLUGGY_CLIENT_ID: optional(requiredString),
    PLUGGY_CLIENT_SECRET: optional(requiredString),
    PLUGGY_ITEM_IDS: optional(commaSeparatedList),

    FIREBASE_PROJECT_ID: optional(requiredString),
    FIREBASE_CLIENT_EMAIL: optional(z.email()),
    // Arquivos .env costumam guardar a chave com "\n" literais.
    FIREBASE_PRIVATE_KEY: optional(
      requiredString.transform((value) => value.replace(/\\n/g, '\n')),
    ),

    GEMINI_API_KEY: optional(requiredString),
    GEMINI_MODEL: optional(requiredString),

    OWNER_PHONE_NUMBER: optional(phoneNumber),

    SYNC_CRON: requiredString.default('0 7,19 * * *'),
  })
  .superRefine((env, ctx) => {
    const requiredByMode: [boolean, string, (keyof typeof env)[]][] = [
      [env.LLM_PROVIDER === 'gemini', 'LLM_PROVIDER=gemini', ['GEMINI_API_KEY', 'GEMINI_MODEL']],
      [
        env.DATA_SOURCE === 'live',
        'DATA_SOURCE=live',
        [
          'PLUGGY_CLIENT_ID',
          'PLUGGY_CLIENT_SECRET',
          'PLUGGY_ITEM_IDS',
          'FIREBASE_PROJECT_ID',
          'FIREBASE_CLIENT_EMAIL',
          'FIREBASE_PRIVATE_KEY',
        ],
      ],
      [env.CHANNEL === 'whatsapp', 'CHANNEL=whatsapp', ['OWNER_PHONE_NUMBER']],
    ];

    for (const [active, mode, keys] of requiredByMode) {
      if (!active) continue;
      for (const key of keys) {
        if (env[key] === undefined) {
          ctx.addIssue({ code: 'custom', path: [key], message: `obrigatória quando ${mode}` });
        }
      }
    }
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

/** Extrai variáveis que o modo atual garante estarem presentes, com tipos não-opcionais. */
export function requireEnv<K extends keyof Env>(
  env: Env,
  keys: readonly K[],
): { [P in K]-?: NonNullable<Env[P]> } {
  const picked: Partial<Record<K, unknown>> = {};
  for (const key of keys) {
    const value = env[key];
    if (value === undefined) {
      throw new Error(`Variável de ambiente ausente: ${key}`);
    }
    picked[key] = value;
  }
  return picked as { [P in K]-?: NonNullable<Env[P]> };
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
