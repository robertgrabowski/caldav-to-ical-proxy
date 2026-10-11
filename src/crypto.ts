/**
 * Cryptographic helpers for RSA-OAEP client-side encryption and server-side decryption.
 */

export interface KeyPairResult {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
  publicKeyPem: string;
  privateKeyPem: string;
}

function bufferToPem(buffer: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const lines = base64.match(/.{1,64}/g) || [base64];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function pemToBinary(pem: string): Uint8Array {
  const cleanB64 = pem.replace(/-----[^\n\r]+-----/g, '').replace(/[\s\r\n]+/g, '');
  const binary = atob(cleanB64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generates an RSA-OAEP 2048-bit keypair for SHA-256.
 */
export async function generateRsaKeyPair(): Promise<KeyPairResult> {
  const keyPair = (await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  )) as CryptoKeyPair;

  const publicKeyJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;
  const privateKeyJwk = (await crypto.subtle.exportKey('jwk', keyPair.privateKey)) as JsonWebKey;

  const spki = (await crypto.subtle.exportKey('spki', keyPair.publicKey)) as ArrayBuffer;
  const pkcs8 = (await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)) as ArrayBuffer;

  return {
    publicKeyJwk,
    privateKeyJwk,
    publicKeyPem: bufferToPem(spki, 'PUBLIC KEY'),
    privateKeyPem: bufferToPem(pkcs8, 'PRIVATE KEY'),
  };
}

/**
 * Extracts public key JWK from a private key JWK if available.
 */
export function extractPublicKeyJwk(keyInput: string | JsonWebKey): JsonWebKey | null {
  try {
    const jwk = typeof keyInput === 'string' ? JSON.parse(keyInput.trim()) : keyInput;
    if (jwk && jwk.kty === 'RSA' && jwk.n && jwk.e) {
      return {
        kty: 'RSA',
        n: jwk.n,
        e: jwk.e,
        alg: jwk.alg || 'RSA-OAEP-256',
        ext: true,
        key_ops: ['encrypt'],
      };
    }
  } catch {
    // Not a JSON JWK string
  }
  return null;
}

/**
 * Resolves public key JWK from environment configuration (RSA_PUBLIC_KEY or RSA_PRIVATE_KEY).
 * Supports both JWK and PEM formats.
 */
export async function getPublicKeyJwkFromEnv(env?: {
  RSA_PUBLIC_KEY?: string;
  RSA_PRIVATE_KEY?: string;
}): Promise<JsonWebKey | null> {
  if (!env) return null;

  if (env.RSA_PUBLIC_KEY) {
    const trimmed = env.RSA_PUBLIC_KEY.trim();
    if (trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // ignore JSON parse error, try PEM
      }
    }
    try {
      const pubKey = await importRsaPublicKey(trimmed);
      return (await crypto.subtle.exportKey('jwk', pubKey)) as JsonWebKey;
    } catch {
      // failed to import
    }
  }

  if (env.RSA_PRIVATE_KEY) {
    const extracted = extractPublicKeyJwk(env.RSA_PRIVATE_KEY);
    if (extracted) {
      return extracted;
    }
    try {
      const privKey = await importRsaPrivateKey(env.RSA_PRIVATE_KEY);
      const privJwk = (await crypto.subtle.exportKey('jwk', privKey)) as JsonWebKey;
      return extractPublicKeyJwk(privJwk);
    } catch {
      // failed to import
    }
  }

  return null;
}

/**
 * Imports an RSA public key from CryptoKey, JWK (object or JSON string), or SPKI PEM string.
 */
export async function importRsaPublicKey(keyInput: CryptoKey | string | JsonWebKey): Promise<CryptoKey> {
  if (typeof CryptoKey !== 'undefined' && keyInput instanceof CryptoKey) {
    return keyInput;
  }
  if (typeof keyInput === 'object' && keyInput !== null) {
    return crypto.subtle.importKey(
      'jwk',
      keyInput as JsonWebKey,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
  }
  if (typeof keyInput === 'string') {
    const trimmed = keyInput.trim();
    if (trimmed.startsWith('{')) {
      const jwk = JSON.parse(trimmed);
      return importRsaPublicKey(jwk);
    }
    const bytes = pemToBinary(trimmed);
    return crypto.subtle.importKey(
      'spki',
      bytes,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
  }
  throw new Error('Unsupported RSA public key format');
}

/**
 * Imports an RSA private key from CryptoKey, JWK (object or JSON string), or PKCS#8 PEM string.
 */
export async function importRsaPrivateKey(keyInput: CryptoKey | string | JsonWebKey): Promise<CryptoKey> {
  if (typeof CryptoKey !== 'undefined' && keyInput instanceof CryptoKey) {
    return keyInput;
  }
  if (typeof keyInput === 'object' && keyInput !== null) {
    return crypto.subtle.importKey(
      'jwk',
      keyInput as JsonWebKey,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );
  }
  if (typeof keyInput === 'string') {
    const trimmed = keyInput.trim();
    if (trimmed.startsWith('{')) {
      const jwk = JSON.parse(trimmed);
      return importRsaPrivateKey(jwk);
    }
    const bytes = pemToBinary(trimmed);
    return crypto.subtle.importKey(
      'pkcs8',
      bytes,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );
  }
  throw new Error('Unsupported RSA private key format');
}

/**
 * Encrypts a password with RSA-OAEP and returns URL-safe Base64 ciphertext.
 */
export async function encryptPassword(
  password: string,
  publicKey: CryptoKey | string | JsonWebKey
): Promise<string> {
  const key = await importRsaPublicKey(publicKey);
  const data = new TextEncoder().encode(password);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    data
  );
  const bytes = new Uint8Array(cipherBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decrypts a URL-safe Base64 ciphertext with RSA-OAEP and returns the plaintext password.
 */
export async function decryptPassword(
  encryptedBase64: string,
  privateKey: CryptoKey | string | JsonWebKey
): Promise<string> {
  try {
    const key = await importRsaPrivateKey(privateKey);
    let base64 = encryptedBase64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      key,
      bytes
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Failed to decrypt CalDAV password: ' + (err instanceof Error ? err.message : String(err)));
  }
}
