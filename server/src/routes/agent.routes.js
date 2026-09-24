import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AgentService } from '../services/AgentService.js';
import { getDb } from '../database/connection.js';

const router = Router();
const prisma = new PrismaClient();

// Handle a message in the chat
router.post('/message', requireAuth, async (req, res) => {
  try {
    const { caseId, content } = req.body;
    
    // Save user message
    const msg = await prisma.caseMessage.create({
      data: { caseId, role: 'user', content }
    });

    if (global.io) {
      global.io.to(`case_${caseId}`).emit('new_message', msg);
    }

    // Run agent in background so response can be immediate
    AgentService.executeWorkflow(caseId).catch(console.error);

    res.json({ success: true, message: msg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Demo Endpoints
router.post('/demo/start', requireAuth, async (req, res) => {
  try {
    const { caseId } = req.body;
    
    const demoCase = await prisma.case.findUnique({ where: { id: caseId }});
    if (!demoCase) return res.status(404).json({ error: 'Case not found' });

    // Ensure status is OPEN to allow execution
    if (demoCase.status !== 'OPEN') {
      await prisma.case.update({ where: { id: caseId }, data: { status: 'OPEN' }});
    }

    // Run agent
    AgentService.executeWorkflow(caseId).catch(console.error);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/demo/reset', requireAuth, async (req, res) => {
  try {
    // Reset the demo transactions and cases back to original state
    await prisma.transaction.updateMany({
      where: { id: { in: ['TXN20001', 'TXN20004', 'TXN20005'] } },
      data: { refundStatus: 'NOT_INITIATED', status: 'FAILED' }
    });

    await prisma.refund.deleteMany({
      where: { transactionId: { in: ['TXN20001', 'TXN20004', 'TXN20005'] } }
    });

    await prisma.case.updateMany({
      where: { id: { in: ['CASE-DEMO-001', 'CASE-DEMO-002', 'CASE-DEMO-003', 'CASE-DEMO-004'] } },
      data: { status: 'OPEN', resolution: null, policyDecision: null, refundAmount: null, resolvedAt: null, escalationReason: null }
    });
    
    await prisma.agentExecution.deleteMany({
      where: { caseId: { in: ['CASE-DEMO-001', 'CASE-DEMO-002', 'CASE-DEMO-003', 'CASE-DEMO-004'] } }
    });
    
    await prisma.escalation.deleteMany();
    await prisma.customer.updateMany({ data: { accountStatus: 'ACTIVE' }});

    if (global.io) global.io.emit('demo_reset');
    
    res.json({ success: true, message: 'Demo state reset' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
