import { useNavigate } from 'react-router-dom';
import { 
  Bot, Zap, Shield, CheckCircle, ArrowRight, Play, BarChart3, 
  MessageSquare, Cpu, Lock, Search, ClipboardList, Scale, CheckSquare
} from 'lucide-react';

const PIPELINE_STEPS = [
  { icon: Bot, label: 'UNDERSTAND', desc: 'Classify intent & extract context' },
  { icon: Search, label: 'RETRIEVE', desc: 'Fetch transaction & customer data' },
  { icon: ClipboardList, label: 'PLAN', desc: 'Select tools & sequence actions' },
  { icon: Scale, label: 'POLICY CHECK', desc: 'Deterministic authorization gate' },
  { icon: Zap, label: 'ACT', desc: 'Execute tools with full validation' },
  { icon: CheckSquare, label: 'VERIFY', desc: 'Confirm outcomes from database' },
  { icon: MessageSquare, label: 'RESPOND', desc: 'Communicate resolution to customer' },
];

const FEATURES = [
  { icon: Cpu, title: 'Autonomous Execution', desc: 'AI understands, plans, acts, and verifies — without human intervention for eligible cases.' },
  { icon: Shield, title: 'Policy-Controlled', desc: 'Deterministic policy engine authorizes every financial action. LLM can propose, not authorize.' },
  { icon: Zap, title: 'Real Tool Calls', desc: '15+ backend tools including refund creation, account freeze, dispute filing, and escalation.' },
  { icon: CheckCircle, title: 'Verified Outcomes', desc: 'Every action is verified against the database before the customer is notified.' },
  { icon: MessageSquare, title: 'Human-in-the-Loop', desc: 'Smart escalation for high-value, suspicious, or complex cases requiring human judgment.' },
  { icon: BarChart3, title: 'Full Audit Trail', desc: 'Every decision, tool call, and policy evaluation is logged with complete transparency.' },
];

