'use client';

import { useState, useEffect, use } from 'react';
import { Zap, Clock, Globe, Shield, Bot, CheckCircle2, XCircle, Code2, Hash } from 'lucide-react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

SyntaxHighlighter.registerLanguage('json', json);

interface SharedWebhook {
  id: string;
  provider: string | null;
  eventType: string | null;
  method: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  signatureValid: boolean | null;
  signatureAlgorithm: string | null;
  createdAt: string;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [webhook, setWebhook] = useState<SharedWebhook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
        const res = await fetch(`${API_URL}/share/${token}`);
        if (!res.ok) throw new Error('Shared webhook not found');
        const data = await res.json();
        setWebhook(data.webhook);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !webhook) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Shared Webhook Not Found</h1>
          <p className="text-surface-400">This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <nav className="border-b border-surface-800/50 bg-surface-900/30 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">HookLens</span>
            <span className="badge-info">Shared</span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Info */}
        <div className="glass p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-surface-500 block mb-1">Provider</span>
              <span className="text-white capitalize">{webhook.provider || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-surface-500 block mb-1">Event</span>
              <span className="text-white font-mono">{webhook.eventType || 'N/A'}</span>
            </div>
            <div>
              <span className="text-surface-500 block mb-1">Signature</span>
              {webhook.signatureValid === null ? (
                <span className="text-surface-400">N/A</span>
              ) : webhook.signatureValid ? (
                <span className="badge-success"><CheckCircle2 className="w-3 h-3 mr-1" />Valid</span>
              ) : (
                <span className="badge-error"><XCircle className="w-3 h-3 mr-1" />Invalid</span>
              )}
            </div>
            <div>
              <span className="text-surface-500 block mb-1">Received</span>
              <span className="text-white">{new Date(webhook.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Payload */}
        <div className="glass overflow-hidden mb-6">
          <div className="px-4 py-2 border-b border-surface-700/50">
            <span className="text-xs font-medium text-surface-400">Payload</span>
          </div>
          <SyntaxHighlighter
            language="json"
            style={atomOneDark}
            customStyle={{ margin: 0, padding: '16px', background: 'transparent', fontSize: '13px' }}
            showLineNumbers
          >
            {JSON.stringify(webhook.payload, null, 2)}
          </SyntaxHighlighter>
        </div>

        {/* Headers */}
        <div className="glass overflow-hidden">
          <div className="px-4 py-2 border-b border-surface-700/50">
            <span className="text-xs font-medium text-surface-400">Headers</span>
          </div>
          <div className="divide-y divide-surface-800/50">
            {Object.entries(webhook.headers).map(([key, value]) => (
              <div key={key} className="flex items-center px-4 py-2.5">
                <span className="w-56 flex-shrink-0 text-sm font-mono text-brand-400">{key}</span>
                <span className="flex-1 text-sm text-surface-300 font-mono truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
