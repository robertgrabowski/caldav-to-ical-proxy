#!/usr/bin/env node

/**
 * Generates an RSA-OAEP 2048-bit keypair for use with caldav-to-ical-proxy.
 */

async function main() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const privStr = JSON.stringify(privateKeyJwk);
  const pubStr = JSON.stringify(publicKeyJwk);

  console.log('='.repeat(70));
  console.log('RSA-OAEP Key Pair Generated Successfully!');
  console.log('='.repeat(70));
  console.log('\n--- 1. For Local Development (.dev.vars) ---');
  console.log(`Add this line to your .dev.vars file:\n`);
  console.log(`RSA_PRIVATE_KEY='${privStr}'\n`);

  console.log('--- 2. For Production Deployment (Wrangler Secret) ---');
  console.log('Run the following command to securely store your private key:');
  console.log(`\n  echo '${privStr}' | npx wrangler secret put RSA_PRIVATE_KEY\n`);

  console.log('--- Public Key (JWK) ---');
  console.log(pubStr);
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('Error generating keys:', err);
  process.exit(1);
});
