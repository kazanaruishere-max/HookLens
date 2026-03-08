'use client';

import Link from 'next/link';
import { Zap, Check, ArrowRight, Star } from 'lucide-react';

const PLANS = [
  {
    name: 'Free',
    price: 0,
    period: null,
    tagline: 'Perfect for side projects',
    cta: 'Get Started Free',
    href: '/signup',
    highlight: false,
    features: [
      '3 webhook endpoints',
      '50 webhooks per endpoint',
      '7-day history retention',
      'AI analysis (on-demand)',
      'Signature validation',
      'Forward & share',
      'Export cURL/JSON',
    ],
    limits: ['No team access', 'No API access'],
  },
  {
    name: 'Pro',
    price: 12,
    period: 'month',
    tagline: 'For professional developers',
    cta: 'Start Pro',
    href: '/billing/checkout?plan=pro',
    highlight: true,
    features: [
      '20 webhook endpoints',
      '10,000 webhooks per endpoint',
      '30-day history retention',
      'AI analysis (unlimited)',
      'Signature validation',
      'Forward & share',
      'Export cURL/JSON/Postman',
      'REST API access',
      'Priority support',
    ],
    limits: ['No team sharing'],
  },
  {
    name: 'Team',
    price: 39,
    period: 'month',
    tagline: 'Collaborate with your team',
    cta: 'Start Team',
    href: '/billing/checkout?plan=team',
    highlight: false,
    features: [
      '100 webhook endpoints',
      'Unlimited webhooks',
      '90-day history retention',
      'AI analysis (unlimited)',
      'Signature validation',
      'Shared team endpoints',
      'Comments & assignments',
      'Activity log',
      'REST API access',
      'Priority support',
    ],
    limits: [],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface-950">
      {/* Nav */}
      <nav className="border-b border-surface-800/50 bg-surface-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">HookLens</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="btn-ghost text-sm">Log In</Link>
            <Link href="/signup" className="btn-primary text-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-surface-400 text-lg max-w-xl mx-auto">
            Start free. Upgrade when you need more power.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl border p-8 relative ${
                plan.highlight
                  ? 'bg-brand-500/10 border-brand-500/50 shadow-xl shadow-brand-500/10'
                  : 'bg-surface-800/30 border-surface-700/50'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge-info flex items-center gap-1">
                    <Star className="w-3 h-3" /> Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-surface-400 mb-4">{plan.tagline}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                  {plan.period && <span className="text-surface-400">/{plan.period}</span>}
                </div>
              </div>

              <Link
                href={plan.href}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all mb-6 ${
                  plan.highlight
                    ? 'bg-brand-600 text-white hover:bg-brand-500'
                    : 'bg-surface-700 text-surface-100 hover:bg-surface-600'
                }`}
              >
                {plan.cta} <ArrowRight className="w-4 h-4" />
              </Link>

              <ul className="space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-surface-200">{feature}</span>
                  </li>
                ))}
                {plan.limits.map((limit) => (
                  <li key={limit} className="flex items-center gap-2.5 text-sm">
                    <span className="w-4 h-4 text-surface-600 flex-shrink-0 text-center">×</span>
                    <span className="text-surface-500">{limit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-24 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">FAQ</h2>
          <div className="space-y-4">
            {[
              { q: 'Can I cancel anytime?', a: 'Yes — cancel any time from your billing dashboard. You keep access until the period ends.' },
              { q: 'What happens when I reach my webhook limit?', a: 'New webhooks are queued and a warning is shown. Upgrade to lift limits.' },
              { q: 'Is there a free trial?', a: 'The Free plan is free forever. Pro and Team have a 14-day trial — no card required.' },
              { q: 'Do you offer annual billing?', a: 'Yes — pay annually and save 20% (contact us to set up).' },
            ].map((item) => (
              <div key={item.q} className="glass p-5">
                <h4 className="text-sm font-semibold text-white mb-2">{item.q}</h4>
                <p className="text-sm text-surface-400 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
