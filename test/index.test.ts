import { describe, it, expect, vi, beforeAll } from 'vitest';
import worker from '../src/index';
import { generateRsaKeyPair, KeyPairResult } from '../src/crypto';

describe('Worker Request Handler', () => {
  let keyPair: KeyPairResult;

  beforeAll(async () => {
    keyPair = await generateRsaKeyPair();
  });

  const dummyCtx: any = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };

  it('handles OPTIONS preflight request', async () => {
    const req = new Request('https://proxy.test/calendar.ics', {
      method: 'OPTIONS',
    });
    const res = await worker.fetch(req, {}, dummyCtx);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('serves /health endpoint', async () => {
    const req = new Request('https://proxy.test/health');
    const res = await worker.fetch(req, {}, dummyCtx);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('ok');
  });

  it('serves /public-key.json when configured', async () => {
    const req = new Request('https://proxy.test/public-key.json');
    const env = { RSA_PUBLIC_KEY: JSON.stringify(keyPair.publicKeyJwk) };
    const res = await worker.fetch(req, env, dummyCtx);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.publicKey).toEqual(keyPair.publicKeyJwk);
  });

  it('returns 404 for /public-key.json when not configured', async () => {
    const req = new Request('https://proxy.test/public-key.json');
    const res = await worker.fetch(req, {}, dummyCtx);
    expect(res.status).toBe(404);
  });

  it('renders web generator UI at root path with warning when public key is not configured', async () => {
    const req = new Request('https://proxy.test/');
    const res = await worker.fetch(req, {}, dummyCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('CalDAV-to-iCal Proxy');
    expect(text).toContain('All URLs are constructed entirely locally in your browser.');
    expect(text).toContain('CalDAV Collection URL');
    expect(text).toContain("The password will be passed in plain text in the URL because the public key isn't set on the server.");
    // Confirm there is no checkbox to disable encryption
    expect(text).not.toContain('id="encryptPassword"');
  });

  it('renders web generator UI with encrypted password info message when RSA key configured', async () => {
    const req = new Request('https://proxy.test/');
    const env = { RSA_PRIVATE_KEY: JSON.stringify(keyPair.privateKeyJwk) };
    const res = await worker.fetch(req, env, dummyCtx);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain(keyPair.publicKeyJwk.n);
    expect(text).toContain('alert-info');
    expect(text).toContain('The password is included in encrypted form in the URL.');
    expect(text).not.toContain('id="encryptPassword"');
  });

  it('returns 400 when missing caldav url on /calendar.ics', async () => {
    const req = new Request('https://proxy.test/calendar.ics');
    const res = await worker.fetch(req, {}, dummyCtx);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing CalDAV collection URL');
  });

  it('returns 400 when encrypted password provided but RSA key missing', async () => {
    const req = new Request('https://proxy.test/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav&password_encrypted=xyz');
    const res = await worker.fetch(req, {}, dummyCtx);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('no RSA private key is configured');
  });
});
