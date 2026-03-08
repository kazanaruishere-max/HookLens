'use client';

import Link from 'next/link';
import { Zap, Shield, Bot, ArrowRight, Globe, Clock, Users } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950">
      {/* Nav */}
      <nav className="border-b border-surface-800/50 bg-surface-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">HookLens</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="btn-ghost text-sm">Log In</Link>
            <Link href="/signup" className="btn-primary text-sm flex items-center gap-2">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-32">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-500/8 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-500/10 rounded-full blur-[120px]" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="badge-info mb-6 inline-flex gap-2">
            <Bot className="w-3.5 h-3.5" /> AI-Powered Debugging
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight mb-6 text-balance">
            Debug Webhooks{' '}
            <span className="gradient-text">10x Faster</span>
          </h1>

          <p className="text-lg md:text-xl text-surface-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Capture, inspect, and debug webhooks in real-time. AI-powered analysis automatically identifies errors and suggests fixes.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary text-base px-6 py-3 flex items-center gap-2">
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#features" className="btn-secondary text-base px-6 py-3">
              See Features
            </Link>
          </div>

          <p className="text-sm text-surface-500 mt-4">Free forever • No credit card • 30-second setup</p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-surface-800/50 bg-surface-900/30">
        <div className="max-w-5xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Response Time', value: '<100ms', icon: Clock },
            { label: 'Providers', value: '5+', icon: Globe },
            { label: 'AI Accuracy', value: '95%', icon: Bot },
            { label: 'Active Users', value: '1K+', icon: Users },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-surface-400 mt-1 flex items-center justify-center gap-1.5">
                <stat.icon className="w-3.5 h-3.5" /> {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need to Debug Webhooks
            </h2>
            <p className="text-surface-400 max-w-2xl mx-auto">
              From real-time capture to AI-powered analysis — all in one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: 'Real-Time Capture',
                desc: 'Instant webhook delivery with <500ms latency. See webhooks appear the moment they arrive.',
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
              },
              {
                icon: Bot,
                title: 'AI Analysis',
                desc: 'Claude AI automatically identifies errors, suggests fixes, and provides code examples.',
                color: 'text-brand-400',
                bg: 'bg-brand-500/10',
              },
              {
                icon: Shield,
                title: 'Signature Validation',
                desc: 'Auto-detect and validate signatures for Stripe, GitHub, Shopify, Twilio, and more.',
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
              },
            ].map((feature) => (
              <div key={feature.title} className="glass-hover p-6">
                <div className={`w-10 h-10 rounded-lg ${feature.bg} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-surface-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="glass p-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Debug Smarter?
            </h2>
            <p className="text-surface-400 mb-8">
              Join thousands of developers who debug webhooks 10x faster.
            </p>
            <Link href="/signup" className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-800/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-surface-500">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span>HookLens © 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-surface-300 transition-colors">Docs</a>
            <a href="#" className="hover:text-surface-300 transition-colors">GitHub</a>
            <a href="#" className="hover:text-surface-300 transition-colors">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
