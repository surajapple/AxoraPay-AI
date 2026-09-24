import { Router } from 'express';
import { getDb } from '../database/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/audit — Get audit logs
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const { caseId, limit = 100, offset = 0, action } = req.query;
  let query = 'SELECT al.*, sc.title as case_title FROM audit_logs al LEFT JOIN support_cases sc ON al.case_id = sc.id WHERE 1=1';
  const params = [];
  if (caseId) { query += ' AND al.case_id = ?'; params.push(caseId); }
  if (action) { query += ' AND al.action = ?'; params.push(action); }
  query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const logs = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;
  res.json({ logs, total });
});

export default router;
