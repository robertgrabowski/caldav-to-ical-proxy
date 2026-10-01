import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index';

describe('Worker Request Handler', () => {
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

  it('renders web generator UI at root path without query params', async () => {
    const req = new Request('https://proxy.test/');
    const res = await worker.fetch(req, {}, dummyCtx);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const text = await res.text();
    expect(text).toContain('CalDAV-to-iCal Proxy');
    expect(text).toContain('CalDAV Collection URL');
  });

  it('returns 400 when missing caldav url on /calendar.ics', async () => {
    const req = new Request('https://proxy.test/calendar.ics');
    const res = await worker.fetch(req, {}, dummyCtx);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('Missing CalDAV collection URL');
  });
});
