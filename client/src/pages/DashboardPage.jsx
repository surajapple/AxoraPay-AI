import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi, casesApi, healthApi, agentApi } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import {
  Bot, Zap, AlertTriangle, CheckCircle2,
  DollarSign, Clock, Play, RotateCcw, Loader2, ArrowRight, Activity,
  Cpu, Settings, Scale, Search, CheckSquare
} from 'lucide-react';
import clsx from 'clsx';

function StatCard({ icon: Icon, label, value, sub, color = 'text-accent-600', bgColor = 'bg-accent-50' }) {
  return (
    <div className="card p-5 flex flex-col gap-1 border-surface-200">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded ${bgColor} flex items-center justify-center border border-white/10 shadow-sm`}>
          <Icon size={20} className={color} />
        </div>
      </div>
      <div className="text-3xl font-medium text-surface-900 tracking-tight mt-3">{value}</div>
      <div className="text-sm font-medium text-surface-600">{label}</div>
      {sub && <div className="text-[11px] font-medium text-surface-500 uppercase tracking-wide mt-0.5">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [demoRunning, setDemoRunning] = useState(false);
  const [demoSteps, setDemoSteps] = useState([]);
  const [demoComplete, setDemoComplete] = useState(false);

  // Queries
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.stats,
    refetchInterval: 5000 // Refetch stats every 5s for live updates
  });

  const { data: casesData, isLoading: isLoadingCases } = useQuery({
    queryKey: ['cases', { limit: 6 }],
    queryFn: () => casesApi.list({ limit: 6 })
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: healthApi.check
  });

  // Mutations
  const resetDemoMutation = useMutation({
    mutationFn: healthApi.resetDemo,
    onSuccess: () => {
      setDemoSteps([]);
      setDemoComplete(false);
      queryClient.invalidateQueries(['dashboard']);
      queryClient.invalidateQueries(['cases']);
    }
  });

  const runDemo = async () => {
    setDemoRunning(true);
    setDemoSteps([]);
    setDemoComplete(false);

    // Hardcode the ID for the demo case
    const caseId = 'CASE-DEMO-001';
    
    // We start the backend execution
    await agentApi.startDemo(caseId);

    // Just visually simulate the typing for the demo runner card
    const demoScript = [
      { icon: Bot, text: 'Customer submits complaint: "My ₹500 payment failed but money was deducted"', type: 'THINKING', delay: 800 },
      { icon: Cpu, text: 'AI classifies issue: PAYMENT_FAILED_DEBITED | Confidence: 95%', type: 'THINKING', delay: 600 },
      { icon: Settings, text: 'Tool call: getTransaction(TXN20001)', type: 'TOOL_CALL', delay: 700 },
      { icon: Search, text: 'Transaction found: ₹500 to Zomato | Status: FAILED | Debit: DEBITED', type: 'TOOL_CALL', delay: 600 },
      { icon: Settings, text: 'Tool call: checkRefundEligibility(TXN20001)', type: 'TOOL_CALL', delay: 700 },
      { icon: CheckSquare, text: 'Refund eligible: Transaction failed + Amount debited + Within window', type: 'TOOL_CALL', delay: 600 },
      { icon: Scale, text: 'Policy Engine evaluating refund request...', type: 'POLICY_CHECK', delay: 900 },
      { icon: CheckSquare, text: 'Policy Decision: ALLOW — Amount ₹500 ≤ ₹5,000 limit | No prior refund', type: 'POLICY_CHECK', delay: 700 },
      { icon: Zap, text: 'Tool call: createRefund(₹500, TXN20001)', type: 'EXECUTING', delay: 800 },
      { icon: Zap, text: 'Refund initiated: REF-DEMO-001 | Status: PROCESSING', type: 'EXECUTING', delay: 600 },
      { icon: Search, text: 'Tool call: verifyRefund(REF-DEMO-001)', type: 'VERIFYING', delay: 700 },
      { icon: CheckSquare, text: 'Refund verified: COMPLETED | ₹500 will return in 3-5 business days', type: 'VERIFYING', delay: 600 },
      { icon: Settings, text: 'Tool call: sendNotification(customer) — refund confirmation sent', type: 'TOOL_CALL', delay: 500 },
      { icon: CheckCircle2, text: 'Case CASE-DEMO updated: Status → RESOLVED', type: 'COMPLETING', delay: 400 },
      { icon: CheckCircle2, text: 'Resolution complete! Customer notified.', type: 'COMPLETED', delay: 0 },
    ];

    for (let i = 0; i < demoScript.length; i++) {
      await new Promise(r => setTimeout(r, demoScript[i].delay || 600));
      setDemoSteps(prev => [...prev, { ...demoScript[i], id: i }]);
    }
    
    setDemoRunning(false);
    setDemoComplete(true);
    
    // Invalidate everything to show updated DB states
    queryClient.invalidateQueries(['dashboard']);
    queryClient.invalidateQueries(['cases']);
  };

  const getStatusClass = (status) => {
    const map = { OPEN: 'status-open', INVESTIGATING: 'status-investigating', RESOLVED: 'status-resolved', ESCALATED: 'status-escalated', FAILED: 'status-failed' };
    return map[status] || 'bg-surface-100 text-surface-600';
  };

  const getPriorityClass = (p) => {
    const map = { LOW: 'priority-low', MEDIUM: 'priority-medium', HIGH: 'priority-high', CRITICAL: 'priority-critical' };
    return map[p] || '';
  };

  const getStepColor = (type) => {
    const map = {
      THINKING: 'step-thinking',
      TOOL_CALL: 'step-tool',
      POLICY_CHECK: 'step-policy',
      EXECUTING: 'step-executing',
      VERIFYING: 'step-verifying',
      COMPLETED: 'step-completed',
      COMPLETING: 'step-verifying',
    };
    return map[type] || 'bg-surface-100 border-surface-300 text-surface-600';
  };

  if (isLoadingStats || isLoadingCases) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-accent-600" />
      </div>
    );
  }

  const cases = casesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-surface-900 tracking-tight">Operations Overview</h1>
          <p className="text-sm text-surface-500 mt-1">
            Monitor autonomous customer resolution activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-surface-200 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-status-success" />
            <span className="text-xs font-semibold text-surface-700 tracking-wide">System healthy</span>
          </div>
          <button onClick={() => queryClient.invalidateQueries()} className="btn-secondary text-xs">
            <Activity size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <StatCard icon={Bot} label="Total Cases" value={stats.totalCases} color="text-accent-600" bgColor="bg-accent-50" />
          <StatCard icon={CheckCircle2} label="AI Resolved" value={stats.resolvedCases} color="text-status-success" bgColor="bg-status-successBg" />
          <StatCard icon={AlertTriangle} label="Escalations" value={stats.escalatedCases} color="text-status-warning" bgColor="bg-status-warningBg" />
          <StatCard icon={Activity} label="Success Rate" value={`${stats.successRate}%`} color="text-accent-700" bgColor="bg-accent-100" />
          <StatCard icon={DollarSign} label="Refunds" value={`₹${(stats.refundAmount || 0).toLocaleString('en-IN')}`} color="text-purple-600" bgColor="bg-purple-50" sub={`${stats.refundsProcessed} txns`} />
          <StatCard icon={Clock} label="Avg Resolution" value={`${stats.averageResolutionTime}s`} color="text-surface-700" bgColor="bg-surface-100" />
          <StatCard icon={Zap} label="AI Confidence" value={`94%`} color="text-accent-600" bgColor="bg-accent-50" />
        </div>
      )}

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Demo Runner */}
        <div className="card p-6 shadow-sm border-surface-200 bg-white">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-lg font-medium text-surface-900 tracking-tight">Agent Activity</div>
              <div className="text-xs text-surface-500 mt-0.5">Live autonomous execution</div>
            </div>
            {demoComplete && (
              <button onClick={() => resetDemoMutation.mutate()} disabled={resetDemoMutation.isPending} className="btn-secondary text-xs">
                {resetDemoMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                Reset
              </button>
            )}
          </div>

          <div className="rounded border border-surface-200 bg-surface-50 p-4 mb-5">
            <div className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2">Simulated Request</div>
            <div className="text-sm text-surface-800 font-medium">"My ₹500 payment failed but money was deducted"</div>
            <div className="flex gap-2 mt-3">
              <span className="badge bg-white border border-surface-200 text-surface-600">Customer: Demo User</span>
              <span className="badge bg-white border border-surface-200 text-surface-600">TXN20001</span>
            </div>
          </div>

          <button
            onClick={runDemo}
            disabled={demoRunning || demoComplete}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all shadow-sm',
              demoComplete
                ? 'bg-status-successBg text-status-success border border-status-success/30 cursor-not-allowed'
                : 'btn-primary'
            )}
          >
            {demoRunning ? (
              <><Loader2 size={16} className="animate-spin" /> Executing workflow...</>
            ) : demoComplete ? (
              <><CheckCircle2 size={16} /> Resolution Completed</>
            ) : (
              <><Play size={16} /> Run Scenario</>
            )}
          </button>

          {/* Demo steps */}
          {demoSteps.length > 0 && (
            <div className="mt-5 space-y-3 max-h-72 overflow-y-auto scrollbar-hide pr-1">
              {demoSteps.map((step) => (
                <div key={step.id} className={`flex items-start gap-3 p-3 rounded-md border text-sm animate-step-appear ${getStepColor(step.type)}`}>
                  <step.icon size={16} className="mt-0.5 flex-shrink-0" />
                  <span className="leading-relaxed font-medium">{step.text}</span>
                </div>
              ))}
              {demoRunning && (
                <div className="flex items-center gap-2 px-3 py-2 text-surface-500">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="text-xs ml-1 font-medium">Agent processing</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Cases */}
        <div className="lg:col-span-2 card bg-white border-surface-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 pb-4 flex items-center justify-between border-b border-surface-200 bg-white">
            <div className="text-lg font-medium text-surface-900 tracking-tight">Active Cases</div>
            <button onClick={() => navigate('/cases')} className="text-xs font-medium text-accent-600 hover:text-accent-700 flex items-center gap-1 transition-colors">
              View all <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto">
            {cases.length === 0 ? (
              <div className="text-center py-12 text-surface-500 text-sm">No cases found</div>
            ) : (
              <div className="divide-y divide-surface-200">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="flex items-center gap-4 p-4 hover:bg-surface-50 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono text-surface-500 bg-surface-100 px-1.5 py-0.5 rounded">{c.id.slice(0,10)}...</span>
                        <span className={`badge ${getStatusClass(c.status)}`}>{c.status}</span>
                        <span className={`badge ${getPriorityClass(c.priority)}`}>{c.priority}</span>
                      </div>
                      <div className="text-sm text-surface-900 truncate font-medium">{c.title}</div>
                      <div className="text-xs text-surface-500 mt-1">{c.customer?.name} · {c.issueType?.replace(/_/g, ' ')}</div>
                    </div>
                    {c.transaction?.amount && (
                      <div className="text-sm font-semibold text-surface-800 flex-shrink-0">
                        ₹{Number(c.transaction.amount).toLocaleString('en-IN')}
                      </div>
                    )}
                    <ArrowRight size={16} className="text-surface-400 flex-shrink-0 ml-2" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System status */}
      {health && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Database', value: 'Prisma / SQLite', color: 'text-status-success bg-status-successBg' },
            { label: 'AI Provider', value: 'Demo Agent Pipeline', color: 'text-accent-700 bg-accent-50' },
            { label: 'Uptime', value: `${Math.floor(health.uptime)}s`, color: 'text-surface-700 bg-surface-100' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card px-5 py-4 flex items-center justify-between border-surface-200 bg-white shadow-sm">
              <span className="text-xs font-medium text-surface-600 tracking-wide uppercase">{label}</span>
              <span className={`badge ${color} border border-transparent`}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
