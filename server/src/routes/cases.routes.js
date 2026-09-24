import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AgentService } from '../services/AgentService.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// GET /api/cases with pagination and filters
router.get('/', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status, search } = req.query;

    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { title: { contains: search } },
        { customer: { name: { contains: search } } }
      ];
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, email: true } },
          transaction: { select: { amount: true, currency: true } }
        }
      }),
      prisma.case.count({ where })
    ]);

    res.json({
      data: cases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/cases/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        transaction: true,
        agentExecutions: {
          include: {
            steps: { orderBy: { createdAt: 'asc' } }
          },
          orderBy: { startedAt: 'desc' },
          take: 1
        },
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!caseData) return res.status(404).json({ error: 'Case not found' });
    res.json(caseData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

import { runAgent } from '../agents/agentOrchestrator.js';

// POST /api/cases
router.post('/', requireAuth, async (req, res) => {
  try {
    const { customerMessage, transactionId, issueType, priority = 'HIGH' } = req.body;
    
    const caseId = `CASE${Date.now()}`;
    
    await prisma.case.create({
      data: {
        id: caseId,
        customerId: req.user.customerId,
        transactionId: transactionId || null,
        issueType: issueType || 'GENERAL_INQUIRY',
        priority,
        status: 'OPEN',
        title: customerMessage.substring(0, 100),
        description: customerMessage
      }
    });

    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        caseId,
        customerId: req.user.customerId,
        action: 'CASE_CREATED',
        actor: 'CUSTOMER',
        actorType: 'CUSTOMER',
        details: JSON.stringify({ message: customerMessage, transactionId })
      }
    });

    // Run agent synchronously and collect steps
    const allSteps = [];
    let agentResult = null;
    
    try {
      agentResult = await runAgent({
        caseId,
        customerId: req.user.customerId,
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
