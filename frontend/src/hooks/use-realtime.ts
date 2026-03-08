/**
 * useRealtime Hook — Socket.io WebSocket for real-time webhook updates
 */
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;

function getSocket(token: string): Socket {
  if (socket && socket.connected) return socket;

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
}

interface WebhookReceivedEvent {
  id: string;
  endpointId: string;
  provider: string | null;
  eventType: string | null;
  signatureValid: boolean | null;
  timestamp: string;
}

interface UseRealtimeOptions {
  endpointId: string;
  onWebhookReceived?: (event: WebhookReceivedEvent) => void;
  onAnalysisComplete?: (data: { webhookId: string; analysis: unknown }) => void;
}

export function useRealtime({ endpointId, onWebhookReceived, onAnalysisComplete }: UseRealtimeOptions) {
  const token = useAuthStore((s) => s.token);
  const callbackRef = useRef({ onWebhookReceived, onAnalysisComplete });

  useEffect(() => {
    callbackRef.current = { onWebhookReceived, onAnalysisComplete };
  });

  useEffect(() => {
    if (!token || !endpointId) return;

    const s = getSocket(token);

    const handleConnect = () => {
      s.emit('subscribe', endpointId);
    };

    const handleWebhookReceived = (event: WebhookReceivedEvent) => {
      callbackRef.current.onWebhookReceived?.(event);
    };

    const handleAnalysisComplete = (data: { webhookId: string; analysis: unknown }) => {
      callbackRef.current.onAnalysisComplete?.(data);
    };

    s.on('connect', handleConnect);
    s.on('webhook_received', handleWebhookReceived);
    s.on('analysis_complete', handleAnalysisComplete);

    // If already connected, subscribe immediately
    if (s.connected) {
      s.emit('subscribe', endpointId);
    }

    return () => {
      s.emit('unsubscribe', endpointId);
      s.off('connect', handleConnect);
      s.off('webhook_received', handleWebhookReceived);
      s.off('analysis_complete', handleAnalysisComplete);
    };
  }, [token, endpointId]);

  const isConnected = useCallback(() => {
    return socket?.connected || false;
  }, []);

  return { isConnected };
}
