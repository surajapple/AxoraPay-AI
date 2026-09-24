import { Router } from 'express';
import { getDb } from '../database/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/escalations — List escalations
router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const escalations = db.prepare(`
    SELECT e.*, sc.title as case_title, sc.issue_type, c.name as customer_name, c.email as customer_email
    FROM escalations e
    LEFT JOIN support_cases sc ON e.case_id = sc.id
    LEFT JOIN customers c ON e.customer_id = c.id
    ORDER BY CASE e.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, e.created_at DESC
  `).all();
  res.json({ escalations });
});

// PATCH /api/escalations/:id — Resolve/update escalation
router.patch('/:id', authenticate, (req, res) => {
  const db = getDb();
  const { status, resolution, actionTaken, notes } = req.body;
  const updates = ["updated_at = datetime('now')"];
  const params = [];
  if (status) { updates.push('status = ?'); params.push(status); }
  if (resolution) { updates.push('resolution = ?'); params.push(resolution); }
  if (actionTaken) { updates.push('action_taken = ?'); params.push(actionTaken); }
  if (notes) { updates.push('notes = ?'); params.push(notes); }
  if (status === 'RESOLVED') { updates.push("resolved_at = datetime('now')"); }
  if (req.user) { updates.push('assigned_to = ?'); params.push(req.user.name); }
  params.push(req.params.id);

  db.prepare(`UPDATE escalations SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // Get escalation to update case
  const escalation = db.prepare('SELECT * FROM escalations WHERE id = ?').get(req.params.id);
  if (escalation && status === 'RESOLVED') {
    db.prepare("UPDATE support_cases SET status = 'RESOLVED', resolved_at = datetime('now'), resolution = ? WHERE id = ?")
      .run(resolution || 'Resolved by human agent', escalation.case_id);
  }

  db.prepare(`INSERT INTO audit_logs (id, case_id, action, actor, actor_type, details) VALUES (?, ?, 'ESCALATION_UPDATED', ?, 'HUMAN', ?)`)
    .run(uuidv4(), escalation?.case_id, req.user?.name || 'Agent', JSON.stringify({ status, resolution, actionTaken }));

  res.json({ success: true });
});

export default router;
