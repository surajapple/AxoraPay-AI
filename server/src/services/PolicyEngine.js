import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PolicyEngine {
  static async evaluateRefund(transactionId) {
    const txn = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { customer: true }
    });

    if (!txn) throw new Error('Transaction not found');

    const config = await prisma.systemSetting.findMany();
    const settings = config.reduce((acc, curr) => ({ ...acc, [curr.id]: curr.value }), {});
    
    const limit = parseFloat(settings.AUTO_REFUND_LIMIT) || 5000;
    
    let decision = 'ALLOW';
    let reason = 'Transaction meets criteria for autonomous refund.';

    if (txn.amount > limit) {
      decision = 'HUMAN_REVIEW';
      reason = `Amount (₹${txn.amount}) exceeds autonomous auto-refund limit (₹${limit}).`;
    } else if (txn.customer.riskScore > (parseInt(settings.SUSPICIOUS_RISK_THRESHOLD) || 75)) {
      decision = 'DENY';
      reason = 'Customer risk score is too high for autonomous refund.';
    } else if (settings.REQUIRE_KYC_FOR_REFUND === 'true' && txn.customer.kycStatus !== 'VERIFIED') {
      decision = 'HUMAN_REVIEW';
      reason = 'KYC is not verified. Human review required for refund.';
    }

    const policyRecord = await prisma.policyDecision.create({
      data: {
        policyName: 'Auto-Refund Eligibility',
        decision,
        reason,
        context: JSON.stringify({ txnId: transactionId, amount: txn.amount, riskScore: txn.customer.riskScore })
      }
    });

    return { decision, reason, decisionId: policyRecord.id };
  }
}
