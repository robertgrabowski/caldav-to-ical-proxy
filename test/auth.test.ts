import { describe, it, expect, beforeAll } from 'vitest';
import { encodeConfigToken, decodeConfigToken, extractConfigFromRequest } from '../src/auth';
import { generateRsaKeyPair, encryptPassword, decryptPassword, KeyPairResult } from '../src/crypto';

describe('Auth & Config Parsing', () => {
  let keyPair: KeyPairResult;

  beforeAll(async () => {
    keyPair = await generateRsaKeyPair();
  });

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

  it('extracts config from query parameters', async () => {
    const req = new Request(
      'https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav&user=alice&pass=secret&past_days=60&future_days=90&name=Testing'
    );
    const config = await extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.caldavUrl).toBe('https://cal.test/dav');
    expect(config?.username).toBe('alice');
    expect(config?.password).toBe('secret');
    expect(config?.pastDays).toBe(60);
    expect(config?.futureDays).toBe(90);
    expect(config?.calendarName).toBe('Testing');
  });

  it('extracts config from /subscribe/:token.ics path', async () => {
    const token = encodeConfigToken({
      caldavUrl: 'https://caldav.fastmail.com/dav/calendars/user/123/',
      username: 'user@fastmail.com',
      password: 'app-password',
    });

    const req = new Request(`https://proxy.worker.dev/subscribe/${token}.ics`);
    const config = await extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.caldavUrl).toBe('https://caldav.fastmail.com/dav/calendars/user/123/');
    expect(config?.username).toBe('user@fastmail.com');
    expect(config?.password).toBe('app-password');
  });

  it('extracts Basic Auth header credentials', async () => {
    const authHeader = 'Basic ' + btoa('headeruser:headerpass');
    const req = new Request('https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav', {
      headers: {
        Authorization: authHeader,
      },
    });

    const config = await extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.username).toBe('headeruser');
    expect(config?.password).toBe('headerpass');
  });

  it('returns null if no caldavUrl can be found', async () => {
    const req = new Request('https://proxy.worker.dev/');
    const config = await extractConfigFromRequest(req);
    expect(config).toBeNull();
  });

  it('extracts multiple URLs from repeated url= query params', async () => {
    const req = new Request(
      'https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fwork&url=https%3A%2F%2Fcal.test%2Fpersonal&user=alice&pass=secret'
    );
    const config = await extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.caldavUrls).toEqual([
      'https://cal.test/work',
      'https://cal.test/personal',
    ]);
    expect(config?.caldavUrl).toBe('https://cal.test/work');
    expect(config?.username).toBe('alice');
  });

  it('extracts multiple URLs from comma-separated url= param', async () => {
    const urls = 'https://cal.test/a,https://cal.test/b';
    const req = new Request(
      `https://proxy.worker.dev/calendar.ics?url=${encodeURIComponent(urls)}&user=bob`
    );
    const config = await extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.caldavUrls).toEqual([
      'https://cal.test/a',
      'https://cal.test/b',
    ]);
  });

  it('extracts caldavUrls array from token', async () => {
    const token = encodeConfigToken({
      caldavUrls: [
        'https://caldav.example.com/work/',
        'https://caldav.example.com/personal/',
      ],
      username: 'user@example.com',
      password: 'pass',
    });

    const req = new Request(`https://proxy.worker.dev/subscribe/${token}.ics`);
    const config = await extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.caldavUrls).toEqual([
      'https://caldav.example.com/work/',
      'https://caldav.example.com/personal/',
    ]);
    expect(config?.caldavUrl).toBe('https://caldav.example.com/work/');
  });

  it('single-URL token still populates caldavUrls', async () => {
    const token = encodeConfigToken({
      caldavUrl: 'https://caldav.example.com/single/',
      username: 'u',
      password: 'p',
    });

    const req = new Request(`https://proxy.worker.dev/subscribe/${token}.ics`);
    const config = await extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.caldavUrls).toEqual(['https://caldav.example.com/single/']);
    expect(config?.caldavUrl).toBe('https://caldav.example.com/single/');
  });

  it('deduplicates identical URLs from query params', async () => {
    const req = new Request(
      'https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fwork&url=https%3A%2F%2Fcal.test%2Fwork'
    );
    const config = await extractConfigFromRequest(req);
    expect(config).not.toBeNull();
    expect(config?.caldavUrls).toEqual(['https://cal.test/work']);
  });

  describe('RSA Encrypted Passwords', () => {
    it('decrypts password_encrypted query parameter', async () => {
      const encryptedPass = await encryptPassword('mySecretPass123', keyPair.publicKeyJwk);
      const req = new Request(
        `https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav&user=alice&password_encrypted=${encodeURIComponent(encryptedPass)}`
      );

      const config = await extractConfigFromRequest(req, {
        RSA_PRIVATE_KEY: JSON.stringify(keyPair.privateKeyJwk),
      });

      expect(config).not.toBeNull();
      expect(config?.password).toBe('mySecretPass123');
      expect(config?.password_encrypted).toBe(encryptedPass);
    });

    it('decrypts pass_encrypted alias query parameter', async () => {
      const encryptedPass = await encryptPassword('aliasSecret', keyPair.publicKeyJwk);
      const req = new Request(
        `https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav&user=bob&pass_encrypted=${encodeURIComponent(encryptedPass)}`
      );

      const config = await extractConfigFromRequest(req, {
        RSA_PRIVATE_KEY: JSON.stringify(keyPair.privateKeyJwk),
      });

      expect(config).not.toBeNull();
      expect(config?.password).toBe('aliasSecret');
    });

    it('decrypts password_encrypted in base64 token', async () => {
      const encryptedPass = await encryptPassword('tokenSecretPassword', keyPair.publicKeyJwk);
      const token = encodeConfigToken({
        caldavUrl: 'https://caldav.example.com/dav/',
        username: 'carol',
        password_encrypted: encryptedPass,
      });

      const req = new Request(`https://proxy.worker.dev/subscribe/${token}.ics`);
      const config = await extractConfigFromRequest(req, {
        RSA_PRIVATE_KEY: JSON.stringify(keyPair.privateKeyJwk),
      });

      expect(config).not.toBeNull();
      expect(config?.password).toBe('tokenSecretPassword');
      expect(config?.password_encrypted).toBe(encryptedPass);
    });

    it('prioritizes plaintext password when both are provided (legacy support)', async () => {
      const encryptedPass = await encryptPassword('encryptedPass', keyPair.publicKeyJwk);
      const req = new Request(
        `https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav&user=alice&pass=legacyPlaintext&password_encrypted=${encodeURIComponent(encryptedPass)}`
      );

      const config = await extractConfigFromRequest(req, {
        RSA_PRIVATE_KEY: JSON.stringify(keyPair.privateKeyJwk),
      });

      expect(config).not.toBeNull();
      expect(config?.password).toBe('legacyPlaintext');
    });

    it('throws error when encrypted password is provided without private key', async () => {
      const encryptedPass = await encryptPassword('secret', keyPair.publicKeyJwk);
      const req = new Request(
        `https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav&user=alice&password_encrypted=${encodeURIComponent(encryptedPass)}`
      );

      await expect(extractConfigFromRequest(req)).rejects.toThrow(
        /no RSA private key is configured/i
      );
    });

    it('throws error when encrypted password is corrupted', async () => {
      const req = new Request(
        `https://proxy.worker.dev/calendar.ics?url=https%3A%2F%2Fcal.test%2Fdav&user=alice&password_encrypted=invalidCiphertext`
      );

      await expect(
        extractConfigFromRequest(req, {
          RSA_PRIVATE_KEY: JSON.stringify(keyPair.privateKeyJwk),
        })
      ).rejects.toThrow(/Failed to decrypt CalDAV password/i);
    });
  });
});
