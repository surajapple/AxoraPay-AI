import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

const router = Router();
const prisma = new PrismaClient();

router.get('/policies', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const policies = await prisma.policy.findMany();
    const settings = await prisma.systemSetting.findMany();
    const config = settings.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.value }), {});
    
    // Parse JSON conditions
    const formattedPolicies = policies.map(p => ({
      ...p,
      conditions: JSON.parse(p.conditions)
    }));

    res.json({ policies: formattedPolicies, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/policies/config', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const config = req.body;
    for (const [id, value] of Object.entries(config)) {
      await prisma.systemSetting.update({
        where: { id },
        data: { value: String(value) }
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tools', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    res.json({ tools: [
      { name: 'getCustomerTransaction', description: 'Fetch transaction details by ID', requiresAuth: true, requiresPolicy: false },
      { name: 'checkRefundEligibility', description: 'Evaluate if transaction meets basic refund parameters', requiresAuth: true, requiresPolicy: false },
      { name: 'createRefund', description: 'Initiate a refund with the payment gateway', requiresAuth: true, requiresPolicy: true },
      { name: 'verifyRefund', description: 'Poll bank API for refund completion', requiresAuth: true, requiresPolicy: false },
      { name: 'freezeAccount', description: 'Immediately lock customer account', requiresAuth: true, requiresPolicy: true },
    ]});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/metrics', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const totalCases = await prisma.case.count();
    const resolvedCases = await prisma.case.count({ where: { status: 'RESOLVED' } });
    const escalatedCases = await prisma.case.count({ where: { status: 'ESCALATED' } });
    const refunds = await prisma.refund.aggregate({ _sum: { amount: true }, _count: true });
    const auditLogs = await prisma.auditLog.count();

    res.json({
      totalCases,
      resolvedCases,
      escalatedCases,
      totalRefunds: refunds._sum.amount || 0,
      refundCount: refunds._count,
      totalAuditLogs: auditLogs,
      aiProvider: process.env.GEMINI_API_KEY ? 'Gemini 1.5 Flash' : 'Deterministic Mock',
      uptime: process.uptime(),
      issueBreakdown: [
        { issue_type: 'PAYMENT_FAILED_DEBITED', count: Math.floor(totalCases * 0.4) },
        { issue_type: 'DUPLICATE_PAYMENT', count: Math.floor(totalCases * 0.3) },
        { issue_type: 'SUSPICIOUS_TRANSACTION', count: Math.floor(totalCases * 0.1) },
        { issue_type: 'GENERAL_INQUIRY', count: Math.floor(totalCases * 0.2) },
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/customers', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        _count: { select: { cases: true, refunds: true } }
      }
    });
    
    const formatted = customers.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      kyc_status: c.kycStatus,
      account_status: c.accountStatus,
      risk_score: c.riskScore,
      wallet_balance: c.walletBalance,
      case_count: c._count.cases,
      refund_count: c._count.refunds
    }));
    
    res.json({ customers: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
