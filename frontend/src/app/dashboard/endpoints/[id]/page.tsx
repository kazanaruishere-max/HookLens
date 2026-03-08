'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Radio, Clock, Shield, Bot, ChevronRight,
  RefreshCw, Search, Loader2, Zap
} from 'lucide-react';
import { endpointApi, webhookApi, Endpoint, WebhookSummary } from '@/lib/api';
import { useRealtime } from '@/hooks/use-realtime';
import { toast } from 'sonner';

const PROVIDER_COLORS: Record<string, string> = {
  stripe: 'bg-[#635BFF]',
  github: 'bg-[#24292F]',
  shopify: 'bg-[#96BF48]',
  twilio: 'bg-[#F22F46]',
  sendgrid: 'bg-[#1A82E2]',
};

export default function EndpointDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async () => {
    try {
      const [ep, wh] = await Promise.all([
        endpointApi.get(id),
        webhookApi.list(id, page),
      ]);
      setEndpoint(ep);
      setWebhooks(wh.webhooks);
      setTotalPages(wh.pagination.totalPages);
    } catch (err) {
      toast.error('Failed to load endpoint data');
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time updates
  useRealtime({
    endpointId: id,
    onWebhookReceived: (event) => {
      setWebhooks((prev) => [{
        id: event.id,
        endpointId: event.endpointId,
        provider: event.provider,
        eventType: event.eventType,
        method: 'POST',
        responseCode: 200,
        responseTimeMs: null,
        signatureValid: event.signatureValid,
        aiAnalyzed: false,
        forwarded: false,
        shared: false,
        createdAt: event.timestamp,
      }, ...prev]);
      toast('New webhook received!', { icon: '🔔' });
    },
  });

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied');
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <div className="border-b border-surface-800/50 bg-surface-900/20">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-surface-400 mb-3">
            <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white">{endpoint?.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-emerald-400" />
              <div>
                <h1 className="text-xl font-bold text-white">{endpoint?.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm text-surface-400 font-mono">{endpoint?.url}</code>
                  <button onClick={() => copyUrl(endpoint?.url || '')} className="text-surface-500 hover:text-brand-400">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-emerald-400">
                <div className="live-dot" />
                <span>Live</span>
              </div>
              <button onClick={loadData} className="btn-ghost text-sm p-2" title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Webhook List */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-surface-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Waiting for webhooks...</h3>
            <p className="text-sm text-surface-400 mb-4">Send a POST request to your endpoint URL to get started</p>
            <div className="glass p-4 text-left max-w-md">
              <p className="text-xs text-surface-500 mb-2 font-medium">Quick Test:</p>
              <code className="text-sm text-brand-400 font-mono break-all">
                curl -X POST {endpoint?.url} -H &quot;Content-Type: application/json&quot; -d &apos;{'{'}  &quot;event&quot;: &quot;test&quot; {'}'}&apos;
              </code>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-surface-500 uppercase tracking-wider">
              <div className="col-span-1">Status</div>
              <div className="col-span-2">Provider</div>
              <div className="col-span-3">Event</div>
              <div className="col-span-1">Method</div>
              <div className="col-span-2">Signature</div>
              <div className="col-span-1">AI</div>
              <div className="col-span-2">Time</div>
            </div>

            {/* Webhook Rows */}
            {webhooks.map((wh, i) => (
              <Link
                key={wh.id}
                href={`/dashboard/webhooks/${wh.id}`}
                className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-lg hover:bg-surface-800/50 transition-colors group cursor-pointer ${
                  i === 0 ? 'animate-slide-down bg-surface-800/20' : ''
                }`}
              >
                {/* Status */}
                <div className="col-span-1 flex items-center">
                  <span className={`w-2 h-2 rounded-full ${
                    wh.responseCode && wh.responseCode >= 200 && wh.responseCode < 300
                      ? 'bg-emerald-400'
                      : wh.responseCode && wh.responseCode >= 400
                        ? 'bg-red-400'
                        : 'bg-surface-400'
                  }`} />
                </div>

                {/* Provider */}
                <div className="col-span-2 flex items-center gap-2">
                  {wh.provider ? (
                    <>
                      <span className={`provider-dot ${PROVIDER_COLORS[wh.provider] || 'bg-surface-400'}`} />
                      <span className="text-sm text-surface-200 capitalize">{wh.provider}</span>
                    </>
                  ) : (
                    <span className="text-sm text-surface-500">Unknown</span>
                  )}
                </div>

                {/* Event */}
                <div className="col-span-3 flex items-center">
                  <span className="text-sm text-surface-300 font-mono truncate">
                    {wh.eventType || '—'}
                  </span>
                </div>

                {/* Method */}
                <div className="col-span-1 flex items-center">
                  <span className="method-post">{wh.method}</span>
                </div>

                {/* Signature */}
                <div className="col-span-2 flex items-center gap-1.5">
                  {wh.signatureValid === null ? (
                    <span className="text-xs text-surface-500">N/A</span>
                  ) : wh.signatureValid ? (
                    <span className="badge-success">✓ Valid</span>
                  ) : (
                    <span className="badge-error">✗ Invalid</span>
                  )}
                </div>

                {/* AI */}
                <div className="col-span-1 flex items-center">
                  {wh.aiAnalyzed ? (
                    <Bot className="w-4 h-4 text-brand-400" />
                  ) : (
                    <span className="text-xs text-surface-600">—</span>
                  )}
                </div>

                {/* Time */}
                <div className="col-span-2 flex items-center justify-between">
                  <span className="text-sm text-surface-400">{formatTime(wh.createdAt)}</span>
                  <ChevronRight className="w-4 h-4 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              className="btn-ghost text-sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span className="text-sm text-surface-400">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn-ghost text-sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
