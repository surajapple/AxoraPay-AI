import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { casesApi } from '../services/api';
import { Search, Filter, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const STATUS_OPTIONS = ['', 'OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED', 'FAILED'];
const PRIORITY_OPTIONS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function statusClass(s) {
  const m = { 
    OPEN: 'status-open', 
    INVESTIGATING: 'status-investigating', 
    RESOLVED: 'status-resolved', 
    ESCALATED: 'status-escalated', 
    FAILED: 'status-failed', 
    ACTION_REQUIRED: 'status-investigating' 
  };
  return m[s] || 'bg-surface-100 text-surface-600';
}

function priorityClass(p) {
  const m = { LOW: 'priority-low', MEDIUM: 'priority-medium', HIGH: 'priority-high', CRITICAL: 'priority-critical' };
  return m[p] || '';
}

const ISSUE_TYPE_LABELS = {
  PAYMENT_FAILED_DEBITED: 'Payment Failed + Debited',
  DUPLICATE_PAYMENT: 'Duplicate Payment',
  UPI_FAILED: 'UPI Failed',
  WALLET_BALANCE_ISSUE: 'Wallet Issue',
  SUSPICIOUS_TRANSACTION: 'Suspicious',
  MERCHANT_DISPUTE: 'Merchant Dispute',
  GENERAL_INQUIRY: 'General',
};

export default function CasesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [showFilters, setShowFilters] = useState(false);

  const { data: casesData, isLoading } = useQuery({
    queryKey: ['cases', filters.status, filters.priority],
    queryFn: () => casesApi.list({ status: filters.status, priority: filters.priority, limit: 50 }),
    refetchInterval: 5000
  });

  const cases = casesData?.data || [];
  const total = casesData?.pagination?.total || 0;

  const filteredCases = cases.filter(c => {
    if (!filters.search) return true;
    const s = filters.search.toLowerCase();
    return c.id?.toLowerCase().includes(s) ||
      c.title?.toLowerCase().includes(s) ||
      c.customer?.name?.toLowerCase().includes(s) ||
      c.issueType?.toLowerCase().includes(s);
  });

  const formatDate = (d) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-surface-900 tracking-tight">Case Management</h1>
          <p className="text-sm text-surface-500 mt-1">{total} total cases in queue</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => queryClient.invalidateQueries(['cases'])} className="btn-secondary text-xs bg-white">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowFilters(!showFilters)} className={clsx("btn-secondary text-xs bg-white", showFilters && "bg-surface-100")}>
            <Filter size={14} /> Filters
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card p-5 space-y-4 shadow-sm border-surface-200 bg-white">
        <div className="relative max-w-2xl">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Search by case ID, title, customer..."
            className="input pl-10"
          />
        </div>
        {showFilters && (
          <div className="flex gap-4 flex-wrap animate-fade-in pt-2 border-t border-surface-100">
            <div className="flex flex-col gap-1.5">
              <label className="label">Status</label>
              <select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))} className="input py-2 text-sm w-48 bg-white cursor-pointer">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label">Priority</label>
              <select value={filters.priority} onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))} className="input py-2 text-sm w-48 bg-white cursor-pointer">
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p || 'All Priorities'}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => setFilters({ status: '', priority: '', search: '' })} className="btn-secondary text-sm py-2 bg-white">Clear filters</button>
            </div>
          </div>
        )}
      </div>

      {/* Cases table */}
      <div className="card overflow-hidden shadow-sm border-surface-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50">
                {['Case ID', 'Customer', 'Issue', 'Amount', 'Priority', 'Status', 'AI Confidence', 'Created', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-surface-600 px-5 py-3 whitespace-nowrap uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-16"><Loader2 size={24} className="animate-spin text-accent-600 mx-auto" /></td></tr>
              ) : filteredCases.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-surface-500 text-sm font-medium">No cases found matching criteria</td></tr>
              ) : filteredCases.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="hover:bg-surface-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4">
                    <span className="font-mono text-xs text-surface-600 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">{c.id.slice(0, 10)}...</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-medium text-surface-900">{c.customer?.name}</div>
                    <div className="text-xs text-surface-500">{c.customer?.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-medium text-surface-900 max-w-48 truncate">{c.title}</div>
                    <div className="text-xs text-surface-500">{ISSUE_TYPE_LABELS[c.issueType] || c.issueType}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm font-semibold text-surface-700">
                      {c.transaction?.amount ? `₹${Number(c.transaction.amount).toLocaleString('en-IN')}` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`badge ${priorityClass(c.priority)}`}>{c.priority}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`badge ${statusClass(c.status)}`}>{c.status}</span>
                  </td>
                  <td className="px-5 py-4">
                    {c.aiConfidence > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent-500"
                            style={{ width: `${c.aiConfidence * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-surface-600">{Math.round(c.aiConfidence * 100)}%</span>
                      </div>
                    ) : <span className="text-surface-400 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium text-surface-500 whitespace-nowrap">{formatDate(c.createdAt)}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <ArrowRight size={16} className="text-surface-400 inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
