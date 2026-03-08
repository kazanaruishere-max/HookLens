'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search as SearchIcon, Filter, X, ChevronRight, Bot, Shield, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

const PROVIDERS = ['stripe', 'github', 'shopify', 'twilio', 'sendgrid'];
const STATUSES = [
  { value: 'success', label: '✓ Success' },
  { value: 'error', label: '✗ Error' },
  { value: 'invalid_sig', label: '⚠ Invalid Sig' },
];

interface SearchResult {
  id: string;
  endpoint_id: string;
  endpoint_name: string;
  provider: string | null;
  event_type: string | null;
  method: string;
  response_code: number | null;
  signature_valid: boolean | null;
  ai_analyzed: boolean;
  created_at: string;
}

export default function SearchPage() {
  const { token } = useAuthStore();
  const [q, setQ] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = useCallback(async (p = 1) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set('q', q);
      if (provider) params.set('provider', provider);
      if (status) params.set('status', status);

      const res = await fetch(`${API_URL}/api/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setResults(data.results || []);
      setTotal(data.pagination?.total || 0);
      setPage(p);
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  }, [q, provider, status, token]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(1);
  };

  const clearFilters = () => {
    setQ('');
    setProvider('');
    setStatus('');
    setResults([]);
    setHasSearched(false);
  };

  const formatTime = (d: string) => new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-surface-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Search Webhooks</h1>
          <p className="text-surface-400 text-sm mt-1">Search across all endpoints by payload, event type, IP, and more</p>
        </div>

        {/* Search Form */}
        <div className="glass p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
              <input
                type="text"
                className="input pl-10 text-base"
                placeholder="Search payload content, event type, IP address..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              <select
                className="input flex-1 min-w-[140px] text-sm"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="">All Providers</option>
                {PROVIDERS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
              </select>

              <select
                className="input flex-1 min-w-[140px] text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>

              <button type="submit" className="btn-primary flex items-center gap-2 text-sm" disabled={loading}>
                <SearchIcon className="w-4 h-4" />
                {loading ? 'Searching...' : 'Search'}
              </button>

              {hasSearched && (
                <button type="button" onClick={clearFilters} className="btn-ghost text-sm flex items-center gap-1">
                  <X className="w-4 h-4" /> Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Results */}
        {hasSearched && (
          <div>
            <div className="flex items-center justify-between mb-4 text-sm text-surface-400">
              <span>{loading ? 'Searching...' : `${total} result${total !== 1 ? 's' : ''}`}</span>
            </div>

            {results.length === 0 && !loading ? (
              <div className="text-center py-16 text-surface-500">
                <SearchIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No webhooks found matching your search</p>
              </div>
            ) : (
              <div className="space-y-1">
                {results.map((r) => (
                  <Link
                    key={r.id}
                    href={`/dashboard/webhooks/${r.id}`}
                    className="glass-hover flex items-center gap-4 p-4 group"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      r.response_code && r.response_code < 300 ? 'bg-emerald-400' :
                      r.response_code && r.response_code >= 400 ? 'bg-red-400' : 'bg-surface-500'
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {r.provider && <span className="text-xs text-surface-400 capitalize">{r.provider}</span>}
                        <span className="text-sm font-mono text-white truncate">{r.event_type || 'Unknown event'}</span>
                      </div>
                      <div className="text-xs text-surface-500">{r.endpoint_name}</div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 text-xs text-surface-500">
                      {r.signature_valid === false && <Shield className="w-3.5 h-3.5 text-red-400" />}
                      {r.ai_analyzed && <Bot className="w-3.5 h-3.5 text-brand-400" />}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(r.created_at)}</span>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {total > 20 && (
              <div className="flex justify-center gap-2 mt-6">
                <button className="btn-ghost text-sm" disabled={page <= 1} onClick={() => doSearch(page - 1)}>Previous</button>
                <span className="text-surface-400 text-sm py-2">Page {page} of {Math.ceil(total / 20)}</span>
                <button className="btn-ghost text-sm" disabled={page >= Math.ceil(total / 20)} onClick={() => doSearch(page + 1)}>Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
