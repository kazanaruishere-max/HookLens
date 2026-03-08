'use client';

import { useState, useEffect } from 'react';
import {
  Users, Plus, Loader2, Copy, Trash2, Crown, Shield, Eye, UserPlus, Mail
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

interface Team {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface Member {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: string;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3.5 h-3.5 text-amber-400" />,
  admin: <Shield className="w-3.5 h-3.5 text-brand-400" />,
  member: <Users className="w-3.5 h-3.5 text-surface-400" />,
  viewer: <Eye className="w-3.5 h-3.5 text-surface-500" />,
};

export default function TeamsPage() {
  const { token, user } = useAuthStore();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadTeams = async () => {
    try {
      const res = await fetch(`${API_URL}/api/teams`, { headers });
      const data = await res.json();
      setTeams(data.teams || []);
      if (data.teams?.length > 0 && !selectedTeam) loadTeamDetail(data.teams[0]);
    } catch { toast.error('Failed to load teams'); }
    finally { setLoading(false); }
  };

  const loadTeamDetail = async (team: Team) => {
    setSelectedTeam(team);
    try {
      const res = await fetch(`${API_URL}/api/teams/${team.id}`, { headers });
      const data = await res.json();
      setMembers(data.members || []);
      setMyRole(data.myRole || 'member');
    } catch { toast.error('Failed to load team'); }
  };

  useEffect(() => { if (token) loadTeams(); }, [token]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch(`${API_URL}/api/teams/${selectedTeam?.id}/invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteLink(data.inviteUrl);
      navigator.clipboard.writeText(data.inviteUrl);
      toast.success('Invite link copied to clipboard!');
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return;
    try {
      await fetch(`${API_URL}/api/teams/${selectedTeam?.id}/members/${memberId}`, {
        method: 'DELETE', headers,
      });
      setMembers(members.filter(m => m.id !== memberId));
      toast.success('Member removed');
    } catch { toast.error('Failed to remove member'); }
  };

  return (
    <div className="min-h-screen bg-surface-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Team Management</h1>
          <p className="text-surface-400 text-sm mt-1">Collaborate on webhooks with your team</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-brand-500 animate-spin" /></div>
        ) : teams.length === 0 ? (
          <div className="glass text-center py-16 px-8">
            <Users className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Teams Yet</h3>
            <p className="text-surface-400 text-sm mb-4">
              Team features require the <strong className="text-brand-400">Team plan</strong>.
            </p>
            <a href="/billing" className="btn-primary text-sm inline-flex items-center gap-2">
              Upgrade to Team
            </a>
          </div>
        ) : (
          <div className="grid md:grid-cols-4 gap-6">
            {/* Team List Sidebar */}
            <div className="md:col-span-1 space-y-1">
              {teams.map(team => (
                <button
                  key={team.id}
                  onClick={() => loadTeamDetail(team)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    selectedTeam?.id === team.id
                      ? 'bg-brand-500/15 text-brand-300'
                      : 'text-surface-300 hover:bg-surface-800'
                  }`}
                >
                  {team.name}
                </button>
              ))}
            </div>

            {/* Team Detail */}
            <div className="md:col-span-3">
              {selectedTeam && (
                <div className="glass p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-white">{selectedTeam.name}</h2>
                      <p className="text-xs text-surface-500 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
                    </div>
                    {['owner', 'admin'].includes(myRole) && (
                      <button onClick={() => setShowInvite(!showInvite)} className="btn-primary text-sm flex items-center gap-2">
                        <UserPlus className="w-4 h-4" /> Invite
                      </button>
                    )}
                  </div>

                  {/* Invite Form */}
                  {showInvite && (
                    <form onSubmit={handleInvite} className="bg-surface-800/50 rounded-xl p-4 mb-4 space-y-3">
                      <div className="flex gap-3">
                        <input
                          type="email"
                          className="input flex-1 text-sm"
                          placeholder="colleague@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          required
                          autoFocus
                        />
                        <select
                          className="input text-sm w-32"
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button type="submit" className="btn-primary text-sm" disabled={inviting}>
                          {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        </button>
                      </div>
                      {inviteLink && (
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-brand-400 bg-surface-900 px-2 py-1 rounded flex-1 truncate">{inviteLink}</code>
                          <button type="button" onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Copied'); }} className="text-surface-500 hover:text-brand-400">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </form>
                  )}

                  {/* Members List */}
                  <div className="divide-y divide-surface-800/50">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 py-3">
                        <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {(m.name || m.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{m.name || m.email}</div>
                          <div className="text-xs text-surface-500">{m.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs flex items-center gap-1 ${m.status === 'pending' ? 'text-amber-400' : 'text-surface-400'}`}>
                            {ROLE_ICONS[m.role]} {m.role}
                            {m.status === 'pending' && ' (pending)'}
                          </span>
                          {myRole === 'owner' && m.role !== 'owner' && (
                            <button onClick={() => handleRemove(m.id)} className="text-surface-600 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
