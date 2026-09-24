import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesApi, healthApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Send, Bot, User, Loader2, ArrowRight, RotateCcw, Zap, Shield, Cpu, Settings, Scale, CheckSquare, CheckCircle2, XCircle } from 'lucide-react';
import clsx from 'clsx';

const QUICK_MESSAGES = [
  "My payment of ₹500 failed but the money was deducted from my account",
  "I was charged twice for the same Swiggy order",
  "My UPI payment failed, please check the status",
  "I don't recognize a ₹4,999 transaction on my account — it looks suspicious",
  "I paid ₹12,000 to a merchant but didn't receive the product",
  "My wallet balance seems incorrect",
];

const STEP_COLORS = {
  THINKING: 'border-surface-200 bg-surface-50 text-surface-600',
  TOOL_CALL: 'border-purple-200 bg-purple-50 text-purple-700',
  POLICY_CHECK: 'border-status-warning/30 bg-status-warningBg text-status-warning',
  EXECUTING: 'border-accent-200 bg-accent-50 text-accent-700',
  VERIFYING: 'border-teal-200 bg-teal-50 text-teal-700',
  COMPLETED: 'border-status-success/30 bg-status-successBg text-status-success',
  FAILED: 'border-status-error/30 bg-status-errorBg text-status-error',
  HUMAN_REVIEW: 'border-orange-200 bg-orange-50 text-orange-600',
};

const STEP_ICONS = { 
  THINKING: Cpu, 
  TOOL_CALL: Settings, 
  POLICY_CHECK: Scale, 
  EXECUTING: Zap, 
  VERIFYING: CheckSquare, 
  COMPLETED: CheckCircle2, 
  FAILED: XCircle, 
  HUMAN_REVIEW: User 
};

