/**
 * Signature Validation Service
 * Validates webhook signatures using provider-specific algorithms.
 * Uses Web Crypto API (edge-compatible).
 * PRD: FR-3, US-2.2, NFR-4 (timing-safe)
 */

export interface SignatureResult {
  valid: boolean;
  expected?: string;
  received?: string;
  algorithm: string;
  error?: string;
}

export async function validateSignature(
  provider: string,
  payload: string,
  headers: Record<string, string>,
  secret: string
): Promise<SignatureResult> {
  const lowerHeaders: Record<string, string> = {};
  for (const key of Object.keys(headers)) {
    lowerHeaders[key.toLowerCase()] = headers[key];
  }

  try {
    switch (provider) {
      case 'stripe':
        return await validateStripeSignature(payload, lowerHeaders['stripe-signature'], secret);
      case 'github':
        return await validateGitHubSignature(payload, lowerHeaders['x-hub-signature-256'], secret);
      case 'shopify':
        return await validateShopifySignature(payload, lowerHeaders['x-shopify-hmac-sha256'], secret);
      case 'twilio':
        return await validateTwilioSignature(payload, lowerHeaders['x-twilio-signature'], secret);
      default:
        return { valid: false, algorithm: 'unknown', error: 'Unsupported provider' };
    }
  } catch (err) {
    return {
      valid: false,
      algorithm: 'unknown',
      error: err instanceof Error ? err.message : 'Validation error',
    };
  }
}

// --- HMAC helpers using Web Crypto API ---

async function hmacSign(algorithm: string, key: string, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Timing-safe comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// --- Provider-specific validators ---

async function validateStripeSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): Promise<SignatureResult> {
  if (!signature) {
    return { valid: false, algorithm: 'HMAC-SHA256', error: 'Missing stripe-signature header' };
  }

  const parts: Record<string, string> = {};
  for (const part of signature.split(',')) {
    const [key, ...valueParts] = part.split('=');
    parts[key] = valueParts.join('=');
  }

  const timestamp = parts['t'];
  const receivedSig = parts['v1'];

  if (!timestamp || !receivedSig) {
    return { valid: false, algorithm: 'HMAC-SHA256', error: 'Invalid stripe-signature format' };
  }

  const signedPayload = `${timestamp}.${payload}`;
  const hmac = await hmacSign('SHA-256', secret, signedPayload);
  const expectedSig = bufferToHex(hmac);

  return {
    valid: timingSafeEqual(receivedSig, expectedSig),
    expected: expectedSig,
    received: receivedSig,
    algorithm: 'HMAC-SHA256',
  };
}

async function validateGitHubSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): Promise<SignatureResult> {
  if (!signature) {
    return { valid: false, algorithm: 'HMAC-SHA256', error: 'Missing x-hub-signature-256 header' };
  }

  const receivedSig = signature.replace('sha256=', '');
  const hmac = await hmacSign('SHA-256', secret, payload);
  const expectedSig = bufferToHex(hmac);

  return {
    valid: timingSafeEqual(receivedSig, expectedSig),
    expected: expectedSig,
    received: receivedSig,
    algorithm: 'HMAC-SHA256',
  };
}

async function validateShopifySignature(
  payload: string,
  signature: string | undefined,
  secret: string
): Promise<SignatureResult> {
  if (!signature) {
    return { valid: false, algorithm: 'HMAC-SHA256', error: 'Missing x-shopify-hmac-sha256 header' };
  }

  const hmac = await hmacSign('SHA-256', secret, payload);
  const expectedSig = bufferToBase64(hmac);

  return {
    valid: timingSafeEqual(signature, expectedSig),
    expected: expectedSig,
    received: signature,
    algorithm: 'HMAC-SHA256 (Base64)',
  };
}

async function validateTwilioSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): Promise<SignatureResult> {
  if (!signature) {
    return { valid: false, algorithm: 'HMAC-SHA1', error: 'Missing x-twilio-signature header' };
  }

  const hmac = await hmacSign('SHA-1', secret, payload);
  const expectedSig = bufferToBase64(hmac);

  return {
    valid: timingSafeEqual(signature, expectedSig),
    expected: expectedSig,
    received: signature,
    algorithm: 'HMAC-SHA1',
  };
}
