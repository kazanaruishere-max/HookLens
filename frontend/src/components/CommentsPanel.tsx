'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, AtSign } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  mentions: string[];
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  replies?: Comment[];
}

export function CommentsPanel({ webhookId }: { webhookId: string }) {
  const { token, user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadComments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/webhooks/${webhookId}/comments`, { headers });
      const data = await res.json();
      setComments(data.comments || []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { if (token && webhookId) loadComments(); }, [token, webhookId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/webhooks/${webhookId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: content.trim(),
          parentId: replyTo?.id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Optimistic update
      if (replyTo) {
        setComments(prev => prev.map(c =>
          c.id === replyTo.id
            ? { ...c, replies: [...(c.replies || []), data.comment] }
            : c
        ));
      } else {
        setComments(prev => [...prev, { ...data.comment, replies: [] }]);
      }

      setContent('');
      setReplyTo(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (comment: Comment) => {
    try {
      await fetch(`${API_URL}/api/webhooks/${webhookId}/comments/${comment.id}`, {
        method: 'DELETE',
        headers,
      });
      setComments(prev => prev.map(c =>
        c.id === comment.id
          ? { ...c, deleted: true, content: '[deleted]' }
          : c
      ));
    } catch { toast.error('Failed to delete'); }
  };

  const fmtTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`${isReply ? 'ml-8 mt-2' : 'border-b border-surface-800/30 last:border-0'}`}>
      <div className="flex gap-3 py-3">
        <div className={`w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${isReply ? 'w-6 h-6' : ''}`}>
          {(comment.userName || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-semibold text-white">{comment.userName || 'User'}</span>
            <span className="text-xs text-surface-600">{fmtTime(comment.createdAt)}</span>
            {comment.edited && <span className="text-xs text-surface-600">(edited)</span>}
          </div>
          <p className={`text-sm leading-relaxed ${comment.deleted ? 'text-surface-600 italic' : 'text-surface-300'}`}>
            {comment.deleted ? '[deleted]' : comment.content}
          </p>
          {!comment.deleted && (
            <div className="flex items-center gap-3 mt-1.5">
              {!isReply && (
                <button
                  onClick={() => { setReplyTo(comment); textareaRef.current?.focus(); }}
                  className="text-xs text-surface-500 hover:text-brand-400 transition-colors flex items-center gap-1"
                >
                  <AtSign className="w-3 h-3" /> Reply
                </button>
              )}
              {comment.userId === user?.id && (
                <button onClick={() => handleDelete(comment)} className="text-xs text-surface-600 hover:text-red-400 transition-colors">
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {comment.replies?.map(reply => <CommentItem key={reply.id} comment={reply} isReply />)}
    </div>
  );

  return (
    <div className="glass overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-700/50 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-surface-400" />
        <span className="text-sm font-medium text-white">Comments</span>
        <span className="text-xs text-surface-500">({comments.length})</span>
      </div>

      {/* Comments list */}
      <div className="max-h-80 overflow-y-auto divide-y divide-surface-800/30 px-4">
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 text-brand-500 animate-spin" /></div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center text-surface-500 text-sm">
            No comments yet. Start a discussion.
          </div>
        ) : (
          comments.map(c => <CommentItem key={c.id} comment={c} />)
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-surface-700/50 p-4">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-surface-400 mb-2 bg-surface-800/50 px-3 py-1.5 rounded">
            <AtSign className="w-3 h-3 text-brand-400" />
            Replying to <strong className="text-white">{replyTo.userName}</strong>
            <button onClick={() => setReplyTo(null)} className="ml-auto text-surface-600 hover:text-surface-300">✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            ref={textareaRef}
            className="input flex-1 text-sm resize-none"
            placeholder="Write a comment..."
            rows={2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as any); }}
          />
          <button type="submit" className="btn-primary px-3 self-end" disabled={sending || !content.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <p className="text-xs text-surface-600 mt-1">Ctrl+Enter to submit</p>
      </div>
    </div>
  );
}
