import { useState, useEffect } from 'react';
import { auditApi } from '../services/api';
import { ScrollText, Loader2, Search, FileText, Settings, DollarSign, CheckCircle2, Lock, Scale, Users, Mail, CheckCircle, Bot, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const ACTION_COLORS = {
  CASE_CREATED: 'text-accent-600',
  TOOL_CALLED: 'text-purple-600',
  REFUND_CREATED: 'text-status-success',
  REFUND_VERIFIED: 'text-status-success',
  ACCOUNT_FROZEN: 'text-status-error',
  DISPUTE_CREATED: 'text-status-warning',
  ESCALATED: 'text-orange-500',
  NOTIFICATION_SENT: 'text-teal-600',
  POLICY_EVALUATED: 'text-status-warning',
  CASE_UPDATED: 'text-surface-600',
  CASE_RESOLVED: 'text-status-success',
  AGENT_COMPLETED: 'text-status-success',
  AGENT_ERROR: 'text-status-error',
};

const ACTION_ICONS = {
  CASE_CREATED: FileText,
  TOOL_CALLED: Settings,
  REFUND_CREATED: DollarSign,
  REFUND_VERIFIED: CheckCircle2,
  ACCOUNT_FROZEN: Lock,
  DISPUTE_CREATED: Scale,
  ESCALATED: Users,
  NOTIFICATION_SENT: Mail,
  POLICY_EVALUATED: Scale,
  CASE_UPDATED: FileText,
  CASE_RESOLVED: CheckCircle,
  AGENT_COMPLETED: Bot,
  AGENT_ERROR: AlertTriangle,
};

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await auditApi.list({ limit: 200 });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const filtered = logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.action?.toLowerCase().includes(s) ||
      l.case_id?.toLowerCase().includes(s) ||
      l.actor?.toLowerCase().includes(s) ||
      l.tool_name?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-surface-900 tracking-tight">Audit Log</h1>
          <p className="text-sm text-surface-500 mt-1">{total} events recorded · Complete agent action history</p>
        </div>
      </div>

      <div className="card p-5 bg-white border-surface-200 shadow-sm">
        <div className="relative max-w-2xl">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, case ID, tool..."
            className="input pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-accent-600" /></div>
      ) : (
        <div className="card overflow-hidden bg-white border-surface-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50">
                  {['Time', 'Action', 'Actor', 'Case ID', 'Tool', 'Status', 'Details'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-surface-600 px-5 py-3 whitespace-nowrap uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-surface-500 text-sm font-medium">No audit logs found</td></tr>
                ) : filtered.map((log) => {
                  const Icon = ACTION_ICONS[log.action] || ScrollText;
                  return (
                    <tr key={log.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className="text-xs text-surface-500 font-mono font-medium">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className={clsx(ACTION_COLORS[log.action] || 'text-surface-400')} />
                          <span className={clsx('text-xs font-semibold uppercase tracking-wide', ACTION_COLORS[log.action] || 'text-surface-500')}>
                            {log.action?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div>
                          <div className="text-xs font-medium text-surface-900">{log.actor}</div>
                          <div className="text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">{log.actor_type}</div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {log.case_id ? (
                          <span className="font-mono text-xs text-surface-600 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">{log.case_id}</span>
                        ) : <span className="text-surface-400 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {log.tool_name ? (
                          <span className="font-mono text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">{log.tool_name}()</span>
                        ) : <span className="text-surface-400 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={clsx('badge',
                          log.status === 'SUCCESS' ? 'bg-status-successBg text-status-success border border-status-success/30' :
                          'bg-status-errorBg text-status-error border border-status-error/30'
                        )}>{log.status}</span>
                      </td>
                      <td className="px-5 py-3 max-w-48">
                        {log.details && log.details !== '{}' ? (
                          <span className="text-xs text-surface-500 truncate block bg-surface-50 p-1.5 rounded border border-surface-200">
                            {JSON.stringify(JSON.parse(log.details)).slice(0, 80)}
                          </span>
                        ) : <span className="text-surface-400 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
