import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [
      totalCases,
      resolvedCases,
      activeCases,
      escalatedCases,
      refunds,
      transactions,
    ] = await Promise.all([
      prisma.case.count(),
      prisma.case.count({ where: { status: 'RESOLVED' } }),
      prisma.case.count({ where: { status: 'OPEN' } }),
      prisma.case.count({ where: { status: 'ESCALATED' } }),
      prisma.refund.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.transaction.count()
    ]);

    const successRate = totalCases > 0 ? Math.round((resolvedCases / totalCases) * 100) : 0;

    res.json({
      totalCases,
      resolvedCases,
      activeCases,
      escalatedCases,
      successRate,
      averageResolutionTime: 45, // Simulated for demo
      refundsProcessed: refunds._count,
      refundAmount: refunds._sum.amount || 0,
      totalTransactions: transactions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/activity', requireAuth, async (req, res) => {
  try {
    const activity = await prisma.agentStep.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        agentExecution: {
          include: {
            case: {
              select: { id: true, title: true }
            }
          }
        }
      }
    });

    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
