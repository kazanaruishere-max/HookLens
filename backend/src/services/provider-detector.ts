/**
 * Provider Detection Service
 * Auto-detects webhook provider from headers.
 * PRD: FR-3.1, US-2.1
 */

export interface ProviderConfig {
  name: string;
  displayName: string;
  detectBy: string[];
  signatureHeader: string;
  algorithm: 'HMAC-SHA256' | 'HMAC-SHA1' | 'ECDSA';
  color: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'stripe',
    displayName: 'Stripe',
    detectBy: ['stripe-signature'],
    signatureHeader: 'stripe-signature',
    algorithm: 'HMAC-SHA256',
    color: '#635BFF',
  },
  {
    name: 'github',
    displayName: 'GitHub',
    detectBy: ['x-hub-signature-256', 'x-github-event'],
    signatureHeader: 'x-hub-signature-256',
    algorithm: 'HMAC-SHA256',
    color: '#24292F',
  },
  {
    name: 'shopify',
    displayName: 'Shopify',
    detectBy: ['x-shopify-hmac-sha256'],
    signatureHeader: 'x-shopify-hmac-sha256',
    algorithm: 'HMAC-SHA256',
    color: '#96BF48',
  },
  {
    name: 'twilio',
    displayName: 'Twilio',
    detectBy: ['x-twilio-signature'],
    signatureHeader: 'x-twilio-signature',
    algorithm: 'HMAC-SHA1',
    color: '#F22F46',
  },
  {
    name: 'sendgrid',
    displayName: 'SendGrid',
    detectBy: ['x-twilio-email-event-webhook-signature'],
    signatureHeader: 'x-twilio-email-event-webhook-signature',
    algorithm: 'ECDSA',
    color: '#1A82E2',
  },
];

export function detectProvider(headers: Record<string, string>): ProviderConfig | null {
  const lowerHeaders: Record<string, string> = {};
  for (const key of Object.keys(headers)) {
    lowerHeaders[key.toLowerCase()] = headers[key];
  }

  for (const provider of PROVIDERS) {
    const hasAllHeaders = provider.detectBy.every(
      (header) => header.toLowerCase() in lowerHeaders
    );
    if (hasAllHeaders) {
      return provider;
    }
  }

  return null;
}

export function extractEventType(
  providerName: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>
): string | null {
  const lowerHeaders: Record<string, string> = {};
  for (const key of Object.keys(headers)) {
    lowerHeaders[key.toLowerCase()] = headers[key];
  }

  switch (providerName) {
    case 'stripe':
      return (payload.type as string) || null;
    case 'github':
      return lowerHeaders['x-github-event'] || null;
    case 'shopify':
      return lowerHeaders['x-shopify-topic'] || null;
    case 'twilio':
      return (payload.EventType as string) || null;
    case 'sendgrid':
      if (Array.isArray(payload) && payload[0]) {
        return (payload[0] as Record<string, unknown>).event as string || null;
      }
      return null;
    default:
      return null;
  }
}

export function getProviderConfig(name: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.name === name);
}

export function getAllProviders(): ProviderConfig[] {
  return PROVIDERS;
}
