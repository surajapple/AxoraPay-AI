import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { escalationsApi } from '../services/api';
import { AlertTriangle, CheckCircle, Loader2, ArrowRight, User } from 'lucide-react';
import clsx from 'clsx';

export default function EscalationsPage() {
  const navigate = useNavigate();
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(null);
  const [resolutionForm, setResolutionForm] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await escalationsApi.list();
      setEscalations(data.escalations);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function resolve(id, action) {
    try {
      await escalationsApi.update(id, {
        status: 'RESOLVED',
        resolution: resolutionForm[id] || `Resolved by human agent — ${action}`,
        actionTaken: action,
      });
      setResolving(null);
      load();
    } catch (e) { console.error(e); }
  }

  const priorityColor = (p) => ({ CRITICAL: 'text-status-error', HIGH: 'text-status-warning', MEDIUM: 'text-accent-700', LOW: 'text-surface-600' }[p] || 'text-surface-500');
  const statusBadge = (s) => s === 'PENDING' ? 'bg-status-warningBg text-status-warning border-status-warning/30' : s === 'RESOLVED' ? 'bg-status-successBg text-status-success border-status-success/30' : 'bg-surface-100 text-surface-700 border-surface-200';

  const pending = escalations.filter(e => e.status !== 'RESOLVED');
  const resolved = escalations.filter(e => e.status === 'RESOLVED');

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 size={24} className="animate-spin text-accent-600" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-surface-900 tracking-tight">Human Review Queue</h1>
        <p className="text-sm text-surface-500 mt-1">
          Cases requiring human judgment · {pending.length} pending
        </p>
      </div>

      {/* Pending escalations */}
      <div>
        <div className="text-sm font-semibold text-surface-800 mb-4 flex items-center gap-2 border-b border-surface-200 pb-2">
          <AlertTriangle size={16} className="text-status-warning" />
          Pending Review ({pending.length})
        </div>
        <div className="space-y-4">
          {pending.length === 0 ? (
            <div className="card p-8 bg-white border-surface-200 shadow-sm text-center text-surface-500 text-sm font-medium">No pending escalations</div>
          ) : pending.map((esc) => (
            <div key={esc.id} className="card p-6 bg-white border border-surface-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-status-warning"></div>
              <div className="flex items-start justify-between gap-6 pl-2">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-xs font-medium text-surface-500 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">{esc.id}</span>
                    <span className={`badge border ${statusBadge(esc.status)}`}>{esc.status}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${priorityColor(esc.priority)}`}>{esc.priority} PRIORITY</span>
                  </div>
                  <div className="text-base font-medium text-surface-900 mb-1">{esc.case_title}</div>
                  <div className="text-sm text-surface-500 mb-4 flex items-center gap-1.5">
                    <User size={14} className="text-surface-400" />
                    {esc.customer_name} · Issue: {esc.issue_type?.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm text-surface-700 leading-relaxed bg-surface-50 border border-surface-200 rounded-md p-4 mb-4">
                    <div className="text-xs font-semibold text-surface-900 uppercase tracking-wide mb-1">Escalation Reason</div>
                    {esc.reason}
                  </div>

                  {resolving === esc.id ? (
                    <div className="space-y-3 bg-surface-50 p-4 rounded-md border border-surface-200">
                      <textarea
                        value={resolutionForm[esc.id] || ''}
                        onChange={(e) => setResolutionForm(f => ({ ...f, [esc.id]: e.target.value }))}
                        placeholder="Add resolution notes..."
                        className="input resize-none h-24 text-sm"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => resolve(esc.id, 'APPROVED')} className="btn-primary text-sm bg-status-success hover:bg-[#0d5925] border-transparent shadow-sm">
                          <CheckCircle size={16} /> Approve & Resolve
                        </button>
                        <button onClick={() => resolve(esc.id, 'REJECTED')} className="btn-danger text-sm">
                          Reject
                        </button>
                        <button onClick={() => setResolving(null)} className="btn-secondary text-sm bg-white">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => setResolving(esc.id)} className="btn-primary text-sm px-5">
                        Review & Resolve
                      </button>
                      <button onClick={() => navigate(`/cases/${esc.case_id}`)} className="btn-secondary text-sm px-5 bg-white">
                        View Case <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 pt-1">
                  <div className="text-xs font-medium text-surface-500">{new Date(esc.created_at).toLocaleDateString('en-IN')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="opacity-70 transition-opacity hover:opacity-100">
          <div className="text-sm font-semibold text-surface-600 mb-4 flex items-center gap-2 border-b border-surface-200 pb-2">
            <CheckCircle size={16} className="text-status-success" />
            Resolved History ({resolved.length})
          </div>
          <div className="space-y-3">
            {resolved.map((esc) => (
              <div key={esc.id} className="card p-4 bg-surface-50 border-surface-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-medium text-surface-500 bg-white px-1.5 py-0.5 rounded border border-surface-200">{esc.id}</span>
                    <span className="text-sm font-medium text-surface-800">{esc.case_title}</span>
                  </div>
                  <span className={`badge border ${statusBadge(esc.status)}`}>{esc.status}</span>
                </div>
                {esc.resolution && <div className="text-xs text-surface-600 mt-2 pl-14">{esc.resolution}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
