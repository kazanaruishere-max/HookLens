'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, Clock, Zap, Globe, Activity } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
const COLORS = ['#338bff', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface Overview {
  totalWebhooks: number;
  successRate: number;
  errorCount: number;
  avgResponseTime: number;
  providerBreakdown: { provider: string; count: number }[];
  topEvents: { eventType: string; count: number }[];
}

interface TimePoint {
  period: string;
  total: number;
  successes: number;
  errors: number;
  avgResponseMs: number;
}

export default function AnalyticsPage() {
  const { token } = useAuthStore();
  const [days, setDays] = useState(7);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<TimePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [ovRes, tsRes] = await Promise.all([
          fetch(`${API_URL}/api/analytics/overview?days=${days}`, { headers }),
          fetch(`${API_URL}/api/analytics/timeseries?days=${days}`, { headers }),
        ]);
        const [ov, ts] = await Promise.all([ovRes.json(), tsRes.json()]);
        setOverview(ov);
        setSeries(ts.series || []);
      } catch { toast.error('Failed to load analytics'); }
      finally { setLoading(false); }
    };
    if (token) load();
  }, [token, days]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });

  const stats = [
    {
      label: 'Total Webhooks',
      value: overview?.totalWebhooks?.toLocaleString() || '0',
      icon: Zap,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10',
    },
    {
      label: 'Success Rate',
      value: `${overview?.successRate || 0}%`,
      icon: overview && overview.successRate >= 95 ? TrendingUp : TrendingDown,
      color: overview && overview.successRate >= 95 ? 'text-emerald-400' : 'text-amber-400',
      bg: overview && overview.successRate >= 95 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
    },
    {
      label: 'Errors',
      value: overview?.errorCount?.toLocaleString() || '0',
      icon: AlertCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: 'Avg Response',
      value: `${overview?.avgResponseTime || 0}ms`,
      icon: Clock,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-surface-400 text-sm mt-1">Webhook performance & trends</p>
          </div>
          <div className="flex gap-2">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  days === d
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                    : 'text-surface-400 hover:text-white hover:bg-surface-800'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="glass p-5">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-white">{loading ? '—' : stat.value}</div>
              <div className="text-xs text-surface-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Chart: Volume over time */}
        <div className="glass p-6 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-400" /> Webhook Volume
          </h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-surface-500">Loading...</div>
          ) : series.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-surface-500 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" tickFormatter={formatDate} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  labelFormatter={formatDate}
                />
                <Line type="monotone" dataKey="total" stroke="#338bff" strokeWidth={2} dot={false} name="Total" />
                <Line type="monotone" dataKey="successes" stroke="#22c55e" strokeWidth={2} dot={false} name="Success" />
                <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={false} name="Errors" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Provider breakdown */}
          <div className="glass p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" /> By Provider
            </h3>
            {!loading && overview?.providerBreakdown && overview.providerBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={overview.providerBreakdown}
                    dataKey="count"
                    nameKey="provider"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ provider, percent }) => `${provider} ${Math.round(percent * 100)}%`}
                  >
                    {overview.providerBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-surface-500 text-sm">No data</div>
            )}
          </div>

          {/* Top events */}
          <div className="glass p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Top Event Types</h3>
            {!loading && overview?.topEvents && overview.topEvents.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={overview.topEvents} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <YAxis type="category" dataKey="eventType" tick={{ fill: '#94a3b8', fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#338bff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-surface-500 text-sm">No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
