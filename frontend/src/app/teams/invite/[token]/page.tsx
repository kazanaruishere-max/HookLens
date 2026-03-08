'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token: authToken } = useAuthStore();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [teamId, setTeamId] = useState('');

  useEffect(() => {
    const accept = async () => {
      try {
        const { token: inviteToken } = await params;
        if (!authToken) {
          // Store invite token and redirect to login
          localStorage.setItem('pending_invite', inviteToken);
          router.push(`/login?redirect=/teams/invite/${inviteToken}/accept`);
          return;
        }

        const res = await fetch(`${API_URL}/api/teams/invite/${inviteToken}/accept`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();

        if (res.ok) {
          setStatus('success');
          setTeamId(data.teamId);
          setTimeout(() => router.push('/dashboard/teams'), 2000);
        } else {
          throw new Error(data.error || 'Failed to accept invite');
        }
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message);
      }
    };
    accept();
  }, [authToken]);

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
      <div className="glass max-w-sm w-full p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-4">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Team Invitation</h1>

        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mt-4" />
            <p className="text-surface-400 text-sm mt-3">Accepting invitation...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mt-2" />
            <p className="text-emerald-300 font-medium mt-3">Invitation accepted!</p>
            <p className="text-surface-400 text-sm mt-1">Redirecting to your team...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-400 mx-auto mt-2" />
            <p className="text-red-300 font-medium mt-3">Failed to accept</p>
            <p className="text-surface-400 text-sm mt-1">{message}</p>
            <button onClick={() => router.push('/dashboard')} className="btn-secondary text-sm mt-4">
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
