import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { REDACTED_PATHS } from './logger.js';

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const log = pino({ redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' } }, stream);
  return { log, lines };
}

describe('logger redaction', () => {
  it('oculta segredos no nível raiz e aninhados', () => {
    const { log, lines } = captureLogger();

    log.info(
      { apiKey: 'secret-1', pluggy: { clientSecret: 'secret-2' }, headers: { 'x-api-key': 'k' } },
      'teste',
    );

    const output = lines.join('');
    expect(output).not.toContain('secret-1');
    expect(output).not.toContain('secret-2');
    expect(output).not.toContain('"k"');
    expect(output).toContain('[REDACTED]');
  });
});
