import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { casesApi, agentApi } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import {
  ArrowLeft, Loader2, Bot, Play, CheckCircle2, XCircle, AlertTriangle,
  User, CreditCard, Shield, Wrench, Eye, Clock, RefreshCw,
  Cpu, Settings, Scale, Zap, CheckSquare, Brain
} from 'lucide-react';
import clsx from 'clsx';

const STEP_ICONS = {
  THINKING: Cpu,
  TOOL_CALL: Settings,
  POLICY_CHECK: Scale,
  EXECUTING: Zap,
  VERIFYING: CheckSquare,
  COMPLETED: CheckCircle2,
  FAILED: XCircle,
  HUMAN_REVIEW: User,
};

const STEP_CLASSES = {
  THINKING: 'step-thinking',
  TOOL_CALL: 'step-tool',
  POLICY_CHECK: 'step-policy',
  EXECUTING: 'step-executing',
  VERIFYING: 'step-verifying',
  COMPLETED: 'step-completed',
  FAILED: 'step-failed',
  HUMAN_REVIEW: 'step-review',
};

const POLICY_CLASSES = {
  ALLOW: 'bg-status-successBg border-status-success/30 text-status-success',
  DENY: 'bg-status-errorBg border-status-error/30 text-status-error',
  HUMAN_REVIEW: 'bg-status-warningBg border-status-warning/30 text-status-warning',
};

function statusClass(s) {
  const m = { OPEN: 'status-open', INVESTIGATING: 'status-investigating', RESOLVED: 'status-resolved', ESCALATED: 'status-escalated', FAILED: 'status-failed' };
  return m[s] || 'bg-surface-100 text-surface-600';
}

