'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ExternalLink, CheckCircle2, Clock, Loader2, Zap, ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

interface BillingStatus {
  plan: string;
  subscription: {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export default function BillingPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/billing/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setBilling(data);
      } catch { toast.error('Failed to load billing status'); }
      finally { setLoading(false); }
    };
    if (token) load();
  }, [token]);

  const handleCheckout = async (plan: 'pro' | 'team') => {
    setLoadingAction(plan);
    try {
      const res = await fetch(`${API_URL}/billing/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { toast.error('Failed to start checkout'); }
    finally { setLoadingAction(''); }
  };

  const handlePortal = async () => {
    setLoadingAction('portal');
    try {
      const res = await fetch(`${API_URL}/billing/portal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank');
    } catch { toast.error('Failed to open billing portal'); }
    finally { setLoadingAction(''); }
  };

  const planColors: Record<string, string> = {
    free: 'text-surface-400',
    pro: 'text-brand-400',
    team: 'text-emerald-400',
  };

  return (
    <div className="min-h-screen bg-surface-950 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
          <p className="text-surface-400 text-sm mt-1">Manage your subscription and billing</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current Plan */}
            <div className="glass p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Current Plan</h2>
                  <div className={`text-2xl font-extrabold mt-1 capitalize ${planColors[billing?.plan || 'free']}`}>
                    {billing?.plan || 'Free'}
                  </div>
                </div>
                {billing?.subscription && (
                  <div className="text-right text-sm">
                    <span className={`badge ${billing.subscription.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                      {billing.subscription.status}
                    </span>
                    <div className="text-surface-500 mt-1 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      Renews {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>

              {billing?.subscription?.cancelAtPeriodEnd && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300 mb-4">
                  ⚠️ Cancels at period end — you'll be downgraded to Free.
                </div>
              )}

              {billing?.subscription ? (
                <button
                  onClick={handlePortal}
                  className="btn-secondary text-sm flex items-center gap-2"
                  disabled={loadingAction === 'portal'}
                >
                  {loadingAction === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Manage Subscription
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleCheckout('pro')}
                    className="btn-primary text-sm flex items-center gap-2"
                    disabled={!!loadingAction}
                  >
                    {loadingAction === 'pro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Upgrade to Pro — $12/mo
                  </button>
                  <button
                    onClick={() => handleCheckout('team')}
                    className="btn-secondary text-sm flex items-center gap-2"
                    disabled={!!loadingAction}
                  >
                    {loadingAction === 'team' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                    Team — $39/mo
                  </button>
                </div>
              )}
            </div>

            {/* Feature comparison */}
            <div className="glass p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Your Current Limits</h3>
              <div className="space-y-3">
                {[
                  { label: 'Endpoints', free: '3', pro: '20', team: '100' },
                  { label: 'History', free: '7 days', pro: '30 days', team: '90 days' },
                  { label: 'API Access', free: '—', pro: '✓', team: '✓' },
                  { label: 'Team Features', free: '—', pro: '—', team: '✓' },
                ].map((row) => {
                  const plan = (billing?.plan || 'free') as 'free' | 'pro' | 'team';
                  const value = row[plan];
                  return (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <span className="text-surface-400">{row.label}</span>
                      <span className={value === '—' ? 'text-surface-600' : 'text-white font-medium'}>{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
