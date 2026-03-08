'use client';

import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Loader2, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { token, user } = useAuthStore();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/api/api-keys`, { headers });
      const data = await res.json();
      setKeys(data.keys || []);
    } catch { toast.error('Failed to load API keys'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) load(); }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const body: Record<string, unknown> = { name: newKeyName, scopes: ['read', 'write'] };
      if (newKeyExpiry) body.expiresInDays = parseInt(newKeyExpiry);

      const res = await fetch(`${API_URL}/api/api-keys`, {
        method: 'POST', headers, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRevealedKey(data.key.fullKey);
      setKeys([...keys, data.key]);
      setNewKeyName('');
      setNewKeyExpiry('');
      setShowCreate(false);
      toast.success('API key created! Copy it now — it won\'t be shown again.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await fetch(`${API_URL}/api/api-keys/${id}`, { method: 'DELETE', headers });
      setKeys(keys.filter(k => k.id !== id));
      toast.success('Key revoked');
    } catch { toast.error('Failed to revoke key'); }
  };

  const isPlanOk = user?.plan === 'pro' || user?.plan === 'team';
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

  return (
    <div className="min-h-screen bg-surface-950 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">API Keys</h1>
            <p className="text-surface-400 text-sm mt-1">Access the HookLens API programmatically</p>
          </div>
          {isPlanOk && (
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Key
            </button>
          )}
        </div>

        {!isPlanOk ? (
          <div className="glass text-center py-16">
            <Shield className="w-12 h-12 text-surface-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-white mb-2">Pro Feature</h3>
            <p className="text-surface-400 text-sm mb-4">API access requires the Pro or Team plan.</p>
            <a href="/billing" className="btn-primary text-sm inline-block">Upgrade Now</a>
          </div>
        ) : (
          <>
            {/* One-time reveal */}
            {revealedKey && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6">
                <div className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" /> Your new API key (copy now — won't show again)
                </div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm text-white flex-1 bg-surface-900 p-2 rounded truncate">{revealedKey}</code>
                  <button onClick={() => { navigator.clipboard.writeText(revealedKey); toast.success('Copied!'); }} className="btn-primary text-sm p-2">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={() => setRevealedKey('')} className="text-xs text-surface-500 mt-2 hover:text-surface-300">Dismiss</button>
              </div>
            )}

            {/* Create form */}
            {showCreate && (
              <div className="glass p-5 mb-6">
                <h3 className="text-sm font-semibold text-white mb-3">Create API Key</h3>
                <form onSubmit={handleCreate} className="space-y-3">
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="Key name (e.g. CI/CD Pipeline)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    required
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <select className="input text-sm flex-1" value={newKeyExpiry} onChange={(e) => setNewKeyExpiry(e.target.value)}>
                      <option value="">Never expire</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                    </select>
                    <button type="submit" className="btn-primary text-sm" disabled={creating}>
                      {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                    </button>
                    <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost text-sm">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Keys List */}
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-brand-500 animate-spin" /></div>
            ) : keys.length === 0 ? (
              <div className="glass text-center py-12">
                <Key className="w-10 h-10 text-surface-600 mx-auto mb-3" />
                <p className="text-surface-400 text-sm">No API keys yet. Create one above.</p>
              </div>
            ) : (
              <div className="glass overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium text-surface-500 uppercase tracking-wider border-b border-surface-700/50">
                  <div className="col-span-3">Name</div>
                  <div className="col-span-3">Key</div>
                  <div className="col-span-2">Scopes</div>
                  <div className="col-span-2">Last Used</div>
                  <div className="col-span-1">Expires</div>
                  <div className="col-span-1"></div>
                </div>
                {keys.map((k) => (
                  <div key={k.id} className="grid grid-cols-12 items-center px-4 py-3 border-b border-surface-800/30 last:border-0 hover:bg-surface-800/20 transition-colors">
                    <div className="col-span-3 text-sm font-medium text-white truncate">{k.name}</div>
                    <div className="col-span-3 font-mono text-xs text-surface-400">{k.keyPrefix}••••••••</div>
                    <div className="col-span-2">
                      {(k.scopes as string[]).map(s => (
                        <span key={s} className="badge-info text-xs mr-1">{s}</span>
                      ))}
                    </div>
                    <div className="col-span-2 text-xs text-surface-500">{fmt(k.lastUsedAt)}</div>
                    <div className="col-span-1 text-xs text-surface-500">{fmt(k.expiresAt)}</div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => handleRevoke(k.id)} className="text-surface-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Usage docs */}
            <div className="glass p-5 mt-6">
              <h4 className="text-sm font-semibold text-white mb-3">Usage</h4>
              <pre className="text-xs text-brand-300 font-mono bg-surface-900 p-3 rounded-lg overflow-x-auto">
{`curl https://api.hooklens.dev/api/webhooks \\
  -H "X-API-Key: hl_your_key_here"`}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
