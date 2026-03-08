'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Copy, Shield, Bot, Send, Share2, Download,
  ChevronRight, Clock, Globe, Hash, Loader2, CheckCircle2,
  XCircle, AlertTriangle, ExternalLink, Code2, Lightbulb
} from 'lucide-react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { webhookApi, Webhook, AIAnalysis } from '@/lib/api';
import { toast } from 'sonner';

SyntaxHighlighter.registerLanguage('json', json);

type TabType = 'payload' | 'headers' | 'meta' | 'ai';

export default function WebhookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [webhook, setWebhook] = useState<Webhook | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('payload');
  const [analyzing, setAnalyzing] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [forwardUrl, setForwardUrl] = useState('');
  const [showForwardModal, setShowForwardModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await webhookApi.get(id);
        setWebhook(res.webhook);
      } catch { toast.error('Failed to load webhook'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await webhookApi.analyze(id);
      setWebhook((prev) => prev ? { ...prev, aiAnalyzed: true, aiInsights: res.analysis } : null);
      setActiveTab('ai');
      toast.success('Analysis complete!');
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleForward = async (e: React.FormEvent) => {
    e.preventDefault();
    setForwarding(true);
    try {
      const res = await webhookApi.forward(id, forwardUrl);
      toast.success(`Forwarded! Status: ${res.status} (${res.responseTime}ms)`);
      setShowForwardModal(false);
      setWebhook((prev) => prev ? { ...prev, forwarded: true } : null);
    } catch (err: any) {
      toast.error(err.message || 'Forward failed');
    } finally {
      setForwarding(false);
    }
  };

  const handleShare = async () => {
    try {
      const res = await webhookApi.share(id);
      navigator.clipboard.writeText(res.shareUrl);
      toast.success('Share link copied!');
      setWebhook((prev) => prev ? { ...prev, shared: true, shareToken: res.shareToken } : null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleExport = async (format: 'curl' | 'json') => {
    try {
      const res = await webhookApi.export(id, format);
      navigator.clipboard.writeText(typeof res.content === 'string' ? res.content : JSON.stringify(res.content, null, 2));
      toast.success(`${format.toUpperCase()} copied!`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  if (loading || !webhook) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'payload', label: 'Payload', icon: <Code2 className="w-3.5 h-3.5" /> },
    { key: 'headers', label: 'Headers', icon: <Hash className="w-3.5 h-3.5" /> },
    { key: 'meta', label: 'Metadata', icon: <Globe className="w-3.5 h-3.5" /> },
    { key: 'ai', label: 'AI Analysis', icon: <Bot className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <div className="border-b border-surface-800/50 bg-surface-900/20">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-surface-400 mb-3">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <ChevronRight className="w-3 h-3" />
            <button onClick={() => window.history.back()} className="hover:text-white transition-colors">
              Endpoint
            </button>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white font-mono text-xs">{id.substring(0, 8)}...</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => window.history.back()} className="btn-ghost p-2">
                <ArrowLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold text-white">
                    {webhook.provider ? (
                      <span className="capitalize">{webhook.provider}</span>
                    ) : 'Webhook'} — {webhook.eventType || 'Unknown Event'}
                  </h1>
                  {/* Status badge */}
                  {webhook.responseCode && webhook.responseCode < 300 ? (
                    <span className="badge-success"><CheckCircle2 className="w-3 h-3 mr-1" />200 OK</span>
                  ) : (
                    <span className="badge-error"><XCircle className="w-3 h-3 mr-1" />{webhook.responseCode}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-surface-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(webhook.createdAt).toLocaleString()}
                  </span>
                  {webhook.responseTimeMs && (
                    <span>{webhook.responseTimeMs}ms</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={handleAnalyze} className="btn-primary text-sm flex items-center gap-2" disabled={analyzing}>
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                {analyzing ? 'Analyzing...' : 'Analyze with AI'}
              </button>
              <button onClick={() => setShowForwardModal(true)} className="btn-secondary text-sm flex items-center gap-2">
                <Send className="w-4 h-4" /> Forward
              </button>
              <button onClick={handleShare} className="btn-ghost text-sm p-2" title="Share">
                <Share2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleExport('curl')} className="btn-ghost text-sm p-2" title="Export cURL">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Banner */}
      {webhook.signatureValid !== null && (
        <div className={`border-b ${webhook.signatureValid ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
            <Shield className={`w-4 h-4 ${webhook.signatureValid ? 'text-emerald-400' : 'text-red-400'}`} />
            <span className={`text-sm font-medium ${webhook.signatureValid ? 'text-emerald-300' : 'text-red-300'}`}>
              Signature {webhook.signatureValid ? 'Valid' : 'Invalid'} — {webhook.signatureAlgorithm}
            </span>
            {!webhook.signatureValid && webhook.expectedSignature && (
              <button
                onClick={() => copyText(`Expected: ${webhook.expectedSignature}\nReceived: ${webhook.receivedSignature}`)}
                className="text-xs text-surface-400 hover:text-white transition-colors"
              >
                View details
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex gap-1 border-b border-surface-800/50 mt-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'text-brand-400 border-brand-500'
                  : 'text-surface-400 border-transparent hover:text-surface-200 hover:border-surface-600'
              }`}
            >
              {tab.icon} {tab.label}
              {tab.key === 'ai' && webhook.aiAnalyzed && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="py-6 animate-fade-in" key={activeTab}>
          {activeTab === 'payload' && (
            <div className="glass overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-surface-700/50">
                <span className="text-xs font-medium text-surface-400">Request Payload</span>
                <button
                  onClick={() => copyText(JSON.stringify(webhook.payload, null, 2))}
                  className="text-xs text-surface-500 hover:text-brand-400 flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <SyntaxHighlighter
                language="json"
                style={atomOneDark}
                customStyle={{
                  margin: 0,
                  padding: '16px',
                  background: 'transparent',
                  fontSize: '13px',
                  lineHeight: '1.6',
                }}
                showLineNumbers
              >
                {JSON.stringify(webhook.payload, null, 2)}
              </SyntaxHighlighter>
            </div>
          )}

          {activeTab === 'headers' && (
            <div className="glass overflow-hidden">
              <div className="px-4 py-2 border-b border-surface-700/50">
                <span className="text-xs font-medium text-surface-400">
                  Headers ({Object.keys(webhook.headers).length})
                </span>
              </div>
              <div className="divide-y divide-surface-800/50">
                {Object.entries(webhook.headers).map(([key, value]) => (
                  <div key={key} className="flex items-center px-4 py-2.5 group hover:bg-surface-800/30 transition-colors">
                    <span className="w-56 flex-shrink-0 text-sm font-mono text-brand-400 truncate">{key}</span>
                    <span className="flex-1 text-sm text-surface-300 font-mono truncate">{value}</span>
                    <button
                      onClick={() => copyText(value)}
                      className="opacity-0 group-hover:opacity-100 text-surface-500 hover:text-brand-400 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'meta' && (
            <div className="glass p-6 space-y-4">
              {[
                { label: 'Webhook ID', value: webhook.id },
                { label: 'Method', value: webhook.method },
                { label: 'Provider', value: webhook.provider || 'Unknown' },
                { label: 'Event Type', value: webhook.eventType || 'N/A' },
                { label: 'IP Address', value: webhook.ipAddress || 'N/A' },
                { label: 'User Agent', value: webhook.userAgent || 'N/A' },
                { label: 'Response Code', value: webhook.responseCode?.toString() || 'N/A' },
                { label: 'Response Time', value: webhook.responseTimeMs ? `${webhook.responseTimeMs}ms` : 'N/A' },
                { label: 'Received At', value: new Date(webhook.createdAt).toLocaleString() },
                { label: 'Forwarded', value: webhook.forwarded ? 'Yes' : 'No' },
                { label: 'Shared', value: webhook.shared ? 'Yes' : 'No' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-surface-400">{item.label}</span>
                  <span className="text-sm text-surface-200 font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              {!webhook.aiAnalyzed || !webhook.aiInsights ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-brand-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">AI Analysis Not Run Yet</h3>
                  <p className="text-sm text-surface-400 mb-4">Click below to analyze this webhook with Claude AI</p>
                  <button onClick={handleAnalyze} className="btn-primary flex items-center gap-2" disabled={analyzing}>
                    {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    {analyzing ? 'Analyzing...' : 'Analyze with AI'}
                  </button>
                </div>
              ) : (
                <AIAnalysisView analysis={webhook.aiInsights} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Forward Modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 w-full max-w-md animate-slide-up m-4">
            <h2 className="text-lg font-bold text-white mb-2">Forward Webhook</h2>
            <p className="text-sm text-surface-400 mb-4">Send this webhook to another URL</p>
            <form onSubmit={handleForward} className="space-y-4">
              <input
                type="url"
                className="input font-mono text-sm"
                placeholder="http://localhost:3000/api/webhooks"
                value={forwardUrl}
                onChange={(e) => setForwardUrl(e.target.value)}
                required
                autoFocus
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForwardModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={forwarding}>
                  {forwarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {forwarding ? 'Forwarding...' : 'Forward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// AI Analysis Sub-Component
function AIAnalysisView({ analysis }: { analysis: AIAnalysis }) {
  const statusConfig = {
    success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  };

  const config = statusConfig[analysis.status];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Summary */}
      <div className={`glass p-4 ${config.border} border`}>
        <div className="flex items-center gap-2 mb-2">
          <StatusIcon className={`w-5 h-5 ${config.color}`} />
          <span className={`text-sm font-semibold ${config.color}`}>{analysis.status.toUpperCase()}</span>
        </div>
        <p className="text-sm text-surface-200">{analysis.summary}</p>
      </div>

      {/* Issues */}
      {analysis.issues.length > 0 && (
        <div className="glass p-4">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Issues Found
          </h4>
          <ul className="space-y-2">
            {analysis.issues.map((issue, i) => (
              <li key={i} className="text-sm text-surface-300 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span> {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Root Cause */}
      {analysis.rootCause && (
        <div className="glass p-4">
          <h4 className="text-sm font-semibold text-white mb-2">Root Cause</h4>
          <p className="text-sm text-surface-300">{analysis.rootCause}</p>
        </div>
      )}

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div className="glass p-4">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4 text-brand-400" /> Suggestions
          </h4>
          <div className="space-y-3">
            {analysis.suggestions.map((suggestion, i) => (
              <div key={i} className="bg-surface-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{suggestion.title}</span>
                  <span className={`badge ${
                    suggestion.difficulty === 'easy' ? 'badge-success' :
                    suggestion.difficulty === 'medium' ? 'badge-warning' : 'badge-error'
                  }`}>
                    {suggestion.difficulty}
                  </span>
                </div>
                <p className="text-sm text-surface-400 mb-2">{suggestion.description}</p>
                {suggestion.code && (
                  <pre className="text-xs text-brand-300 bg-surface-900 p-2 rounded font-mono overflow-x-auto">
                    {suggestion.code}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Docs */}
      {analysis.relatedDocs.length > 0 && (
        <div className="glass p-4">
          <h4 className="text-sm font-semibold text-white mb-2">Related Documentation</h4>
          <div className="space-y-1">
            {analysis.relatedDocs.map((doc, i) => (
              <a key={i} href={doc} target="_blank" rel="noopener noreferrer"
                className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors">
                <ExternalLink className="w-3 h-3" /> {doc}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
