// Database Schema Definitions
export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    kyc_status TEXT DEFAULT 'VERIFIED',
    account_status TEXT DEFAULT 'ACTIVE',
    risk_score INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wallets (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    balance REAL DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'ACTIVE',
    last_transaction_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    merchant_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'INR',
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    debit_status TEXT DEFAULT 'NOT_DEBITED',
    refund_status TEXT DEFAULT 'NOT_INITIATED',
    payment_method TEXT DEFAULT 'UPI',
    order_id TEXT,
    description TEXT,
    failure_reason TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );

  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'INITIATED',
    reason TEXT,
    policy_decision TEXT,
    initiated_by TEXT DEFAULT 'AI_AGENT',
    verified_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    description TEXT,
    evidence TEXT DEFAULT '[]',
    resolution TEXT,
    assigned_to TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS support_cases (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    transaction_id TEXT,
    issue_type TEXT NOT NULL,
    priority TEXT DEFAULT 'MEDIUM',
    status TEXT DEFAULT 'OPEN',
    title TEXT NOT NULL,
    description TEXT,
    ai_confidence REAL DEFAULT 0,
    resolution TEXT,
    refund_amount REAL,
    agent_steps TEXT DEFAULT '[]',
    policy_decision TEXT,
    ai_explanation TEXT,
    assigned_agent TEXT,
    escalation_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    customer_id TEXT,
    action TEXT NOT NULL,
    actor TEXT DEFAULT 'AI_AGENT',
    actor_type TEXT DEFAULT 'SYSTEM',
    details TEXT DEFAULT '{}',
    tool_name TEXT,
    tool_input TEXT,
    tool_output TEXT,
    status TEXT DEFAULT 'SUCCESS',
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (case_id) REFERENCES support_cases(id)
  );

  CREATE TABLE IF NOT EXISTS escalations (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    priority TEXT DEFAULT 'HIGH',
    status TEXT DEFAULT 'PENDING',
    assigned_to TEXT,
    notes TEXT,
    resolution TEXT,
    action_taken TEXT,
    resolved_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (case_id) REFERENCES support_cases(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    case_id TEXT,
    channel TEXT DEFAULT 'APP',
    message TEXT NOT NULL,
    status TEXT DEFAULT 'SENT',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );
`;
