/**
 * AxoraPay — Midnight Fintech Technical Architecture & Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- 1. SINGLE PAGE SCROLLSPY NAVIGATION ---
  const navTabs = document.querySelectorAll('.nav-tab');
  const sectionBlocks = document.querySelectorAll('.section-block');

  window.addEventListener('scroll', () => {
    let currentId = '';
    sectionBlocks.forEach(section => {
      const sectionTop = section.offsetTop - 160;
      if (window.scrollY >= sectionTop) {
        currentId = section.getAttribute('id');
      }
    });

    if (currentId) {
      navTabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('href') === `#${currentId}`) {
          tab.classList.add('active');
        }
      });
    }
  });

  // --- 2. ARCHITECTURE NODE INSPECTOR DRAWER ---
  const inspectorDrawer = document.getElementById('inspector-drawer');
  const drawerBody = document.getElementById('drawer-body');
  const closeDrawerBtn = document.getElementById('close-drawer');

  const technicalNodeSpecs = {
    customer: {
      title: 'Customer / Chat UI Layer',
      badge: 'React / Next.js',
      specs: [
        { key: 'Session Context', val: 'CUST123 (Authenticated App Session)' },
        { key: 'Ingress Channel', val: 'Web / Mobile In-App Chat' },
        { key: 'State Isolation', val: 'LLM does NOT determine identity' },
        { key: 'Security', val: 'HTTPS / WSS Transport Security' }
      ],
      desc: 'The frontend collects customer messages and forwards them with a verified application session token. Identity claims originate strictly from trusted app auth.'
    },
    api_gateway: {
      title: 'API + Identity Layer',
      badge: 'Python + FastAPI • OAuth 2.0 / JWT',
      specs: [
        { key: 'Auth Protocol', val: 'OAuth 2.0 / JWT Bearer Tokens' },
        { key: 'Responsibilities', val: 'Validation, Session, Rate Limiting, Case Creation' },
        { key: 'Security Rule', val: 'Session-derived user_id passed upstream' },
        { key: 'Throughput SLA', val: '10,000 req/sec' }
      ],
      desc: 'Serves as the primary security gateway. Handles authentication context, creates structured case records, and enforces rate limits before invoking orchestrator engines.'
    },
    case_manager: {
      title: 'Case & Context State Manager',
      badge: 'PostgreSQL + Redis',
      specs: [
        { key: 'Primary State DB', val: 'PostgreSQL (ACID Compliant)' },
        { key: 'Caching / Idempotency', val: 'Redis Key-Value Cache' },
        { key: 'State Model', val: 'Case ID, Cust ID, Txn ID, Evidence, Audit' },
        { key: 'Design Principle', val: 'Structured State (Not Chat History) as Truth' }
      ],
      desc: 'Stores the authoritative structured state of every resolution lifecycle. The AI agent operates on structured state objects rather than unstructured transcript context.'
    },
    ai_brain: {
      title: 'AxoraPay Agent Orchestrator',
      badge: 'Python + LLM API + LangGraph',
      specs: [
        { key: 'Orchestration Engine', val: 'LangGraph State Machine' },
        { key: 'Agent Loop', val: 'Observe → Reason → Select Tool → Receive Result → Reason' },
        { key: 'Core Motto', val: 'LLM = REASONING, NOT AUTHORIZATION' },
        { key: 'Direct DB Access', val: 'STRICTLY PROHIBITED (Tool Access Only)' }
      ],
      desc: 'The central reasoning engine. Parses intent, extracts entities, plans investigation steps, invokes controlled tool schemas, and formats responses.'
    },
    action_tools: {
      title: 'Tool / Function Calling Layer',
      badge: 'FastAPI Tool Service',
      specs: [
        { key: 'Registered Tools', val: '8 Strictly Typed Tool Schemas' },
        { key: 'Sample Function', val: 'initiate_refund(txn_id, reason)' },
        { key: 'Validation', val: 'Pydantic Schema Enforcement' },
        { key: 'Guarantees', val: 'Permission Checks, Timeouts, Audit Logging' }
      ],
      desc: 'Contains strongly-typed, schema-validated wrappers for enterprise integrations. Ensures parameters match expected signatures before backend dispatch.'
    },
    trusted_systems: {
      title: 'Trusted Enterprise Systems',
      badge: 'PostgreSQL Microservices (SYSTEMS = TRUTH)',
      specs: [
        { key: 'Transaction Service', val: 'Txn ID, Amount, Debit/Payment status' },
        { key: 'Payment Service', val: 'Switch states & attempt failure logs' },
        { key: 'Refund Service', val: 'Refund eligibility & execution' },
        { key: 'Customer & Merchant', val: 'Account profile & ledger balance' }
      ],
      desc: 'The authoritative source of ground truth. System databases re-verify real account credits and bank debits.'
    },
    policy_gate: {
      title: 'Policy & Risk Engine',
      badge: 'Deterministic Python Rules (POLICY = AUTHORITY)',
      specs: [
        { key: 'Rule Type', val: 'Hardcoded Deterministic Business Logic' },
        { key: 'Checks', val: 'Ownership, Refund Eligibility, Idempotency, Limits' },
        { key: 'Decision Outputs', val: 'ALLOW | DENY | ESCALATE' },
        { key: 'Role', val: 'LLM recommends, Policy Engine AUTHORIZES' }
      ],
      desc: 'Deterministic security firewall. Evaluates whether proposed agent actions satisfy risk rules, idempotency tokens, and financial caps.'
    },
    action_gateway: {
      title: 'Action Gateway',
      badge: 'FastAPI + PostgreSQL + Redis (TOOLS = ACTION)',
      specs: [
        { key: 'Security Boundary', val: 'S2S Auth & Parameter Validation' },
        { key: 'Idempotency Key', val: 'SHA-256 Deduplication' },
        { key: 'Execution Pipeline', val: 'VALIDATE → AUTHORIZE → EXECUTE' },
        { key: 'Audit Log', val: 'Immutable Append-Only Security Log' }
      ],
      desc: 'Sits immediately before state-changing write operations. Guarantees that only policy-approved actions reach core refund services.'
    },
    verification_layer: {
      title: 'Verification Layer',
      badge: 'FastAPI + Event Polling (VERIFICATION = SAFETY)',
      specs: [
        { key: 'Verification Flow', val: 'Action Executed → Re-read System State' },
        { key: 'Safety Motto', val: 'Never trust tool call return; re-verify state first' },
        { key: 'Retry Strategy', val: 'Exponential Backoff / Polling' },
        { key: 'Outcome', val: 'Confirmed Verified State → Resolve' }
      ],
      desc: 'Re-reads backend systems after execution to verify that the refund or state update actually succeeded in the core database.'
    },
    human_escalation: {
      title: 'Human Escalation Path',
      badge: 'Structured Case Packet Hand-Off',
      specs: [
        { key: 'Trigger Conditions', val: 'High Risk, Policy DENY, Verification Failure' },
        { key: 'Handoff Packet', val: 'Structured Case, Evidence, Policy Output, Logs' },
        { key: 'Agent Experience', val: 'Zero re-investigation required' },
        { key: 'Resolution Mode', val: 'Assisted Human Resolution' }
      ],
      desc: 'Passes complete structured investigation context to human support personnel whenever an issue falls outside policy parameters.'
    }
  };

  document.querySelectorAll('.node-interactive').forEach(node => {
    node.addEventListener('click', () => {
      const key = node.getAttribute('data-node');
      const data = technicalNodeSpecs[key];
      if (!data) return;

      drawerBody.innerHTML = `
        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${data.title}</h3>
        <span class="badge badge-status" style="margin-bottom: 14px; display: inline-block;">${data.badge}</span>
        
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 18px;">${data.desc}</p>
        
        <h4 style="font-size: 12px; font-weight: 700; margin-bottom: 8px; color: var(--ai-blue-text); text-transform: uppercase;">Technical Specifications</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${data.specs.map(s => `
            <div style="background: var(--bg-dark); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color);">
              <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; display: block;">${s.key}</span>
              <span style="font-size: 12px; font-weight: 600; font-family: var(--font-mono); color: var(--text-main);">${s.val}</span>
            </div>
          `).join('')}
        </div>
      `;

      inspectorDrawer.classList.remove('hidden');
    });
  });

  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', () => {
      inspectorDrawer.classList.add('hidden');
    });
  }

  // --- 3. HERO JOURNEY SIMULATOR STATE MACHINE ---
  const simSteps = [
    {
      step: 1,
      badge: 'Step 1 / 6: UNDERSTAND',
      chat: {
        sender: 'AxoraPay Orchestrator',
        text: 'Hello! I noticed you are referencing transaction TXN456. Let me investigate your ₹12,000 debit right away.',
        time: '14:48:12'
      },
      facts: {
        txn: 'TXN456',
        debit: 'SUCCESS (₹12,000)',
        payment: 'FETCHING...',
        merchant: 'PENDING',
        auth: 'VERIFYING SESSION...',
        policy: 'STANDBY',
        action: '// Initializing investigation agent...'
      },
      statusText: 'Extracted intent & parsed TXN456 entity from authenticated session.',
      highlightFact: 'fact-txn'
    },
    {
      step: 2,
      badge: 'Step 2 / 6: INVESTIGATE',
      chat: {
        sender: 'AxoraPay Orchestrator',
        text: 'Checking payment switch & merchant ledger for TXN456...',
        time: '14:48:14'
      },
      facts: {
        txn: 'TXN456',
        debit: 'SUCCESS (₹12,000)',
        payment: 'FAILED',
        merchant: 'NOT RECEIVED',
        auth: 'VERIFIED: TXN456 belongs to CUST123',
        policy: 'READY FOR EVALUATION',
        action: 'read_txn(TXN456) -> Verified Debit Success / Payment Failed'
      },
      statusText: 'Gathered facts: Account debited, but merchant switch returned FAILED.',
      highlightFact: 'fact-payment'
    },
    {
      step: 3,
      badge: 'Step 3 / 6: DECIDE',
      chat: {
        sender: 'AxoraPay Orchestrator',
        text: 'Evaluating eligibility against Paytm Autonomous Refund Policy #402...',
        time: '14:48:16'
      },
      facts: {
        txn: 'TXN456',
        debit: 'SUCCESS (₹12,000)',
        payment: 'FAILED',
        merchant: 'NOT RECEIVED',
        auth: 'VERIFIED: TXN456 belongs to CUST123',
        policy: 'ALLOWED (Policy #402 - Auto Refund Eligible)',
        action: 'check_policy(CUST123, TXN456, 12000) -> Approved'
      },
      statusText: 'Policy Gate Passed: Auth verified, idempotency token clear, amount < ₹25,000 limit.',
      highlightFact: 'fact-policy'
    },
    {
      step: 4,
      badge: 'Step 4 / 6: ACT',
      chat: {
        sender: 'AxoraPay Orchestrator',
        text: 'Initiating immediate wallet refund of ₹12,000 under Idempotency Token #REF-8890...',
        time: '14:48:19'
      },
      facts: {
        txn: 'TXN456',
        debit: 'SUCCESS (₹12,000)',
        payment: 'FAILED',
        merchant: 'NOT RECEIVED',
        auth: 'VERIFIED: TXN456 belongs to CUST123',
        policy: 'ALLOWED',
        action: 'initiate_refund(txn_id="TXN456", amount=12000, idempotency_key="REF-8890")'
      },
      statusText: 'Executing policy-governed tool initiate_refund(). Action gateway invoked.',
      highlightFact: 'fact-action'
    },
    {
      step: 5,
      badge: 'Step 5 / 6: VERIFY',
      chat: {
        sender: 'AxoraPay Orchestrator',
        text: 'Re-reading ledger state to confirm wallet credit delivery...',
        time: '14:48:22'
      },
      facts: {
        txn: 'TXN456',
        debit: 'SUCCESS (₹12,000)',
        payment: 'REFUNDED',
        merchant: 'NOT RECEIVED',
        auth: 'VERIFIED: TXN456 belongs to CUST123',
        policy: 'COMPLETED & LOGGED',
        action: 'verify_outcome(REF-8890) -> State: COMPLETED (Txn ID: REF-8890)'
      },
      statusText: 'Verified outcome: System confirmed ₹12,000 credit posted to CUST123 wallet.',
      highlightFact: 'fact-auth'
    },
    {
      step: 6,
      badge: 'Step 6 / 6: RESOLVE',
      chat: {
        sender: 'AxoraPay Orchestrator',
        text: 'Your ₹12,000 refund has been completed and credited back to your account. Reference ID: REF-8890.',
        time: '14:48:25'
      },
      facts: {
        txn: 'TXN456',
        debit: 'REFUND COMPLETED',
        payment: 'CLOSED',
        merchant: 'NOT RECEIVED',
        auth: 'VERIFIED: CUST123',
        policy: 'SUCCESSFUL RESOLUTION',
        action: 'case_status = RESOLVED_AUTONOMOUSLY'
      },
      statusText: 'Closed-loop resolution achieved! Case resolved in 13 seconds with zero human intervention.',
      highlightFact: 'fact-debit'
    }
  ];

  let currentSimIndex = 0;
  let simTimer = null;
  let isSimPlaying = false;
  let simSpeed = 1;

  const btnPlay = document.getElementById('sim-btn-play');
  const btnPrev = document.getElementById('sim-btn-prev');
  const btnNext = document.getElementById('sim-btn-next');
  const btnReset = document.getElementById('sim-btn-reset');
  const currentStepBadge = document.getElementById('current-step-badge');
  const outcomeStatusText = document.getElementById('outcome-status-text');
  const chatMessages = document.getElementById('chat-messages');

  function renderSimStep(index) {
    const data = simSteps[index];
    if (!data) return;

    currentSimIndex = index;
    if (currentStepBadge) currentStepBadge.innerText = data.badge;
    if (outcomeStatusText) outcomeStatusText.innerText = data.statusText;

    // Update timeline stages
    document.querySelectorAll('.stage-step').forEach((el, idx) => {
      el.classList.remove('active', 'done');
      if (idx === index) {
        el.classList.add('active');
      } else if (idx < index) {
        el.classList.add('done');
      }
    });

    // Update facts
    document.getElementById('fact-txn').querySelector('.fact-val').innerText = data.facts.txn;
    document.getElementById('fact-debit').querySelector('.fact-val').innerText = data.facts.debit;
    document.getElementById('fact-payment').querySelector('.fact-val').innerText = data.facts.payment;
    document.getElementById('fact-merchant').querySelector('.fact-val').innerText = data.facts.merchant;
    document.getElementById('fact-auth').querySelector('.fact-val').innerText = data.facts.auth;
    
    const policyVal = document.getElementById('policy-gate-val');
    if (policyVal) policyVal.innerText = data.facts.policy;

    const actionBox = document.getElementById('action-code-box');
    if (actionBox) actionBox.innerText = data.facts.action;

    // Highlight active fact card
    document.querySelectorAll('.fact-card').forEach(c => c.classList.remove('active-highlight'));
    if (data.highlightFact) {
      const hCard = document.getElementById(data.highlightFact);
      if (hCard) hCard.classList.add('active-highlight');
    }

    // Append bot chat message if not already added for this step
    const existingMsg = document.getElementById(`bot-step-msg-${data.step}`);
    if (!existingMsg && chatMessages) {
      const msgDiv = document.createElement('div');
      msgDiv.id = `bot-step-msg-${data.step}`;
      msgDiv.className = 'chat-message bot-msg';
      msgDiv.innerHTML = `
        <div class="sender">${data.chat.sender}</div>
        <div class="bubble">${data.chat.text}</div>
        <div class="timestamp">${data.chat.time} • Autonomous Execution</div>
      `;
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  function playSimulation() {
    if (isSimPlaying) return;
    isSimPlaying = true;
    if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';

    simTimer = setInterval(() => {
      if (currentSimIndex < simSteps.length - 1) {
        renderSimStep(currentSimIndex + 1);
      } else {
        pauseSimulation();
      }
    }, 2400 / simSpeed);
  }

  function pauseSimulation() {
    isSimPlaying = false;
    if (simTimer) clearInterval(simTimer);
    if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-play"></i> Play Case';
  }

  function resetSimulation() {
    pauseSimulation();
    currentSimIndex = 0;
    if (chatMessages) {
      const botMsgs = chatMessages.querySelectorAll('.bot-msg');
      botMsgs.forEach(m => m.remove());
    }
    renderSimStep(0);
  }

  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      if (isSimPlaying) pauseSimulation();
      else playSimulation();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      pauseSimulation();
      if (currentSimIndex < simSteps.length - 1) {
        renderSimStep(currentSimIndex + 1);
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      pauseSimulation();
      if (currentSimIndex > 0) {
        renderSimStep(currentSimIndex - 1);
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', resetSimulation);
  }

  document.querySelectorAll('.btn-speed').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      simSpeed = parseFloat(btn.getAttribute('data-speed')) || 1;
      if (isSimPlaying) {
        pauseSimulation();
        playSimulation();
      }
    });
  });

  renderSimStep(0);

  // --- 4. INTERACTIVE ROI CALCULATOR ENGINE ---
  const rangeVolume = document.getElementById('range-volume');
  const rangeAutonomy = document.getElementById('range-autonomy');
  const rangeCost = document.getElementById('range-cost');

  const valVolume = document.getElementById('val-volume');
  const valAutonomy = document.getElementById('val-autonomy');
  const valCost = document.getElementById('val-cost');

  const resSavings = document.getElementById('res-savings');
  const resHours = document.getElementById('res-hours');
  const metricResRate = document.getElementById('metric-resolution-rate');

  function calculateROI() {
    if (!rangeVolume || !rangeAutonomy || !rangeCost) return;

    const volume = parseInt(rangeVolume.value);
    const autonomy = parseInt(rangeAutonomy.value) / 100;
    const costPerCase = parseInt(rangeCost.value);

    if (valVolume) valVolume.innerText = `${volume.toLocaleString()} cases`;
    if (valAutonomy) valAutonomy.innerText = `${Math.round(autonomy * 100)}%`;
    if (valCost) valCost.innerText = `₹${costPerCase} / case`;

    const resolvedCases = volume * autonomy;
    const monthlySavings = resolvedCases * costPerCase;
    const hoursSaved = Math.round((resolvedCases * 10) / 60);

    if (resSavings) resSavings.innerText = `₹${Math.round(monthlySavings).toLocaleString('en-IN')}`;
    if (resHours) resHours.innerText = `${hoursSaved.toLocaleString('en-IN')} hrs`;
    if (metricResRate) metricResRate.innerText = `${(autonomy * 100).toFixed(1)}%`;
  }

  if (rangeVolume) rangeVolume.addEventListener('input', calculateROI);
  if (rangeAutonomy) rangeAutonomy.addEventListener('input', calculateROI);
  if (rangeCost) rangeCost.addEventListener('input', calculateROI);

  calculateROI();

  // --- 5. TRAFFIC SURGE SIMULATION TRIGGER ---
  const btnSurge = document.getElementById('btn-trigger-surge');
  if (btnSurge) {
    btnSurge.addEventListener('click', () => {
      btnSurge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing 500 Req/s...';
      setTimeout(() => {
        btnSurge.innerHTML = '<i class="fa-solid fa-bolt"></i> Test System Load';
      }, 2000);
    });
  }

});
