import { Router } from 'express';
import { getPolicyConfig, updatePolicyConfig, POLICIES } from '../policies/policyEngine.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { TOOL_REGISTRY } from '../tools/toolRegistry.js';
import { getDb } from '../database/connection.js';

const router = Router();

// GET /api/admin/policies — Get all policies
router.get('/policies', authenticate, (req, res) => {
  res.json({ policies: POLICIES, config: getPolicyConfig() });
});

// PATCH /api/admin/policies/config — Update policy config
router.patch('/policies/config', authenticate, requireRole('ADMIN'), (req, res) => {
  const updated = updatePolicyConfig(req.body);
  res.json({ success: true, config: updated });
});

// GET /api/admin/tools — List all tools
router.get('/tools', authenticate, (req, res) => {
  const tools = Object.entries(TOOL_REGISTRY).map(([name, tool]) => ({
    name,
    description: tool.description,
    requiresAuth: tool.requiresAuth,
    requiresPolicy: tool.requiresPolicy || false,
  }));
  res.json({ tools });
});

// GET /api/admin/metrics — System metrics
router.get('/metrics', authenticate, (req, res) => {
  const db = getDb();
  const totalCases = db.prepare('SELECT COUNT(*) as c FROM support_cases').get().c;
  const resolvedCases = db.prepare("SELECT COUNT(*) as c FROM support_cases WHERE status='RESOLVED'").get().c;
  const escalatedCases = db.prepare("SELECT COUNT(*) as c FROM support_cases WHERE status='ESCALATED'").get().c;
  const totalRefunds = db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM refunds WHERE status='COMPLETED'").get().s;
  const refundCount = db.prepare("SELECT COUNT(*) as c FROM refunds WHERE status='COMPLETED'").get().c;
  const totalAuditLogs = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get().c;
  const totalCustomers = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  const pendingEscalations = db.prepare("SELECT COUNT(*) as c FROM escalations WHERE status='PENDING'").get().c;

  // Issue type breakdown
  const issueBreakdown = db.prepare(`
    SELECT issue_type, COUNT(*) as count FROM support_cases GROUP BY issue_type ORDER BY count DESC
  `).all();

  // Recent case trend (last 7 days)
  const trend = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count
    FROM support_cases
    WHERE created_at >= date('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all();

  res.json({
    totalCases, resolvedCases, escalatedCases, totalRefunds, refundCount,
    totalAuditLogs, totalCustomers, pendingEscalations,
    issueBreakdown, trend,
    aiProvider: process.env.GEMINI_API_KEY ? 'Gemini' : 'Demo Mode',
    databaseStatus: 'healthy',
    uptime: process.uptime(),
  });
});

// GET /api/admin/customers — List customers
router.get('/customers', authenticate, (req, res) => {
  const db = getDb();
  const customers = db.prepare(`
    SELECT c.*, w.balance as wallet_balance,
           COUNT(DISTINCT sc.id) as case_count,
           COUNT(DISTINCT r.id) as refund_count
    FROM customers c
    LEFT JOIN wallets w ON c.id = w.customer_id
    LEFT JOIN support_cases sc ON c.id = sc.customer_id
    LEFT JOIN refunds r ON c.id = r.customer_id AND r.status = 'COMPLETED'
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  res.json({ customers });
});

// GET /api/admin/transactions — List transactions
router.get('/transactions', authenticate, (req, res) => {
  const db = getDb();
  const { customerId, status } = req.query;
  let query = `
    SELECT t.*, c.name as customer_name, m.name as merchant_name
    FROM transactions t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN merchants m ON t.merchant_id = m.id
    WHERE 1=1
  `;
  const params = [];
  if (customerId) { query += ' AND t.customer_id = ?'; params.push(customerId); }
  if (status) { query += ' AND t.status = ?'; params.push(status); }
  query += ' ORDER BY t.created_at DESC LIMIT 100';

  const transactions = db.prepare(query).all(...params);
  res.json({ transactions });
});

export default router;
