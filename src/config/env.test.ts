import { describe, expect, it } from 'vitest';
import { parseEnv, requireEnv } from './env.js';

const liveEnv = {
  LLM_PROVIDER: 'gemini',
  DATA_SOURCE: 'live',
  CHANNEL: 'whatsapp',
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
  it('roda sem nenhuma credencial nos modos padrão', () => {
    const env = parseEnv({});

    expect(env.LLM_PROVIDER).toBe('fake');
    expect(env.DATA_SOURCE).toBe('demo');
    expect(env.CHANNEL).toBe('console');
    expect(env.TZ).toBe('America/Sao_Paulo');
    expect(env.SYNC_CRON).toBe('0 7,19 * * *');
  });

  it('trata valores vazios como ausentes', () => {
    const env = parseEnv({ GEMINI_API_KEY: '', OWNER_PHONE_NUMBER: '  ' });
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.OWNER_PHONE_NUMBER).toBeUndefined();
  });

  it('normaliza valores nos modos reais', () => {
    const env = parseEnv(liveEnv);

    expect(env.PLUGGY_ITEM_IDS).toEqual(['item-1', 'item-2']);
    expect(env.FIREBASE_PRIVATE_KEY).toBe('-----BEGIN-----\nabc\n-----END-----');
    expect(env.OWNER_PHONE_NUMBER).toBe('5579999999999');
  });

  it('exige as chaves do Gemini quando LLM_PROVIDER=gemini', () => {
    expect(() => parseEnv({ LLM_PROVIDER: 'gemini' })).toThrow(
      /GEMINI_API_KEY: obrigatória quando LLM_PROVIDER=gemini[\s\S]*GEMINI_MODEL/,
    );
  });

  it('exige Pluggy e Firebase quando DATA_SOURCE=live', () => {
    expect(() => parseEnv({ DATA_SOURCE: 'live' })).toThrow(
      /PLUGGY_CLIENT_ID[\s\S]*FIREBASE_PRIVATE_KEY/,
    );
  });

  it('exige o telefone do dono quando CHANNEL=whatsapp', () => {
    expect(() => parseEnv({ CHANNEL: 'whatsapp' })).toThrow(/OWNER_PHONE_NUMBER/);
  });

  it('rejeita lista de itens vazia', () => {
    expect(() => parseEnv({ ...liveEnv, PLUGGY_ITEM_IDS: ' , ' })).toThrow(/PLUGGY_ITEM_IDS/);
  });

  it('rejeita telefone curto demais', () => {
    expect(() => parseEnv({ ...liveEnv, OWNER_PHONE_NUMBER: '12345' })).toThrow(
      /OWNER_PHONE_NUMBER/,
    );
  });
});

describe('requireEnv', () => {
  it('retorna as chaves presentes', () => {
    const env = parseEnv(liveEnv);
    expect(requireEnv(env, ['GEMINI_MODEL'])).toEqual({ GEMINI_MODEL: 'gemini-flash' });
  });

  it('falha com chave ausente', () => {
    expect(() => requireEnv(parseEnv({}), ['GEMINI_API_KEY'])).toThrow(/GEMINI_API_KEY/);
  });
});