const SCENARIOS = [
  { label: 'Payment Failed + Debited', tag: 'AUTO REFUND', color: 'text-status-success', bg: 'bg-status-successBg border-status-success/30' },
  { label: 'Duplicate Payment', tag: 'AUTO REFUND', color: 'text-status-success', bg: 'bg-status-successBg border-status-success/30' },
  { label: 'Suspicious Transaction', tag: 'ESCALATED', color: 'text-status-error', bg: 'bg-status-errorBg border-status-error/30' },
  { label: 'High-Value Refund', tag: 'HUMAN REVIEW', color: 'text-status-warning', bg: 'bg-status-warningBg border-status-warning/30' },
  { label: 'Merchant Dispute', tag: 'ESCALATED', color: 'text-status-error', bg: 'bg-status-errorBg border-status-error/30' },
  { label: 'UPI Failed', tag: 'AUTO RESOLVED', color: 'text-accent-700', bg: 'bg-accent-50 border-accent-200' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900 overflow-x-hidden selection:bg-accent-100">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-surface-200 px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-accent-600 flex items-center justify-center shadow-sm">
            <Bot size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight">AxoraPay AI</span>
            <span className="text-[10px] text-surface-500 font-medium tracking-wide uppercase">Autonomous Teammate</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex demo-badge">
            DEMO ENVIRONMENT
          </div>
          <button onClick={() => navigate('/login')} className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors">
            Sign In
          </button>
          <button onClick={() => navigate('/login')} className="btn-primary">
            Launch Agent <ArrowRight size={16} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 relative bg-white">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-accent-50 border border-accent-200 text-accent-700 text-xs font-semibold uppercase tracking-wider mb-8">
            <Zap size={14} />
            Paytm AI Hackathon 2026
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-surface-900 leading-tight tracking-tight mb-6">
            Autonomous customer resolution for modern payments.
          </h1>

          <p className="text-lg text-surface-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            An AI teammate that understands customer issues, executes approved actions, verifies outcomes, and escalates when human judgment is required. Resolves tier-1 support tickets in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary px-8 py-3.5 text-sm w-full sm:w-auto"
            >
              <Bot size={18} />
              Launch Agent
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-secondary px-8 py-3.5 text-sm w-full sm:w-auto"
            >
              <Play size={18} />
              View Demo
            </button>
          </div>

          {/* Pipeline visualization */}
          <div className="flex flex-col md:flex-row flex-wrap items-center justify-center gap-4 mt-8">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="flex flex-col md:flex-row items-center gap-4">
                <div className="group card px-4 py-3 text-center transition-shadow hover:shadow-md cursor-default min-w-[120px] bg-white border-surface-200">
                  <div className="flex justify-center text-surface-500 mb-2 group-hover:text-accent-600 transition-colors">
                    <step.icon size={20} />
                  </div>
                  <div className="text-[11px] font-semibold tracking-wider text-surface-800">{step.label}</div>
                  <div className="text-[10px] text-surface-500 hidden group-hover:block mt-1">{step.desc}</div>
                </div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <ArrowRight size={16} className="text-surface-300 hidden md:block" />
                )}
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="h-4 w-px bg-surface-300 md:hidden" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key differentiator */}
      <section className="py-24 px-6 bg-surface-50 border-t border-surface-200">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs font-semibold text-accent-600 uppercase tracking-wide mb-3">The Core Principle</div>
              <h2 className="text-3xl font-medium text-surface-900 tracking-tight mb-4">
                Execution over conversation.
              </h2>
              <p className="text-surface-600 leading-relaxed mb-8">
                Traditional chatbots only answer questions and deflect tickets. AxoraPay is an autonomous operations system that takes responsibility for end-to-end resolution. It performs the actual backend work required to close a case.
              </p>
              <div className="space-y-4">
                {[
                  { icon: MessageSquare, title: 'Traditional Chatbots', desc: 'Responds to FAQs, escalates to humans, no actions taken.', type: 'bad' },
                  { icon: CheckSquare, title: 'AxoraPay Agent', desc: 'Understands intent, queries DB, applies policy, executes refunds.', type: 'good' },
                ].map((item) => (
                  <div key={item.title} className={`flex items-start gap-4 p-4 rounded-lg border ${item.type === 'good' ? 'bg-status-successBg border-status-success/30' : 'bg-surface-100 border-surface-300'}`}>
                    <item.icon size={20} className={item.type === 'good' ? 'text-status-success' : 'text-surface-500'} />
                    <div>
                      <div className={`text-sm font-semibold mb-1 ${item.type === 'good' ? 'text-status-success' : 'text-surface-800'}`}>{item.title}</div>
                      <div className={`text-sm ${item.type === 'good' ? 'text-status-success/80' : 'text-surface-600'}`}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6 bg-white shadow-sm border-surface-200 space-y-4">
              <div className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-4">Supported Operations</div>
              {SCENARIOS.map((s) => (
                <div key={s.label} className={`flex items-center justify-between p-3.5 rounded border ${s.bg}`}>
                  <span className="text-sm font-medium text-surface-800">{s.label}</span>
                  <span className={`text-[11px] font-bold tracking-wide ${s.color}`}>{s.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-white border-t border-surface-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-accent-600 uppercase tracking-wide mb-3">Enterprise Architecture</div>
            <h2 className="text-3xl font-medium text-surface-900 tracking-tight">Built for reliable operations</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6 bg-white hover:shadow-md transition-shadow border-surface-200">
                <div className="w-10 h-10 rounded bg-accent-50 flex items-center justify-center mb-5 border border-accent-100">
                  <Icon size={20} className="text-accent-600" />
                </div>
                <div className="text-base font-semibold text-surface-900 mb-2">{title}</div>
                <div className="text-sm text-surface-600 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Policy architecture callout */}
      <section className="py-24 px-6 bg-surface-50 border-t border-surface-200">
        <div className="max-w-4xl mx-auto text-center">
          <div className="card p-10 bg-white border-surface-200 shadow-sm">
            <div className="w-12 h-12 bg-surface-100 rounded flex items-center justify-center mx-auto mb-6">
              <Lock size={24} className="text-surface-700" />
            </div>
            <h3 className="text-2xl font-medium text-surface-900 mb-4 tracking-tight">Policy-Governed Execution</h3>
            <p className="text-surface-600 text-base leading-relaxed max-w-2xl mx-auto mb-10">
              The LLM proposes actions, but a deterministic Policy Engine makes the final decision.
              <strong> Financial actions require explicit policy authorization</strong>. The LLM cannot bypass this security gate.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-4">
              <div className="flex-1 max-w-[200px] w-full border border-status-success/30 bg-status-successBg rounded-lg p-4">
                <div className="text-status-success font-semibold mb-1">ALLOW</div>
                <div className="text-status-success/80 text-xs">Execute autonomously</div>
              </div>
              <ArrowRight size={20} className="text-surface-400 rotate-90 sm:rotate-0" />
              <div className="flex-1 max-w-[200px] w-full border border-status-error/30 bg-status-errorBg rounded-lg p-4">
                <div className="text-status-error font-semibold mb-1">DENY</div>
                <div className="text-status-error/80 text-xs">Reject and explain</div>
              </div>
              <ArrowRight size={20} className="text-surface-400 rotate-90 sm:rotate-0" />
              <div className="flex-1 max-w-[200px] w-full border border-status-warning/30 bg-status-warningBg rounded-lg p-4">
                <div className="text-status-warning font-semibold mb-1">REVIEW</div>
                <div className="text-status-warning/80 text-xs">Escalate to human</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-white border-t border-surface-200">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-medium text-surface-900 tracking-tight mb-4">Start resolving autonomously</h2>
          <p className="text-surface-600 mb-8 text-lg">Experience the full platform demo in your browser.</p>
          <div className="flex items-center justify-center gap-4">
            <button onClick={() => navigate('/login')} className="btn-primary px-8 py-3 text-base">
              Enter Platform
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 px-6 py-8 text-center bg-surface-50">
        <div className="text-sm text-surface-500 font-medium">
          AxoraPay · Paytm AI Hackathon 2026 · Track 3<br/>
          <span className="text-surface-400 font-normal mt-1 block">All financial APIs are simulated for demonstration purposes.</span>
        </div>
      </footer>
    </div>
  );
}
