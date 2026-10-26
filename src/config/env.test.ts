import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const validEnv = {
  PLUGGY_CLIENT_ID: 'client-id',
  PLUGGY_CLIENT_SECRET: 'client-secret',
  PLUGGY_ITEM_IDS: 'item-1, item-2,,',
  FIREBASE_PROJECT_ID: 'project',
  FIREBASE_CLIENT_EMAIL: 'svc@project.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: '-----BEGIN-----\\nabc\\n-----END-----',
  GEMINI_API_KEY: 'gemini-key',
  GEMINI_MODEL: 'gemini-flash',
  OWNER_PHONE_NUMBER: '+55 (79) 99999-9999',
};

describe('parseEnv', () => {
  it('normaliza valores e aplica defaults', () => {
    const env = parseEnv(validEnv);

    expect(env.PLUGGY_ITEM_IDS).toEqual(['item-1', 'item-2']);
    expect(env.FIREBASE_PRIVATE_KEY).toBe('-----BEGIN-----\nabc\n-----END-----');
    expect(env.OWNER_PHONE_NUMBER).toBe('5579999999999');
    expect(env.TZ).toBe('America/Sao_Paulo');
    expect(env.SYNC_CRON).toBe('0 7,19 * * *');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('lista todas as variáveis ausentes', () => {
    expect(() => parseEnv({})).toThrow(/PLUGGY_CLIENT_ID[\s\S]*GEMINI_MODEL/);
  });

  it('rejeita lista de itens vazia', () => {
    expect(() => parseEnv({ ...validEnv, PLUGGY_ITEM_IDS: ' , ' })).toThrow(/PLUGGY_ITEM_IDS/);
  });

  it('rejeita telefone curto demais', () => {
    expect(() => parseEnv({ ...validEnv, OWNER_PHONE_NUMBER: '12345' })).toThrow(
      /OWNER_PHONE_NUMBER/,
    );
  });
});
