import { describe, it, expect } from 'vitest';
import {
  generateRsaKeyPair,
  importRsaPublicKey,
  importRsaPrivateKey,
  encryptPassword,
  decryptPassword,
  extractPublicKeyJwk,
  getPublicKeyJwkFromEnv,
} from '../src/crypto';

describe('Crypto Utilities (RSA-OAEP)', () => {
  it('generates valid RSA-OAEP key pair', async () => {
    const keyPair = await generateRsaKeyPair();
    expect(keyPair.publicKeyJwk.kty).toBe('RSA');
    expect(keyPair.privateKeyJwk.kty).toBe('RSA');
    expect(keyPair.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
    expect(keyPair.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');
  });

  it('encrypts and decrypts using JWK format', async () => {
    const keyPair = await generateRsaKeyPair();
    const secret = 'my-caldav-secret-password-!@#$%^&*()';

    const encrypted = await encryptPassword(secret, keyPair.publicKeyJwk);
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('+');
    expect(encrypted).not.toContain('/');

    const decrypted = await decryptPassword(encrypted, keyPair.privateKeyJwk);
    expect(decrypted).toBe(secret);
  });

  it('encrypts and decrypts using PEM format', async () => {
    const keyPair = await generateRsaKeyPair();
    const secret = 'another-secret-1234';

    const encrypted = await encryptPassword(secret, keyPair.publicKeyPem);
    const decrypted = await decryptPassword(encrypted, keyPair.privateKeyPem);
    expect(decrypted).toBe(secret);
  });

  it('extracts public key JWK from private key JWK', async () => {
    const keyPair = await generateRsaKeyPair();
    const extracted = extractPublicKeyJwk(keyPair.privateKeyJwk);
    expect(extracted).not.toBeNull();
    expect(extracted?.n).toBe(keyPair.publicKeyJwk.n);
    expect(extracted?.e).toBe(keyPair.publicKeyJwk.e);
    expect(extracted?.kty).toBe('RSA');

    // Verify the extracted public key can encrypt, and private key decrypts
    const secret = 'extracted-pub-test';
    const encrypted = await encryptPassword(secret, extracted!);
    const decrypted = await decryptPassword(encrypted, keyPair.privateKeyJwk);
    expect(decrypted).toBe(secret);
  });

  it('resolves public key from env using RSA_PUBLIC_KEY', async () => {
    const keyPair = await generateRsaKeyPair();
    const env = { RSA_PUBLIC_KEY: JSON.stringify(keyPair.publicKeyJwk) };
    const resolved = await getPublicKeyJwkFromEnv(env);
    expect(resolved).toEqual(keyPair.publicKeyJwk);
  });

  it('resolves public key from env using RSA_PRIVATE_KEY', async () => {
    const keyPair = await generateRsaKeyPair();
    const env = { RSA_PRIVATE_KEY: JSON.stringify(keyPair.privateKeyJwk) };
    const resolved = await getPublicKeyJwkFromEnv(env);
    expect(resolved).not.toBeNull();
    expect(resolved?.n).toBe(keyPair.publicKeyJwk.n);
  });

  it('returns null when env has no RSA keys', async () => {
    expect(await getPublicKeyJwkFromEnv({})).toBeNull();
    expect(await getPublicKeyJwkFromEnv(undefined)).toBeNull();
  });

  it('fails gracefully on invalid decryption input', async () => {
    const keyPair = await generateRsaKeyPair();
    await expect(decryptPassword('invalid-base64', keyPair.privateKeyJwk)).rejects.toThrow(
      /Failed to decrypt CalDAV password/i
    );
  });
});
