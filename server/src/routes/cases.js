import { Router } from 'express';
import { getDb } from '../database/connection.js';
import { runAgent } from '../agents/agentOrchestrator.js';
import { authenticate } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/cases — List all cases
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { status, priority, limit = 50, offset = 0 } = req.query;
  let query = `
    SELECT sc.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
           t.amount, t.payment_method, t.merchant_id,
           m.name as merchant_name
    FROM support_cases sc
    LEFT JOIN customers c ON sc.customer_id = c.id
    LEFT JOIN transactions t ON sc.transaction_id = t.id
    LEFT JOIN merchants m ON t.merchant_id = m.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { query += ' AND sc.status = ?'; params.push(status); }
  if (priority) { query += ' AND sc.priority = ?'; params.push(priority); }
  query += ' ORDER BY sc.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const cases = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM support_cases').get().count;
  res.json({ cases, total, limit: parseInt(limit), offset: parseInt(offset) });
});

// GET /api/cases/stats — Dashboard statistics
router.get('/stats', authenticate, (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM support_cases').get().count;
  const resolved = db.prepare("SELECT COUNT(*) as count FROM support_cases WHERE status = 'RESOLVED'").get().count;
  const escalated = db.prepare("SELECT COUNT(*) as count FROM support_cases WHERE status = 'ESCALATED'").get().count;
  const open = db.prepare("SELECT COUNT(*) as count FROM support_cases WHERE status IN ('OPEN', 'INVESTIGATING')").get().count;
  const refundsTotal = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE status = 'COMPLETED'").get().total;
  const refundCount = db.prepare("SELECT COUNT(*) as count FROM refunds WHERE status = 'COMPLETED'").get().count;
  const avgConfidence = db.prepare('SELECT AVG(ai_confidence) as avg FROM support_cases WHERE ai_confidence > 0').get().avg || 0;

  res.json({
    totalCases: total,
    aiResolved: resolved,
    humanEscalations: escalated,
    openCases: open,
    refundsProcessed: refundCount,
    totalRefundAmount: refundsTotal,
    successRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    avgAiConfidence: Math.round(avgConfidence * 100),
    avgResolutionTime: '4.2 min',
  });
});

// GET /api/cases/:id — Get single case details
router.get('/:id', authenticate, (req, res) => {
  const db = getDb();
  const caseData = db.prepare(`
    SELECT sc.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
           c.kyc_status, c.account_status, c.risk_score,
           t.amount, t.payment_method, t.status as txn_status, t.debit_status,
           t.refund_status, t.failure_reason, t.order_id, t.description as txn_description,
           t.created_at as txn_created_at, t.merchant_id, t.payment_method,
           m.name as merchant_name, m.category as merchant_category,
           w.balance as wallet_balance
    FROM support_cases sc
    LEFT JOIN customers c ON sc.customer_id = c.id
    LEFT JOIN transactions t ON sc.transaction_id = t.id
    LEFT JOIN merchants m ON t.merchant_id = m.id
    LEFT JOIN wallets w ON c.id = w.customer_id
    WHERE sc.id = ?
  `).get(req.params.id);

  if (!caseData) return res.status(404).json({ error: 'Case not found' });

  // Get audit logs for this case
  const auditLogs = db.prepare('SELECT * FROM audit_logs WHERE case_id = ? ORDER BY created_at ASC').all(req.params.id);

  // Get escalation
  const escalation = db.prepare('SELECT * FROM escalations WHERE case_id = ?').get(req.params.id);

  // Parse agent_steps
  let agentSteps = [];
  try { agentSteps = JSON.parse(caseData.agent_steps || '[]'); } catch {}

  let aiExplanation = null;
  try { aiExplanation = JSON.parse(caseData.ai_explanation || 'null'); } catch {}

  // Get refund info
  const refund = db.prepare('SELECT * FROM refunds WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1').get(caseData.transaction_id);

  res.json({ ...caseData, agentSteps, aiExplanation, auditLogs, escalation, refund });
});

// POST /api/cases — Create new case and run agent
router.post('/', authenticate, async (req, res) => {
  const db = getDb();
  const { customerMessage, transactionId, issueType, priority = 'MEDIUM' } = req.body;
  const customerId = req.user.customerId;

  if (!customerMessage) return res.status(400).json({ error: 'Customer message required' });

  const caseId = `CASE${Date.now()}`;
  const title = customerMessage.slice(0, 100);

  db.prepare(`
    INSERT INTO support_cases (id, customer_id, transaction_id, issue_type, priority, status, title, description)
    VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)
  `).run(caseId, customerId, transactionId || null, issueType || 'GENERAL_INQUIRY', priority, title, customerMessage);

  // Log case creation
  db.prepare(`
    INSERT INTO audit_logs (id, case_id, customer_id, action, actor, actor_type, details)
    VALUES (?, ?, ?, 'CASE_CREATED', 'CUSTOMER', 'CUSTOMER', ?)
  `).run(uuidv4(), caseId, customerId, JSON.stringify({ message: customerMessage, transactionId }));

  // Run agent asynchronously and collect steps
  const allSteps = [];
  let agentResult = null;

  try {
    agentResult = await runAgent({
      caseId,
      customerId,
      customerMessage,
      transactionId,
      issueType,
      onStep: (step) => { allSteps.push(step); },
    });
  } catch (error) {
    console.error('Agent run error:', error);
    agentResult = { success: false, error: error.message, steps: allSteps };
  }

  res.json({
    caseId,
    success: agentResult.success,
    steps: agentResult.steps || allSteps,
    customerResponse: agentResult.customerResponse,
    explanation: agentResult.explanation,
    resolution: agentResult.resolution,
    status: agentResult.status,
    policyResult: agentResult.policyResult,
    refund: agentResult.refund,
    transaction: agentResult.transaction,
    escalation: agentResult.escalation,
    issueType: agentResult.issueType,
    issueAnalysis: agentResult.issueAnalysis,
  });
});

// POST /api/cases/:id/run-agent — Re-run agent for existing case
router.post('/:id/run-agent', authenticate, async (req, res) => {
  const db = getDb();
  const caseData = db.prepare('SELECT * FROM support_cases WHERE id = ?').get(req.params.id);
  if (!caseData) return res.status(404).json({ error: 'Case not found' });

  db.prepare("UPDATE support_cases SET status = 'INVESTIGATING', updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  const allSteps = [];
  const agentResult = await runAgent({
    caseId: req.params.id,
    customerId: caseData.customer_id,
    customerMessage: caseData.description,
    transactionId: caseData.transaction_id,
    issueType: caseData.issue_type,
    onStep: (step) => { allSteps.push(step); },
  });

  res.json({ ...agentResult, steps: agentResult.steps || allSteps });
});

// PATCH /api/cases/:id — Update case (for human agents)
router.patch('/:id', authenticate, (req, res) => {
  const db = getDb();
  const { status, resolution, notes } = req.body;
  const updates = ["updated_at = datetime('now')"];
  const params = [];

  if (status) { updates.push('status = ?'); params.push(status); }
  if (resolution) { updates.push('resolution = ?'); params.push(resolution); }
  if (status === 'RESOLVED') { updates.push("resolved_at = datetime('now')"); }
  params.push(req.params.id);

  db.prepare(`UPDATE support_cases SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  db.prepare(`
    INSERT INTO audit_logs (id, case_id, action, actor, actor_type, details)
    VALUES (?, ?, 'CASE_UPDATED', ?, 'HUMAN', ?)
  `).run(uuidv4(), req.params.id, req.user.name, JSON.stringify({ status, resolution, notes }));

  res.json({ success: true, caseId: req.params.id });
});

export default router;
