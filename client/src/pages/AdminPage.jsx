import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/api';
import { Settings, Shield, Wrench, BarChart3, Users, Loader2, Check, AlertTriangle, FileText, Activity } from 'lucide-react';
import clsx from 'clsx';

function Tab({ label, active, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={clsx('px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2', 
        active ? 'bg-white text-surface-900 border border-surface-200 shadow-sm' : 'text-surface-500 hover:text-surface-800 hover:bg-surface-100 bg-transparent border border-transparent')}
    >
      <Icon size={16} className={clsx(active ? "text-accent-600" : "text-surface-400")} />
      {label}
    </button>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState('policies');
  const [configForm, setConfigForm] = useState({});
  const queryClient = useQueryClient();

  const { data: policiesData, isLoading: pLoading } = useQuery({ queryKey: ['admin', 'policies'], queryFn: adminApi.policies });
  const { data: toolsData, isLoading: tLoading } = useQuery({ queryKey: ['admin', 'tools'], queryFn: adminApi.tools });
  const { data: metrics, isLoading: mLoading } = useQuery({ queryKey: ['admin', 'metrics'], queryFn: adminApi.metrics });
  const { data: custData, isLoading: cLoading } = useQuery({ queryKey: ['admin', 'customers'], queryFn: adminApi.customers });

  // Sync config form state when loaded
  useEffect(() => {
    if (policiesData?.config) setConfigForm(policiesData.config);
  }, [policiesData]);

  const updateConfigMutation = useMutation({
    mutationFn: adminApi.updatePolicies,
    onSuccess: () => queryClient.invalidateQueries(['admin', 'policies'])
  });

  const loading = pLoading || tLoading || mLoading || cLoading;
  
  if (loading) return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-accent-600" /></div>;

  const policies = policiesData?.policies || [];
  const tools = toolsData?.tools || [];
  const customers = custData?.customers || [];
  const saved = updateConfigMutation.isSuccess;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium text-surface-900 tracking-tight">Admin Panel</h1>
        <p className="text-sm text-surface-500 mt-1">System configuration, policies, and operational monitoring.</p>
      </div>

      <div className="flex gap-2 flex-wrap bg-surface-50 p-1 rounded-lg border border-surface-200 inline-flex">
        {[
          { id: 'policies', label: 'Policies', icon: Shield },
          { id: 'tools', label: 'Tools', icon: Wrench },
          { id: 'metrics', label: 'Metrics', icon: BarChart3 },
          { id: 'customers', label: 'Customers', icon: Users },
        ].map(({ id, label, icon }) => (
          <Tab key={id} label={label} active={tab === id} onClick={() => setTab(id)} icon={icon} />
        ))}
      </div>

      {/* Policies Tab */}
      {tab === 'policies' && (
        <div className="space-y-6">
          <div className="card p-6 bg-white border-surface-200 shadow-sm">
            <div className="flex items-center justify-between mb-5 border-b border-surface-200 pb-3">
              <div className="text-base font-semibold text-surface-900 tracking-tight flex items-center gap-2">
                <Settings size={18} className="text-surface-500" />
                Global Configuration
              </div>
              <button 
                onClick={() => updateConfigMutation.mutate(configForm)} 
                disabled={updateConfigMutation.isPending}
                className={clsx('btn-primary text-sm shadow-sm transition-all', saved && 'bg-status-success hover:bg-[#0d5925] border-transparent')}
              >
                {updateConfigMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : saved ? <><Check size={16} /> Saved</> : 'Save Changes'}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { key: 'AUTO_REFUND_LIMIT', label: 'Auto Refund Limit (₹)', type: 'number' },
                { key: 'REFUND_WINDOW_DAYS', label: 'Refund Window (Days)', type: 'number' },
                { key: 'MAX_REFUNDS_PER_CUSTOMER', label: 'Max Monthly Refunds', type: 'number' },
                { key: 'SUSPICIOUS_RISK_THRESHOLD', label: 'Risk Threshold (0-100)', type: 'number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-surface-600 uppercase tracking-wide block mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={configForm[key] || ''}
                    onChange={(e) => setConfigForm(c => ({ ...c, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                    className="input text-sm font-medium bg-surface-50"
                  />
                </div>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-surface-100">
              {[
                { key: 'FREEZE_ON_SUSPICIOUS', label: 'Auto-Freeze Suspicious Accounts', desc: 'Immediately lock accounts exceeding risk threshold' },
                { key: 'REQUIRE_KYC_FOR_REFUND', label: 'Require KYC for Refund', desc: 'Deny autonomous refunds if KYC is missing' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 p-4 bg-surface-50 rounded-lg border border-surface-200 cursor-pointer hover:bg-surface-100 transition-colors">
                  <input
                    type="checkbox"
                    id={key}
                    checked={configForm[key] === 'true' || configForm[key] === true}
                    onChange={(e) => setConfigForm(c => ({ ...c, [key]: String(e.target.checked) }))}
                    className="w-4 h-4 mt-0.5 rounded border-surface-300 text-accent-600 focus:ring-accent-500"
                  />
                  <div>
                    <div className="text-sm font-semibold text-surface-900">{label}</div>
                    <div className="text-xs text-surface-500 mt-0.5">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden bg-white border-surface-200 shadow-sm">
            <div className="px-6 py-4 border-b border-surface-200 bg-surface-50 flex items-center gap-2">
              <Shield size={18} className="text-surface-500" />
              <div className="text-base font-semibold text-surface-900 tracking-tight">Active Engine Policies</div>
            </div>
            <div className="divide-y divide-surface-200">
              {policies.map((pol) => (
                <div key={pol.id} className="p-6 hover:bg-surface-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-base font-semibold text-surface-900 tracking-tight">{pol.name}</span>
                        <span className={`badge text-[10px] ${pol.enabled ? 'bg-status-successBg text-status-success border border-status-success/30' : 'bg-surface-100 text-surface-500 border border-surface-200'}`}>
                          {pol.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                        <span className="font-mono text-[11px] text-surface-500 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">{pol.id}</span>
                      </div>
                      <p className="text-sm text-surface-600 mb-4 max-w-3xl leading-relaxed">{pol.description}</p>
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Evaluation Criteria</div>
                        <div className="flex flex-wrap gap-2">
                          {pol.conditions.map((c, i) => (
                            <span key={i} className="text-[11px] font-medium px-2 py-1 rounded-md bg-surface-50 border border-surface-200 text-surface-700 flex items-center gap-1.5">
                              <Check size={10} className="text-surface-400" /> {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-2 sm:ml-4 flex-shrink-0">
                      <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Resulting Action</div>
                      <span className={`badge border ${pol.action.includes('HUMAN') ? 'bg-status-warningBg text-status-warning border-status-warning/30' : pol.action.includes('DENY') ? 'bg-status-errorBg text-status-error border-status-error/30' : 'bg-status-successBg text-status-success border-status-success/30'}`}>
                        {pol.action}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tools Tab */}
      {tab === 'tools' && (
        <div className="card overflow-hidden bg-white border-surface-200 shadow-sm">
          <div className="px-6 py-4 border-b border-surface-200 bg-surface-50 flex items-center gap-2">
            <Wrench size={18} className="text-surface-500" />
            <div className="text-base font-semibold text-surface-900 tracking-tight">Agent Tool Registry <span className="text-sm font-medium text-surface-500 ml-1">({tools.length} available)</span></div>
          </div>
          <div className="divide-y divide-surface-200">
            {tools.map((tool) => (
              <div key={tool.name} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-surface-50 transition-colors">
                <span className="font-mono text-sm font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-100 flex-shrink-0 sm:w-56">{tool.name}()</span>
                <span className="text-sm font-medium text-surface-600 flex-1">{tool.description}</span>
                <div className="flex gap-2 flex-shrink-0">
                  {tool.requiresAuth && <span className="badge bg-blue-50 text-blue-700 border border-blue-200 text-[10px]">AUTH REQUIRED</span>}
                  {tool.requiresPolicy && <span className="badge bg-status-warningBg text-status-warning border border-status-warning/30 text-[10px]">POLICY GUARDED</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Tab */}
      {tab === 'metrics' && metrics && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Cases', value: metrics.totalCases, color: 'text-accent-600' },
              { label: 'Resolved (Auto)', value: metrics.resolvedCases, color: 'text-status-success' },
              { label: 'Human Escalated', value: metrics.escalatedCases, color: 'text-status-error' },
              { label: 'Total Refund Value', value: `₹${Number(metrics.totalRefunds || 0).toLocaleString('en-IN')}`, color: 'text-purple-600' },
              { label: 'Refund Count', value: metrics.refundCount, color: 'text-teal-600' },
              { label: 'Audit Log Events', value: metrics.totalAuditLogs, color: 'text-surface-700' },
              { label: 'AI LLM Provider', value: metrics.aiProvider, color: 'text-accent-700' },
              { label: 'System Uptime', value: `${Math.floor(metrics.uptime)}s`, color: 'text-surface-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-5 bg-white border-surface-200 shadow-sm flex flex-col justify-between">
                <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">{label}</div>
                <div className={`text-2xl font-semibold tracking-tight ${color}`}>{value}</div>
              </div>
            ))}
          </div>
          <div className="card p-6 bg-white border-surface-200 shadow-sm">
            <div className="flex items-center gap-2 mb-6 border-b border-surface-200 pb-3">
              <Activity size={18} className="text-surface-500" />
              <div className="text-base font-semibold text-surface-900 tracking-tight">Support Issue Distribution</div>
            </div>
            <div className="space-y-4 max-w-3xl">
              {metrics.issueBreakdown?.map((item) => (
                <div key={item.issue_type} className="flex items-center gap-4">
                  <div className="text-sm font-medium text-surface-700 w-48 flex-shrink-0">{item.issue_type?.replace(/_/g, ' ')}</div>
                  <div className="flex-1 h-2.5 rounded-full bg-surface-100 overflow-hidden border border-surface-200">
                    <div className="h-full rounded-full bg-accent-500" style={{ width: `${(item.count / metrics.totalCases) * 100}%` }} />
                  </div>
                  <div className="text-sm font-semibold text-surface-900 w-12 text-right">{item.count}</div>
                  <div className="text-xs text-surface-500 w-12 text-right">{Math.round((item.count / metrics.totalCases) * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {tab === 'customers' && (
        <div className="card overflow-hidden bg-white border-surface-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50">
                  {['ID', 'Name', 'Email', 'KYC', 'Account', 'Risk', 'Balance', 'Cases', 'Refunds'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-surface-600 px-5 py-3 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-50 transition-colors">
                    <td className="px-5 py-4"><span className="font-mono text-[11px] text-surface-500 bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200">{c.id}</span></td>
                    <td className="px-5 py-4 text-sm font-medium text-surface-900">{c.name}</td>
                    <td className="px-5 py-4 text-sm text-surface-500">{c.email}</td>
                    <td className="px-5 py-4"><span className={`badge border ${c.kyc_status === 'VERIFIED' ? 'bg-status-successBg text-status-success border-status-success/30' : 'bg-status-warningBg text-status-warning border-status-warning/30'}`}>{c.kyc_status}</span></td>
                    <td className="px-5 py-4"><span className={`badge border ${c.account_status === 'ACTIVE' ? 'bg-status-successBg text-status-success border-status-success/30' : 'bg-status-errorBg text-status-error border-status-error/30'}`}>{c.account_status}</span></td>
                    <td className="px-5 py-4"><span className={`text-sm font-bold ${c.risk_score > 20 ? 'text-status-error' : c.risk_score > 0 ? 'text-status-warning' : 'text-status-success'}`}>{c.risk_score}</span></td>
                    <td className="px-5 py-4 text-sm font-semibold text-surface-800">₹{Number(c.wallet_balance || 0).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-4 text-sm font-medium text-surface-600">{c.case_count}</td>
                    <td className="px-5 py-4 text-sm font-medium text-surface-600">{c.refund_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
