/**
 * AES-256-CBC encryption for signing secrets stored at rest.
 * Uses Web Crypto API (available in Cloudflare Workers).
 */

async function getKey(hexKey: string): Promise<CryptoKey> {
  const keyBuffer = hexToBuffer(hexKey);
  return crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function encrypt(text: string, encryptionKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await getKey(encryptionKey);
  const encoded = new TextEncoder().encode(text);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    encoded
  );

  return bufferToHex(iv.buffer) + ':' + bufferToHex(encrypted);
}

export async function decrypt(encryptedText: string, encryptionKey: string): Promise<string> {
  const [ivHex, dataHex] = encryptedText.split(':');
  const iv = hexToBuffer(ivHex);
  const data = hexToBuffer(dataHex);
  const key = await getKey(encryptionKey);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: new Uint8Array(iv) },
    key,
    data
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a random 32-byte hex encryption key.
 * Run once: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateEncryptionKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bufferToHex(bytes.buffer);
}
