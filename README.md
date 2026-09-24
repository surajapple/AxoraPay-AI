# 🤖 AxoraPay — Autonomous Customer Resolution Teammate

> *"Don't just answer. **Resolve.**"*

**Paytm AI Hackathon 2026 · Track T3: Autonomous AI Teammates**

[![Demo Mode](https://img.shields.io/badge/Demo-No%20API%20Key%20Required-success)](.) [![SQLite](https://img.shields.io/badge/Database-SQLite-blue)](.) [![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)](.) [![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)](.)

---

## 🎯 Problem

Traditional customer support chatbots **only answer questions**. When a customer says "My payment failed but money was deducted," a chatbot responds with FAQs and escalates to a human agent. The customer waits hours. The agent manually investigates, files a refund, and closes the case.

**AxoraPay eliminates this loop.**

---

## 💡 Solution

AxoraPay is an **Autonomous AI Teammate** that:

1. **Understands** the customer's problem
2. **Retrieves** relevant transaction data via tools
3. **Plans** the sequence of actions needed
4. **Checks** deterministic policy rules before any financial action
5. **Executes** the appropriate resolution (refund, freeze, dispute, escalation)
6. **Verifies** the outcome from the database
7. **Communicates** the resolution to the customer in plain language
8. **Records** a complete audit trail of every decision

**Average resolution time: under 30 seconds, fully autonomous.**

---

## 🏗️ Architecture

```
Customer Message
       ↓
  AI Orchestrator
  (Intent Classification)
       ↓
  Context Retrieval
  (Customer + Transaction Data)
       ↓
  Action Planning
  (Tool Selection)
       ↓
  Policy Engine ←── AUTHORIZATION GATE
  (ALLOW / DENY / HUMAN_REVIEW)
       ↓
  Tool Execution
  (Refund / Freeze / Dispute / Escalate)
       ↓
  Outcome Verification
  (Re-read database state)
       ↓
  Case Update + Customer Response
```

### Core Principle: **LLM REASONS. Policy Engine AUTHORIZES. Tools ACT.**

The LLM can **propose** actions. The deterministic Policy Engine makes the **final authorization decision**. The LLM cannot bypass this gate.

---

## 🤖 AI Agent Architecture

### Agent Orchestrator (`server/src/agents/agentOrchestrator.js`)
Multi-step reasoning loop with 6 specialized handlers:
- `handlePaymentFailedDebited` — Auto-refund eligible transactions
- `handleDuplicatePayment` — Detect and refund duplicate charges
- `handleUPIFailed` — Check and explain UPI failures
- `handleWalletIssue` — Analyze wallet balance discrepancies
- `handleSuspiciousTransaction` — Flag, freeze, and escalate fraud
- `handleMerchantDispute` — Create disputes and escalate

### AI Provider Abstraction (`server/src/services/ai/aiProvider.js`)
```
AIProvider (interface)
├── GeminiProvider (uses Gemini 1.5 Flash when GEMINI_API_KEY is set)
└── DemoProvider (deterministic, works without any API key)
```

### Policy Engine (`server/src/policies/policyEngine.js`)
Deterministic rule engine — 6 policies:

| Policy | Trigger | Action |
|--------|---------|--------|
| Auto Refund | Failed + Debited + ≤₹5,000 | ALLOW |
| High Value | Amount > ₹5,000 | HUMAN_REVIEW |
| Suspicious Activity | Risk score ≥ 50 | HUMAN_REVIEW |
| Duplicate Payment | Same merchant/order/amount | ALLOW (duplicate only) |
| Merchant Dispute | Non-delivery claim | HUMAN_REVIEW |
| Multiple Refunds | > 3/month | HUMAN_REVIEW |

---

## 🔧 Agent Tools

| Tool | Description |
|------|-------------|
| `getCustomer()` | Retrieve customer profile + wallet |
| `getTransaction()` | Fetch specific transaction |
| `getTransactions()` | List customer transactions |
| `checkPaymentStatus()` | Get current payment status |
| `checkRefundEligibility()` | Determine refund eligibility |
| `calculateRefund()` | Calculate refund amount |
| `createRefund()` | Initiate a refund (requires policy ALLOW) |
| `verifyRefund()` | Verify refund was processed |
| `freezeAccount()` | Freeze suspicious account |
| `createDispute()` | Create merchant dispute |
| `sendNotification()` | Notify customer |
| `updateCase()` | Update support case |
| `escalateToHuman()` | Escalate to human review queue |
| `detectDuplicates()` | Find duplicate transactions |
| `analyzeWalletBalance()` | Analyze wallet discrepancies |

---

## 🎭 Demo Scenarios

### A. Payment Failed + Debited (Auto-Refund)
```
Customer: "My ₹500 payment failed but money was deducted"
Agent Steps: getCustomer → getTransaction → checkPaymentStatus → 
             checkRefundEligibility → Policy: ALLOW → createRefund → 
             verifyRefund → sendNotification → RESOLVED
```

### B. Duplicate Payment (Auto-Refund)
```
Customer: "I was charged twice for the same order"
Agent Steps: getTransaction → detectDuplicates → Policy: ALLOW →
             createRefund(duplicate) → verifyRefund → RESOLVED
```

### C. Suspicious Transaction (Freeze + Escalate)
```
Customer: "I don't recognize this ₹4,999 transaction"
Agent Steps: getTransaction → Policy: HUMAN_REVIEW → freezeAccount →
             escalateToHuman → sendNotification(security alert) → ESCALATED
```

### D. High-Value Refund (Escalate)
```
Customer: "My ₹15,000 IRCTC payment failed"
Agent Steps: getTransaction → checkRefundEligibility → Policy: HUMAN_REVIEW
             (amount > ₹5,000) → escalateToHuman → ESCALATED
```

### E. Merchant Dispute
```
Customer: "I paid ₹12,000 for a laptop but product not delivered"
Agent Steps: getTransaction → Policy: HUMAN_REVIEW → createDispute →
             escalateToHuman → ESCALATED (merchant team notified)
```

### F. UPI Failed (No Action Needed)
```
Customer: "My UPI payment failed"
Agent Steps: getTransaction → checkPaymentStatus → 
             (No debit detected) → Policy: DENY → Explain → RESOLVED
```

---

## 👥 Human-in-the-Loop

The AI escalates to human review when:
- Transaction amount > ₹5,000
- Suspicious activity detected
- Merchant dispute filed
- Multiple refund attempts
- Customer risk score elevated
- KYC not verified (when policy enabled)

Human agents can: **Approve → Resolve** or **Reject** or **Request Information**

---

## 🗂️ Project Structure

```
/Paytm-AI-Hackathon-main
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx     # Hero + pipeline visualization
│   │   │   ├── LoginPage.jsx       # Demo credentials
│   │   │   ├── DashboardPage.jsx   # KPIs + live demo runner
│   │   │   ├── CasesPage.jsx       # Case management table
│   │   │   ├── CaseDetailPage.jsx  # Agent timeline + decisions
│   │   │   ├── ChatPage.jsx        # Customer chat + agent panel
│   │   │   ├── EscalationsPage.jsx # Human review queue
│   │   │   ├── AuditPage.jsx       # Complete audit log
│   │   │   └── AdminPage.jsx       # Policies + tools + metrics
│   │   ├── components/
│   │   │   └── Layout.jsx          # Sidebar navigation
│   │   ├── hooks/
│   │   │   └── useAuth.jsx         # Auth context
│   │   └── services/
│   │       └── api.js              # All API calls
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                    # Node.js + Express backend
│   ├── src/
│   │   ├── agents/
│   │   │   └── agentOrchestrator.js  # Main AI agent loop
│   │   ├── tools/
│   │   │   └── toolRegistry.js       # 15 agent tools
│   │   ├── policies/
│   │   │   └── policyEngine.js       # Deterministic policy engine
│   │   ├── services/ai/
│   │   │   └── aiProvider.js         # Gemini + Demo providers
│   │   ├── routes/
│   │   │   ├── cases.js
│   │   │   ├── audit.js
│   │   │   ├── escalations.js
│   │   │   └── admin.js
│   │   ├── database/
│   │   │   ├── connection.js
│   │   │   ├── schema.js
│   │   │   └── seed.js               # Mock Paytm data
│   │   ├── middleware/
│   │   │   └── auth.js               # JWT-like session auth
│   │   ├── tests/
│   │   │   └── agent.test.js         # 18 integration tests
│   │   └── index.js                  # Express server
│   └── .env.example
│
├── data/                      # SQLite database (auto-created)
├── package.json               # Root convenience scripts
└── README.md
```

---

## 🚀 Setup & Running

### Prerequisites
- Node.js 18+
- npm 9+

### Quick Start

```bash
# 1. Clone and enter directory
cd Paytm-AI-Hackathon-main

# 2. Install all dependencies
cd server && npm install && cd ../client && npm install

# 3. Seed the database
cd ../server && node src/database/seed.js

# 4. Start the backend server (Terminal 1)
cd server && node src/index.js

# 5. Start the frontend (Terminal 2)
cd client && npm run dev

# Open: http://localhost:5173
```

### With Gemini AI (optional)

```bash
# server/.env
GEMINI_API_KEY=your_gemini_api_key_here
```

The app works **perfectly without a Gemini API key** using deterministic Demo Mode.

---

## 🔑 Environment Variables

**server/.env:**
```env
GEMINI_API_KEY=           # Optional: enables Gemini AI
PORT=3001                 # Server port
NODE_ENV=development
```

**client/.env:**
```env
VITE_API_URL=http://localhost:3001
```

---

## 👤 Demo Credentials

| Email | Password | Role | Access |
|-------|----------|------|--------|
| demo@axorapay.com | demo123 | CUSTOMER | Customer chat |
| admin@axorapay.com | admin123 | ADMIN | Full admin panel |
| agent@axorapay.com | agent123 | AGENT | Case management |
| rahul@email.com | test123 | CUSTOMER | Has TXN10001 (failed + debited) |

---

## 🧪 Running Tests

```bash
cd server && node src/tests/agent.test.js
```

**18 tests covering:**
1. Auto-refund policy — ALLOW
2. High-value escalation — HUMAN_REVIEW
3. Suspicious activity — HUMAN_REVIEW
4. Duplicate refund denial
5. No-debit denial
6. Transaction not failed — DENY
7. Duplicate payment — ALLOW
8. Suspicious policy — HUMAN_REVIEW + freeze
9. Merchant dispute — HUMAN_REVIEW
10. getCustomer tool
11. getTransaction tool
12. checkPaymentStatus tool
13. checkRefundEligibility tool
14. Agent: payment failed → auto refund
15. Agent: high-value → escalation
16. Agent: suspicious → freeze + escalate
17. Agent: duplicate → refund
18. Refund verification

---

## 🎬 Live Demo Flow (Hackathon)

1. **Open** http://localhost:5173
2. **Click** "Run Demo" on the landing page
3. **Login** as demo@axorapay.com / demo123
4. **Navigate** to Customer Chat
5. **Type**: "My payment failed but ₹500 was deducted"
6. **Watch** the agent execution panel execute 15+ steps in real-time
7. **See** the policy decision: ALLOW → Refund executed
8. **Check** Case Detail for the complete timeline
9. **View** Audit Logs for the full trail
10. **Click** Reset Demo to run again

---

## 📊 Mock Data

| Resource | Count |
|----------|-------|
| Customers | 8 |
| Merchants | 8 |
| Transactions | 10 |
| Support Cases | 6 |
| Escalations | 3 |
| Audit Events | 9+ (grows with use) |

---

## ⚠️ Important Notice

> **All financial APIs in this prototype are simulated/mocked.**
> No real Paytm transaction data is accessed or modified.
> This is a hackathon demonstration prototype.
> The database is a local SQLite file seeded with realistic test data.

---

## 🔮 Future Improvements

1. **Real Paytm API Integration** — Production-grade tool implementations
2. **Streaming Responses** — WebSocket-based real-time agent step streaming
3. **Multi-language Support** — Hindi, Tamil, Telugu for customer messages
4. **Voice Interface** — IVR integration for phone-based resolution
5. **Advanced Fraud ML** — Graph-based fraud detection models
6. **Multi-agent Orchestration** — Specialized sub-agents for each domain
7. **SLA Tracking** — Automated SLA breach detection and alerts
8. **A/B Testing** — Compare AI resolution vs human resolution quality

---

## 🏆 Track 3 Alignment

**"Autonomous AI Teammates"** — AxoraPay demonstrates:

✅ **Autonomous execution** — Not just text generation; real tool calls and state changes

✅ **Policy governance** — LLM proposals go through deterministic authorization

✅ **Human-in-the-loop** — Smart escalation for edge cases

✅ **Complete observability** — Every step, decision, and action is visible and auditable

✅ **Business impact** — Reduces mean resolution time from hours to seconds

✅ **Production architecture** — Real backend, real database, real tool calls

---

*Built for Paytm AI Hackathon 2026 — Track T3: Autonomous AI Teammates*
