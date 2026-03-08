import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'HookLens — Visual Webhook Debugger',
  description: 'AI-powered webhook debugging platform. Test, debug, and monitor webhooks 10x faster with real-time inspection, signature validation, and AI analysis.',
  keywords: ['webhook', 'debugger', 'API', 'testing', 'Stripe', 'GitHub', 'developer tools'],
  openGraph: {
    title: 'HookLens — Visual Webhook Debugger',
    description: 'Debug webhooks 10x faster with AI-powered analysis',
    type: 'website',
    url: 'https://hooklens.dev',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-950 text-surface-100 antialiased">
        {children}
        <Toaster
          richColors
          position="bottom-right"
          theme="dark"
          toastOptions={{
            className: 'glass border-surface-700',
          }}
        />
      </body>
    </html>
  );
}