function ThinkingDots() {
  return (
    <div className="flex gap-1.5 items-center px-2 py-1">
      <span className="thinking-dot text-surface-400" />
      <span className="thinking-dot text-surface-400" />
      <span className="thinking-dot text-surface-400" />
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [agentSteps, setAgentSteps] = useState([]);
  const [showSteps, setShowSteps] = useState(false);
  const [lastCaseId, setLastCaseId] = useState(null);
  const [transactionId, setTransactionId] = useState('TXN20001');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Hi ${user?.name || 'there'}. I am the AxoraPay autonomous resolution agent.
I can assist with payment failures, duplicate charges, suspicious transactions, and merchant disputes.

Please describe the issue you are facing, and I will investigate and resolve it autonomously.`,
      timestamp: new Date().toISOString(),
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentSteps]);

  const sendMessage = async (text) => {
    const message = text || input.trim();
    if (!message || sending) return;

    setInput('');
    setSending(true);
    setAgentSteps([]);
    setShowSteps(true);

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Add thinking indicator
    const thinkingId = 'thinking_' + Date.now();
    setMessages(prev => [...prev, { id: thinkingId, role: 'assistant', thinking: true, timestamp: new Date().toISOString() }]);

    try {
      const result = await casesApi.create({
        customerMessage: message,
        transactionId: transactionId || undefined,
        priority: 'HIGH',
      });

      // Remove thinking indicator
      setMessages(prev => prev.filter(m => m.id !== thinkingId));

      setLastCaseId(result.caseId);
      if (result.steps) setAgentSteps(result.steps);

      // Add AI response
      const aiMsg = {
        id: 'ai_' + Date.now(),
        role: 'assistant',
        content: result.customerResponse || 'Your case has been processed.',
        caseId: result.caseId,
        status: result.status,
        policyDecision: result.policyResult?.decision,
        refund: result.refund,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== thinkingId));
      setMessages(prev => [...prev, {
        id: 'error_' + Date.now(),
        role: 'assistant',
        content: `Error encountered: ${e.message}. Please try again.`,
        isError: true,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const resetChat = async () => {
    setMessages([{
      id: 'welcome2',
      role: 'assistant',
      content: "Session reset. How can I help you today?",
      timestamp: new Date().toISOString(),
    }]);
    setAgentSteps([]);
    setLastCaseId(null);
    await healthApi.resetDemo().catch(() => {});
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col lg:flex-row gap-6">
      {/* Main chat */}
      <div className="flex flex-col flex-1 card border-surface-200 shadow-sm bg-white overflow-hidden">
        {/* Chat header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-6 py-4 border-b border-surface-200 bg-surface-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-accent-600 flex items-center justify-center shadow-sm border border-accent-700">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <div className="text-base font-semibold text-surface-900 tracking-tight">AxoraPay Agent</div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-surface-500 uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-status-success" />
                Online · Autonomous Mode
              </div>
            </div>
          </div>
          <div className="sm:ml-auto flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Transaction ID input */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-surface-600 uppercase tracking-wide">TXN ID:</label>
              <input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="TXN20001"
                className="input text-xs py-1.5 px-2.5 w-32 border-surface-300"
              />
            </div>
            <button onClick={resetChat} className="btn-secondary text-xs gap-1.5 bg-white">
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white">
          {messages.map((msg) => (
            <div key={msg.id} className={clsx('flex gap-4', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              {/* Avatar */}
              <div className={clsx('w-8 h-8 rounded flex items-center justify-center flex-shrink-0 mt-1',
                msg.role === 'user' ? 'bg-surface-200 border border-surface-300' : 'bg-accent-50 border border-accent-200'
              )}>
                {msg.role === 'user' ? <User size={16} className="text-surface-600" /> : <Bot size={16} className="text-accent-600" />}
              </div>

              {/* Bubble */}
              <div className={clsx('max-w-xl', msg.role === 'user' ? 'items-end' : 'items-start', 'flex flex-col gap-1.5')}>
                <div className="flex items-center gap-2">
                   <span className="text-xs font-semibold text-surface-600">
                     {msg.role === 'user' ? 'Customer' : 'AxoraPay Agent'}
                   </span>
                   <span className="text-[10px] text-surface-400 font-medium">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>

                {msg.thinking ? (
                  <div className="bg-surface-50 border border-surface-200 rounded-lg px-4 py-3">
                    <ThinkingDots />
                  </div>
                ) : (
                  <div className={clsx(
                    'rounded-lg px-5 py-3.5 text-sm leading-relaxed border',
                    msg.role === 'user'
                      ? 'bg-surface-50 border-surface-200 text-surface-900 rounded-tr-sm'
                      : msg.isError
                        ? 'bg-status-errorBg border-status-error/30 text-status-error rounded-tl-sm'
                        : 'bg-white border-surface-200 shadow-sm text-surface-800 rounded-tl-sm font-medium'
                  )}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                )}

                {/* Case + action metadata */}
                {msg.caseId && (
                  <div className="flex flex-wrap items-center gap-2 mt-2 bg-surface-50 p-2.5 rounded border border-surface-200 w-full">
                    <span className="font-mono text-[11px] font-semibold text-surface-600 bg-white px-1.5 py-0.5 rounded border border-surface-200">CASE: {msg.caseId}</span>
                    {msg.status && (
                      <span className={clsx('badge',
                        msg.status === 'RESOLVED' ? 'bg-status-successBg text-status-success border-status-success/30' :
                        msg.status === 'ESCALATED' ? 'bg-status-errorBg text-status-error border-status-error/30' :
                        'bg-surface-100 text-surface-700 border-surface-200'
                      )}>{msg.status}</span>
                    )}
                    {msg.policyDecision && (
                      <span className={clsx('badge',
                        msg.policyDecision === 'ALLOW' ? 'bg-status-successBg text-status-success border-status-success/30' :
                        msg.policyDecision === 'DENY' ? 'bg-status-errorBg text-status-error border-status-error/30' : 'bg-status-warningBg text-status-warning border-status-warning/30'
                      )}>{msg.policyDecision}</span>
                    )}
                    {msg.refund && (
                      <span className="badge bg-status-successBg text-status-success border-status-success/30">
                        ₹{Number(msg.refund.amount).toLocaleString('en-IN')} refunded
                      </span>
                    )}
                    <button
                      onClick={() => navigate(`/cases/${msg.caseId}`)}
                      className="text-[11px] font-semibold text-accent-600 hover:text-accent-700 flex items-center gap-1 ml-auto"
                    >
                      View Case <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick messages */}
        {messages.length <= 1 && (
          <div className="px-6 pb-4 bg-white border-t border-surface-100 pt-4">
            <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Quick Scenarios</div>
            <div className="flex flex-wrap gap-2">
              {QUICK_MESSAGES.map((msg, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(msg)}
                  className="text-xs px-3 py-2 rounded-md bg-surface-50 hover:bg-surface-100 border border-surface-200 text-surface-700 font-medium transition-colors text-left max-w-sm truncate"
                  title={msg}
                >
                  {msg.slice(0, 50)}...
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-6 bg-surface-50 border-t border-surface-200">
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Describe your payment issue..."
              className="input flex-1 py-3 bg-white"
              disabled={sending}
            />
            <button onClick={() => sendMessage()} disabled={sending || !input.trim()} className="btn-primary px-6 shadow-sm">
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Agent steps panel */}
      {showSteps && (
        <div className="lg:w-96 flex-shrink-0 card bg-white border-surface-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-surface-200 bg-surface-50">
            <Zap size={18} className="text-accent-600" />
            <span className="text-base font-semibold text-surface-900 tracking-tight">Agent Execution Log</span>
            {sending && (
              <div className="ml-auto flex items-center gap-1.5 bg-accent-50 px-2 py-1 rounded border border-accent-200">
                <Loader2 size={12} className="animate-spin text-accent-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-700">Running</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide p-5 space-y-3">
            {agentSteps.length === 0 && sending && (
              <div className="flex items-center gap-3 p-3 bg-surface-50 border border-surface-200 rounded">
                <ThinkingDots />
                <span className="text-xs font-medium text-surface-600">Initializing agent workflow...</span>
              </div>
            )}
            {agentSteps.map((step, i) => {
               const Icon = STEP_ICONS[step.type] || Bot;
               return (
                <div key={step.id || i} className={clsx('p-3 rounded border animate-step-appear', STEP_COLORS[step.type] || 'border-surface-200 bg-surface-50 text-surface-700')}>
                  <div className="flex items-center gap-2 mb-2 border-b border-inherit pb-2 border-opacity-30">
                    <Icon size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">{step.type}</span>
                    <span className="text-[10px] ml-auto font-medium opacity-70">{new Date(step.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm font-semibold mb-1 leading-snug">{step.title}</div>
                  <div className="text-xs opacity-90 leading-relaxed font-medium">{step.description}</div>
                </div>
              );
            })}
          </div>

          {lastCaseId && !sending && (
            <div className="p-5 border-t border-surface-200 bg-surface-50">
              <button
                onClick={() => navigate(`/cases/${lastCaseId}`)}
                className="w-full btn-secondary text-sm justify-center bg-white"
              >
                View Full Case Detail <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Policy note */}
          <div className="p-4 bg-surface-100 border-t border-surface-200 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-surface-600 uppercase tracking-wide">
              <Shield size={14} />
              Policy Engine guards all financial actions
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