function AgentStep({ step, index, total }) {
  const isLast = index === total - 1;
  const Icon = STEP_ICONS[step.type] || Bot;
  
  // Safely parse JSON data if it is a string
  const data = typeof step.data === 'string' ? JSON.parse(step.data || '{}') : (step.data || {});

  return (
    <div className="relative flex gap-4 pb-5 timeline-item animate-step-appear">
      {/* Icon + connector */}
      <div className="flex flex-col items-center">
        <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-sm border flex-shrink-0 z-10', STEP_CLASSES[step.type] || 'bg-surface-100 border-surface-300')}>
          <Icon size={14} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-surface-200 mt-2" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1 pb-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', STEP_CLASSES[step.type] || '')}>{step.type}</span>
          <span className="text-[10px] font-medium text-surface-400">{new Date(step.createdAt || Date.now()).toLocaleTimeString()}</span>
        </div>
        <div className="text-sm font-medium text-surface-900 mb-1">{step.title}</div>
        <div className="text-sm text-surface-600 leading-relaxed mb-1.5">{step.description}</div>

        {/* Tool call data (dynamically displaying the JSON keys if it's a tool_call) */}
        {step.type === 'TOOL_CALL' && Object.keys(data).length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-surface-500 font-mono truncate">
              {Object.entries(data).map(([k, v]) => `${k}:${v}`).join(', ')}
            </span>
          </div>
        )}

        {/* Policy result */}
        {step.type === 'POLICY_CHECK' && data.decision && (
          <div className={clsx('mt-3 px-3 py-2 rounded border text-xs leading-relaxed', POLICY_CLASSES[data.decision] || '')}>
            <strong className="font-bold">{data.decision}</strong>: {data.reason}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const timelineRef = useRef(null);

  const [liveSteps, setLiveSteps] = useState([]);

  // Fetch initial case data
  const { data: caseData, isLoading, error } = useQuery({
    queryKey: ['case', id],
    queryFn: () => casesApi.get(id),
    refetchInterval: (data) => (data && ['OPEN', 'INVESTIGATING'].includes(data.status) ? 3000 : false)
  });

  // Start Agent Mutation
  const runAgentMutation = useMutation({
    mutationFn: () => agentApi.startDemo(id),
    onSuccess: () => queryClient.invalidateQueries(['case', id])
  });

  // Setup Socket.IO for real-time agent execution tracking
  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('join_case', id);

    socket.on('agent_started', () => {
      setLiveSteps([]);
      queryClient.invalidateQueries(['case', id]);
    });

    socket.on('agent_step', (step) => {
      setLiveSteps((prev) => [...prev, step]);
      // Scroll to bottom
      if (timelineRef.current) {
        setTimeout(() => {
          timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
        }, 50);
      }
    });

    socket.on('case_updated', () => {
      queryClient.invalidateQueries(['case', id]);
    });

    return () => {
      socket.emit('leave_case', id);
      socket.off('agent_started');
      socket.off('agent_step');
      socket.off('case_updated');
    };
  }, [socket, id, queryClient]);

  // Sync historical steps if not running live
  useEffect(() => {
    if (caseData?.agentExecutions?.[0]?.steps && !runAgentMutation.isPending) {
      setLiveSteps(caseData.agentExecutions[0].steps);
    }
  }, [caseData, runAgentMutation.isPending]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-accent-600" /></div>;
  if (error) return <div className="text-status-error bg-status-errorBg p-4 rounded border border-status-error/20">{error.message}</div>;
  if (!caseData) return null;

  const steps = liveSteps;
  const policyDecision = caseData.policyDecision;
  const running = runAgentMutation.isPending || caseData.status === 'INVESTIGATING';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <button onClick={() => navigate('/cases')} className="p-2 rounded-md text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors bg-white border border-surface-200">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-medium text-surface-900 tracking-tight">{id}</h1>
            <span className={`badge ${statusClass(caseData.status)}`}>{caseData.status}</span>
            <span className={`badge priority-${caseData.priority?.toLowerCase()}`}>{caseData.priority} PRIORITY</span>
          </div>
          <p className="text-sm text-surface-600 mt-1 font-medium">{caseData.title}</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={() => queryClient.invalidateQueries(['case', id])} className="btn-secondary text-sm bg-white flex-1 sm:flex-none">
            <RefreshCw size={14} /> Refresh
          </button>
          {['OPEN', 'INVESTIGATING'].includes(caseData.status) && (
            <button onClick={() => runAgentMutation.mutate()} disabled={running} className="btn-primary text-sm flex-1 sm:flex-none shadow-sm">
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {running ? 'Agent Running...' : 'Run AI Agent'}
            </button>
          )}
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* LEFT: Customer + Transaction info */}
        <div className="space-y-6">
          {/* Customer card */}
          <div className="card p-5 border-surface-200 shadow-sm bg-white">
            <div className="flex items-center gap-2 mb-4 border-b border-surface-200 pb-3">
              <User size={18} className="text-accent-600" />
              <span className="text-base font-medium text-surface-900">Customer Details</span>
            </div>
            <div className="space-y-3">
              {[
                ['Name', caseData.customer?.name],
                ['Email', caseData.customer?.email],
                ['Phone', caseData.customer?.phone],
                ['KYC', caseData.customer?.kycStatus],
                ['Account', caseData.customer?.accountStatus],
                ['Risk Score', caseData.customer?.riskScore || 0],
                ['Wallet', caseData.customer?.walletBalance ? `₹${Number(caseData.customer.walletBalance).toLocaleString('en-IN')}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-sm text-surface-500">{k}</span>
                  <span className={clsx('text-sm font-medium',
                    v === 'FROZEN' ? 'text-status-error' :
                    v === 'VERIFIED' ? 'text-status-success' :
                    v === 'ACTIVE' ? 'text-status-success' :
                    'text-surface-900'
                  )}>{v || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction card */}
          {caseData.transaction && (
            <div className="card p-5 border-surface-200 shadow-sm bg-white">
              <div className="flex items-center gap-2 mb-4 border-b border-surface-200 pb-3">
                <CreditCard size={18} className="text-purple-600" />
                <span className="text-base font-medium text-surface-900">Transaction</span>
              </div>
              <div className="space-y-3">
                {[
                  ['ID', <span key="txid" className="font-mono text-xs bg-surface-100 px-1.5 py-0.5 rounded border border-surface-200 text-surface-700">{caseData.transactionId}</span>],
                  ['Amount', <span key="amt" className="font-medium text-surface-900">₹{Number(caseData.transaction.amount || 0).toLocaleString('en-IN')}</span>],
                  ['Status', <span key="stat" className={clsx('badge text-[10px]', caseData.transaction.status === 'FAILED' ? 'bg-status-errorBg text-status-error border border-status-error/20' : 'bg-status-successBg text-status-success border border-status-success/20')}>{caseData.transaction.status}</span>],
                  ['Debit Status', <span key="deb" className={clsx('badge text-[10px]', caseData.transaction.debitStatus === 'DEBITED' ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-surface-100 text-surface-600 border border-surface-200')}>{caseData.transaction.debitStatus}</span>],
                  ['Refund', <span key="ref" className={clsx('badge text-[10px]', caseData.transaction.refundStatus === 'COMPLETED' ? 'bg-status-successBg text-status-success border border-status-success/20' : 'bg-surface-100 text-surface-600 border border-surface-200')}>{caseData.transaction.refundStatus}</span>],
                  ['Method', caseData.transaction.paymentMethod],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-surface-500 flex-shrink-0">{k}</span>
                    <span className="text-sm text-surface-900 text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complaint */}
          <div className="card p-5 border-surface-200 bg-surface-50 shadow-sm">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Customer Complaint</div>
            <p className="text-sm text-surface-800 leading-relaxed font-medium">"{caseData.description}"</p>
          </div>
        </div>

        {/* CENTER: Agent execution timeline */}
        <div className="lg:col-span-1 card p-6 shadow-sm border-surface-200 bg-white">
          <div className="flex items-center gap-2 mb-6 border-b border-surface-200 pb-3">
            <Bot size={20} className="text-accent-600" />
            <span className="text-base font-medium text-surface-900">Execution Timeline</span>
            <span className="ml-auto text-xs font-medium text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full">{steps.length} steps</span>
          </div>

          {running && (
            <div className="flex items-center gap-3 px-4 py-3 rounded border border-accent-200 bg-accent-50 mb-6 animate-pulse">
              <Loader2 size={16} className="animate-spin text-accent-600" />
              <span className="text-sm font-medium text-accent-700">Agent is running...</span>
            </div>
          )}

          {steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-surface-200 rounded-lg bg-surface-50">
              <Bot size={32} className="text-surface-400 mb-3" />
              <div className="text-sm font-medium text-surface-700 mb-1">Agent not yet executed</div>
              <div className="text-xs text-surface-500">Click "Run AI Agent" to start autonomous resolution</div>
            </div>
          ) : (
            <div ref={timelineRef} className="overflow-y-auto max-h-[600px] scrollbar-hide pr-2">
              {steps.map((step, i) => (
                <AgentStep key={step.id || i} step={step} index={i} total={steps.length} />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: AI decisions + explanation */}
        <div className="space-y-6">
          {/* AI Decision Summary */}
          {policyDecision && (
            <div className={clsx('card p-6 shadow-sm border bg-white', 
              policyDecision === 'ALLOW' ? 'border-status-success/40' : 
              policyDecision === 'DENY' ? 'border-status-error/40' : 'border-status-warning/40'
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Shield size={18} className="text-surface-600" />
                <span className="text-base font-medium text-surface-900">Policy Decision</span>
              </div>
              <div className={clsx('text-3xl font-medium tracking-tight mb-3', {
                'text-status-success': policyDecision === 'ALLOW',
                'text-status-error': policyDecision === 'DENY',
                'text-status-warning': policyDecision === 'HUMAN_REVIEW',
              })}>
                {policyDecision}
              </div>
              {caseData.resolution && (
                <p className="text-sm text-surface-600 leading-relaxed font-medium bg-surface-50 p-3 rounded border border-surface-200">{caseData.resolution}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
