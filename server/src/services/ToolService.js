import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ToolService {
  static async checkRefundEligibility({ transactionId }) {
    const txn = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { customer: true }
    });

    if (!txn) return { eligible: false, reason: 'Transaction not found' };
    
    // Convert dates
    const daysSince = (Date.now() - new Date(txn.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    
    // Evaluate policy strictly manually for the tool wrapper
    const eligible = txn.status === 'FAILED' && txn.debitStatus === 'DEBITED' && daysSince <= 30;

    return {
      eligible,
      amount: txn.amount,
      daysSince,
      status: txn.status,
      debitStatus: txn.debitStatus
    };
  }

  static async createRefund({ transactionId, amount, reason }) {
    const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!txn) throw new Error('Transaction not found');
    if (txn.refundStatus !== 'NOT_INITIATED') throw new Error('Refund already initiated or completed');

    const refund = await prisma.refund.create({
      data: {
        transactionId,
        customerId: txn.customerId,
        amount,
        reason,
        status: 'INITIATED',
        initiatedBy: 'AI_AGENT'
      }
    });

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { refundStatus: 'INITIATED' }
    });

    return { success: true, refundId: refund.id, status: 'INITIATED' };
  }

  static async verifyRefund({ refundId }) {
    await new Promise(r => setTimeout(r, 1500)); // Simulate bank API call
    
    const refund = await prisma.refund.update({
      where: { id: refundId },
      data: { status: 'COMPLETED', verifiedAt: new Date() }
    });

    await prisma.transaction.update({
      where: { id: refund.transactionId },
      data: { refundStatus: 'COMPLETED' }
    });

    return { success: true, status: 'COMPLETED' };
  }

  static async freezeAccount({ customerId, reason }) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { accountStatus: 'FROZEN' }
    });

    return { success: true, message: 'Account frozen', accountStatus: 'FROZEN' };
  }
}
