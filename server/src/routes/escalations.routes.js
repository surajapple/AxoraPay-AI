import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [escalations, total] = await Promise.all([
      prisma.escalation.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          case: { select: { id: true, title: true, issueType: true } },
          customer: { select: { name: true, email: true } }
        }
      }),
      prisma.escalation.count()
    ]);

    const mappedEscalations = escalations.map(esc => ({
      ...esc,
      case_id: esc.case?.id,
      case_title: esc.case?.title,
      issue_type: esc.case?.issueType,
      customer_name: esc.customer?.name,
      created_at: esc.createdAt,
    }));

    res.json({
      escalations: mappedEscalations,
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

router.patch('/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT_AGENT', 'CUSTOMER']), async (req, res) => {
  try {
    const { status, resolution, actionTaken } = req.body;
    
    const escalation = await prisma.escalation.update({
      where: { id: req.params.id },
      data: {
        status,
        resolution,
        actionTaken,
        resolvedAt: status === 'RESOLVED' ? new Date() : undefined,
        assignedTo: req.user.name
      }
    });

    if (status === 'RESOLVED') {
      await prisma.case.update({
        where: { id: escalation.caseId },
        data: { status: 'RESOLVED', resolution, resolvedAt: new Date() }
      });
    }

    res.json(escalation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
