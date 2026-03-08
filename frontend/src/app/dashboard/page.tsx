'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Zap, Plus, Copy, ExternalLink, Trash2, Radio, MoreVertical,
  Search, LogOut, ChevronRight, Globe, Clock, Hash,
  BarChart2, Users, Key, CreditCard, SearchIcon
} from 'lucide-react';
import { endpointApi, Endpoint } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadEndpoints = useCallback(async () => {
    try {
      const res = await endpointApi.list();
      setEndpoints(res.endpoints);
    } catch (err) {
      toast.error('Failed to load endpoints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEndpoints(); }, [loadEndpoints]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const ep = await endpointApi.create({ name: newName.trim() });
      setEndpoints([ep, ...endpoints]);
      setNewName('');
      setShowCreateModal(false);
      toast.success('Endpoint created!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this endpoint? All webhooks will be lost.')) return;
    try {
      await endpointApi.delete(id);
      setEndpoints(endpoints.filter((ep) => ep.id !== id));
      toast.success('Endpoint deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  const filtered = endpoints.filter((ep) =>
    ep.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const navItems = [
    { href: '/dashboard/search', icon: SearchIcon, label: 'Search', plans: ['free', 'pro', 'team'] },
    { href: '/dashboard/analytics', icon: BarChart2, label: 'Analytics', plans: ['free', 'pro', 'team'] },
    { href: '/dashboard/teams', icon: Users, label: 'Teams', plans: ['team'], badge: 'Team' },
    { href: '/dashboard/api-keys', icon: Key, label: 'API Keys', plans: ['pro', 'team'], badge: 'Pro' },
    { href: '/billing', icon: CreditCard, label: 'Billing', plans: ['free', 'pro', 'team'] },
  ];

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-surface-800/50 bg-surface-900/30 flex flex-col">
        <div className="p-4 border-b border-surface-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">HookLens</span>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {/* Endpoints section */}
          <div className="text-xs font-medium text-surface-500 uppercase tracking-wider px-3 mb-2">
            Endpoints
          </div>
          <div className="space-y-0.5">
            {endpoints.map((ep) => (
              <Link
                key={ep.id}
                href={`/dashboard/endpoints/${ep.id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-surface-300 hover:bg-surface-800 hover:text-white transition-colors group"
              >
                <Radio className={`w-3.5 h-3.5 ${ep.active ? 'text-emerald-400' : 'text-surface-500'}`} />
                <span className="truncate flex-1">{ep.name}</span>
                <span className="text-xs text-surface-500 group-hover:text-surface-400">
                  {ep.webhookCount}
                </span>
              </Link>
            ))}
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-surface-400 hover:bg-surface-800 hover:text-brand-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Endpoint
          </button>

          {/* Tools section */}
          <div className="text-xs font-medium text-surface-500 uppercase tracking-wider px-3 mb-2 mt-5">
            Tools
          </div>
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const plan = user?.plan || 'free';
              const locked = !item.plans.includes(plan);
              return (
                <Link
                  key={item.href}
                  href={locked ? '/billing' : item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    locked
                      ? 'text-surface-600 cursor-pointer hover:bg-surface-800/50'
                      : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  <span className="flex-1">{item.label}</span>
                  {locked && item.badge && (
                    <span className="text-xs bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded text-[10px]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-surface-800/50 p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.name}</div>
              <div className="text-xs text-surface-500 capitalize truncate">{user?.plan} plan</div>
            </div>
            <button
              onClick={() => { logout(); router.push('/login'); }}
              className="text-surface-500 hover:text-red-400 transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>


      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-surface-800/50 bg-surface-900/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Dashboard</h1>
              <p className="text-sm text-surface-400">Manage your webhook endpoints</p>
            </div>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> New Endpoint
            </button>
          </div>
        </header>

        {/* Search */}
        <div className="px-6 py-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              className="input pl-9 text-sm"
              placeholder="Search endpoints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Endpoints Grid */}
        <div className="flex-1 px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-800 flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-surface-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No endpoints yet</h3>
              <p className="text-sm text-surface-400 mb-4">Create your first endpoint to start capturing webhooks</p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Endpoint
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((ep) => (
                <div key={ep.id} className="glass-hover p-5 group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Radio className={`w-4 h-4 ${ep.active ? 'text-emerald-400' : 'text-surface-500'}`} />
                      <h3 className="text-sm font-semibold text-white">{ep.name}</h3>
                    </div>
                    <button
                      onClick={() => handleDelete(ep.id)}
                      className="opacity-0 group-hover:opacity-100 text-surface-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <code className="text-xs text-surface-400 bg-surface-800 px-2 py-1 rounded font-mono truncate flex-1">
                      {ep.url}
                    </code>
                    <button onClick={() => copyUrl(ep.url)} className="text-surface-500 hover:text-brand-400 transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-surface-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" /> {ep.webhookCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatTime(ep.lastWebhookAt)}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/endpoints/${ep.id}`}
                      className="flex items-center gap-1 text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 w-full max-w-md animate-slide-up m-4">
            <h2 className="text-lg font-bold text-white mb-4">Create New Endpoint</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Stripe Webhooks"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
