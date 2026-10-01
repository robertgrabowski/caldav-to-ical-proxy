import { describe, it, expect } from 'vitest';
import { encodeConfigToken, decodeConfigToken, extractConfigFromRequest } from '../src/auth';

describe('Auth & Config Parsing', () => {
  it('encodes and decodes configuration token safely', () => {
    const config = {
      caldavUrl: 'https://caldav.example.com/dav/user/work/',
      username: 'john_doe@example.com',
      password: 'mypassword!#?&=',
      calendarName: 'My Calendar',
      pastDays: 45,
      futureDays: 180,
    };

    const token = encodeConfigToken(config);
    expect(typeof token).toBe('string');
    expect(token).not.toContain('+');
    expect(token).not.toContain('/');

    const decoded = decodeConfigToken(token);
    expect(decoded).toEqual(config);
  });

  it('extracts config from query parameters', () => {
    const req = new Request(
      'https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav&user=alice&pass=secret&past_days=60&future_days=90&name=Testing'
    );
    const config = extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.caldavUrl).toBe('https://cal.test/dav');
    expect(config?.username).toBe('alice');
    expect(config?.password).toBe('secret');
    expect(config?.pastDays).toBe(60);
    expect(config?.futureDays).toBe(90);
    expect(config?.calendarName).toBe('Testing');
  });

  it('extracts config from /subscribe/:token.ics path', () => {
    const token = encodeConfigToken({
      caldavUrl: 'https://caldav.fastmail.com/dav/calendars/user/123/',
      username: 'user@fastmail.com',
      password: 'app-password',
    });

    const req = new Request(`https://proxy.worker.dev/subscribe/${token}.ics`);
    const config = extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.caldavUrl).toBe('https://caldav.fastmail.com/dav/calendars/user/123/');
    expect(config?.username).toBe('user@fastmail.com');
    expect(config?.password).toBe('app-password');
  });

  it('extracts Basic Auth header credentials', () => {
    const authHeader = 'Basic ' + btoa('headeruser:headerpass');
    const req = new Request('https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav', {
      headers: {
        Authorization: authHeader,
      },
    });

    const config = extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.username).toBe('headeruser');
    expect(config?.password).toBe('headerpass');
  });

  it('returns null if no caldavUrl can be found', () => {
    const req = new Request('https://proxy.worker.dev/');
    const config = extractConfigFromRequest(req);
    expect(config).toBeNull();
  });
});
