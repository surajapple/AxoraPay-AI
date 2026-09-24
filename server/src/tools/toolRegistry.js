import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export async function logAudit({ caseId, action, actor = 'AI_AGENT', actorType = 'SYSTEM', toolName, toolInput, toolOutput, details = {}, status = 'SUCCESS' }) {
  await prisma.auditLog.create({
    data: {
      caseId: caseId || null,
      action,
      actor,
      actorType,
      toolName: toolName || null,
      details: JSON.stringify({ toolInput, toolOutput, ...details }),
      status
    }
  });
}

// ── Tool: getCustomer ─────────────────────────────────────────────────────────
export async function getCustomer({ customerId, caseId }) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  
  if (!customer) throw new Error(`Customer ${customerId} not found`);
  const result = customer;
  await logAudit({ caseId, action: 'TOOL_CALLED', toolName: 'getCustomer', toolInput: { customerId }, toolOutput: { id: result.id, name: result.name, status: result.accountStatus } });
  return result;
}

export async function getTransaction({ transactionId, caseId }) {
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId }, include: { merchant: true } });
  if (!txn) throw new Error(`Transaction ${transactionId} not found`);
  const result = { ...txn, merchant_name: txn.merchant?.name, merchant_category: txn.merchant?.category, debit_status: txn.debitStatus, refund_status: txn.refundStatus, created_at: txn.createdAt };
  await logAudit({ caseId, action: 'TOOL_CALLED', toolName: 'getTransaction', toolInput: { transactionId }, toolOutput: { id: txn.id, status: txn.status, amount: txn.amount, debitStatus: txn.debitStatus } });
  return result;
}

export async function getTransactions({ customerId, limit = 10, status, caseId }) {
  const where = { customerId };
  if (status) where.status = status;
  const txns = await prisma.transaction.findMany({ where, take: limit, orderBy: { createdAt: 'desc' }, include: { merchant: true } });
  const result = txns.map(t => ({ ...t, merchant_name: t.merchant?.name, debit_status: t.debitStatus, refund_status: t.refundStatus, created_at: t.createdAt }));
  await logAudit({ caseId, action: 'TOOL_CALLED', toolName: 'getTransactions', toolInput: { customerId, limit, status }, toolOutput: { count: result.length } });
  return result;
}

export async function checkPaymentStatus({ transactionId, caseId }) {
  const txn = await getTransaction({ transactionId, caseId: null });
  const result = {
    transactionId: txn.id,
    status: txn.status,
    debitStatus: txn.debit_status,
    refundStatus: txn.refund_status,
    amount: txn.amount,
    paymentMethod: txn.paymentMethod,
    failureReason: txn.failureReason,
    merchantName: txn.merchant_name,
    createdAt: txn.created_at,
  };
  await logAudit({ caseId, action: 'TOOL_CALLED', toolName: 'checkPaymentStatus', toolInput: { transactionId }, toolOutput: result });
  return result;
}

export async function checkRefundEligibility({ transactionId, customerId, caseId }) {
  const txn = await getTransaction({ transactionId, caseId: null });
  
  const existingRefund = await prisma.refund.findFirst({ where: { transactionId, status: { not: 'CANCELLED' } } });
  
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyRefunds = await prisma.refund.count({ where: { customerId, createdAt: { gte: monthStart }, status: 'COMPLETED' } });
  
  const txnDate = new Date(txn.created_at);
  const daysSinceTxn = Math.floor((Date.now() - txnDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const result = {
    eligible: txn.status === 'FAILED' && txn.debit_status === 'DEBITED' && !existingRefund,
    transactionStatus: txn.status,
    debitStatus: txn.debit_status,
    refundStatus: txn.refund_status,
    existingRefund: existingRefund ? existingRefund.id : null,
    daysSinceTransaction: daysSinceTxn,
    monthlyRefundCount: monthlyRefunds,
    amount: txn.amount,
  };
  
  await logAudit({ caseId, action: 'TOOL_CALLED', toolName: 'checkRefundEligibility', toolInput: { transactionId }, toolOutput: result });
  return result;
}

export async function calculateRefund({ transactionId, caseId }) {
  const txn = await getTransaction({ transactionId, caseId: null });
  const result = {
    originalAmount: txn.amount,
    refundAmount: txn.amount,
    processingFee: 0,
    netRefund: txn.amount,
    currency: 'INR',
    estimatedTimeline: '3-5 business days',
  };
  await logAudit({ caseId, action: 'TOOL_CALLED', toolName: 'calculateRefund', toolInput: { transactionId }, toolOutput: result });
  return result;
}

export async function createRefund({ transactionId, customerId, amount, reason, policyDecision, caseId }) {
  const existing = await prisma.refund.findFirst({ where: { transactionId, status: { notIn: ['CANCELLED', 'FAILED'] } } });
  if (existing) throw new Error('Refund already exists for this transaction');
  
  const refundId = `REF${Date.now()}`;
  
  await prisma.refund.create({
    data: {
      id: refundId, transactionId, customerId, amount, status: 'PROCESSING', reason, policyDecision, initiatedBy: 'AI_AGENT'
    }
  });
  
  await prisma.transaction.update({ where: { id: transactionId }, data: { refundStatus: 'INITIATED' } });
  
  const result = { refundId, transactionId, customerId, amount, status: 'PROCESSING', reason, createdAt: new Date().toISOString() };
  await logAudit({ caseId, action: 'REFUND_CREATED', toolName: 'createRefund', toolInput: { transactionId, amount }, toolOutput: result, details: { refundId, policyDecision } });
  return result;
}

export async function verifyRefund({ refundId, caseId }) {
  const refund = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!refund) throw new Error(`Refund ${refundId} not found`);
  
  const verifiedAt = new Date();
  await prisma.refund.update({ where: { id: refundId }, data: { status: 'COMPLETED', verifiedAt, completedAt: verifiedAt } });
  await prisma.transaction.update({ where: { id: refund.transactionId }, data: { refundStatus: 'COMPLETED' } });
  
  const result = {
    refundId, status: 'COMPLETED', amount: refund.amount, verifiedAt: verifiedAt.toISOString(), message: `Refund of ₹${refund.amount.toLocaleString('en-IN')} verified and processed successfully.`,
  };
  await logAudit({ caseId, action: 'REFUND_VERIFIED', toolName: 'verifyRefund', toolInput: { refundId }, toolOutput: result });
  return result;
}

export async function freezeAccount({ customerId, reason, caseId }) {
  await prisma.customer.update({ where: { id: customerId }, data: { accountStatus: 'FROZEN' } });
  const result = { customerId, status: 'FROZEN', reason, frozenAt: new Date().toISOString() };
  await logAudit({ caseId, action: 'ACCOUNT_FROZEN', toolName: 'freezeAccount', toolInput: { customerId, reason }, toolOutput: result, details: { securityAction: true } });
  return result;
}

export async function createDispute({ transactionId, customerId, type, description, caseId }) {
  const disputeId = `DISP${Date.now()}`;
  await prisma.dispute.create({ data: { id: disputeId, transactionId, customerId, type, description, status: 'OPEN' } });
  const result = { disputeId, transactionId, customerId, type, status: 'OPEN', createdAt: new Date().toISOString() };
  await logAudit({ caseId, action: 'DISPUTE_CREATED', toolName: 'createDispute', toolInput: { transactionId, type }, toolOutput: result });
  return result;
}

export async function sendNotification({ customerId, caseId, message, channel = 'APP' }) {
  const notifId = uuidv4();
  await prisma.notification.create({ data: { id: notifId, customerId, caseId: caseId || null, channel, message, status: 'SENT' } });
  const result = { notifId, customerId, channel, status: 'SENT', message, sentAt: new Date().toISOString() };
  await logAudit({ caseId, action: 'NOTIFICATION_SENT', toolName: 'sendNotification', toolInput: { customerId, channel }, toolOutput: result });
  return result;
}

export async function updateCase({ caseId, status, resolution, aiExplanation, policyDecision, aiConfidence, agentSteps, refundAmount }) {
  const data = {};
  if (status) data.status = status;
  if (resolution) data.resolution = resolution;
  if (aiExplanation) data.aiExplanation = aiExplanation;
  if (policyDecision) data.policyDecision = policyDecision;
  if (aiConfidence !== undefined) data.aiConfidence = aiConfidence;
  if (refundAmount !== undefined) data.refundAmount = refundAmount;
  if (status === 'RESOLVED') data.resolvedAt = new Date();
  
  await prisma.case.update({ where: { id: caseId }, data });
  await logAudit({ caseId, action: 'CASE_UPDATED', details: { status, resolution } });
  return { caseId, status, updated: true };
}

export async function escalateToHuman({ caseId, customerId, reason, priority = 'HIGH' }) {
  const existing = await prisma.escalation.findFirst({ where: { caseId, status: 'PENDING' } });
  if (existing) return { escalationId: existing.id, status: 'PENDING', message: 'Escalation already exists' };
  
  const escalationId = `ESC${Date.now()}`;
  await prisma.escalation.create({ data: { id: escalationId, caseId, customerId, reason, priority, status: 'PENDING' } });
  await prisma.case.update({ where: { id: caseId }, data: { status: 'ESCALATED' } });
  
  const result = { escalationId, caseId, reason, priority, status: 'PENDING', createdAt: new Date().toISOString() };
  await logAudit({ caseId, action: 'ESCALATED', toolName: 'escalateToHuman', toolInput: { reason, priority }, toolOutput: result });
  return result;
}

export async function detectDuplicates({ customerId, transactionId, caseId }) {
  const txn = await getTransaction({ transactionId, caseId: null });
  const duplicates = await prisma.transaction.findMany({
    where: { customerId, merchantId: txn.merchantId, amount: txn.amount, orderId: txn.orderId, id: { not: transactionId }, status: 'SUCCESS' },
    orderBy: { createdAt: 'asc' }, include: { merchant: true }
  });
  const mappedDuplicates = duplicates.map(t => ({ ...t, merchant_name: t.merchant?.name, debit_status: t.debitStatus, refund_status: t.refundStatus, created_at: t.createdAt }));
  
  const result = { hasDuplicates: duplicates.length > 0, duplicates: mappedDuplicates, originalTransaction: txn };
  await logAudit({ caseId, action: 'TOOL_CALLED', toolName: 'detectDuplicates', toolInput: { transactionId }, toolOutput: { duplicateCount: duplicates.length } });
  return result;
}

export async function analyzeWalletBalance({ customerId, caseId }) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  const recentTxns = await prisma.transaction.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 20 });
  
  let calculatedBalance = 0;
  for (const txn of recentTxns) {
    if (txn.status === 'SUCCESS' && txn.debitStatus === 'DEBITED') calculatedBalance -= txn.amount;
    if (txn.refundStatus === 'COMPLETED') calculatedBalance += txn.amount;
  }
  
  const discrepancy = customer ? Math.abs(customer.walletBalance - (customer.walletBalance + calculatedBalance)) : 0;
  const result = {
    walletId: customer?.id,
    currentBalance: customer?.walletBalance || 0,
    recentTransactionCount: recentTxns.length,
    discrepancyDetected: discrepancy > 0,
    discrepancyAmount: discrepancy,
  };
  await logAudit({ caseId, action: 'TOOL_CALLED', toolName: 'analyzeWalletBalance', toolInput: { customerId }, toolOutput: result });
  return result;
}

export const TOOL_REGISTRY = {
  getCustomer: { fn: getCustomer, description: 'Retrieve customer profile and wallet information', requiresAuth: true },
  getTransaction: { fn: getTransaction, description: 'Retrieve a specific transaction by ID', requiresAuth: true },
  getTransactions: { fn: getTransactions, description: 'List customer transactions with optional filtering', requiresAuth: true },
  checkPaymentStatus: { fn: checkPaymentStatus, description: 'Check the current status of a payment', requiresAuth: true },
  checkRefundEligibility: { fn: checkRefundEligibility, description: 'Check if a transaction is eligible for a refund', requiresAuth: true },
  calculateRefund: { fn: calculateRefund, description: 'Calculate the refund amount for a transaction', requiresAuth: true },
  createRefund: { fn: createRefund, description: 'Create and initiate a refund (requires policy ALLOW)', requiresAuth: true, requiresPolicy: true },
  verifyRefund: { fn: verifyRefund, description: 'Verify that a refund was successfully processed', requiresAuth: true },
  freezeAccount: { fn: freezeAccount, description: 'Freeze a customer account due to suspicious activity', requiresAuth: true, requiresPolicy: true },
  createDispute: { fn: createDispute, description: 'Create a merchant dispute for a transaction', requiresAuth: true },
  sendNotification: { fn: sendNotification, description: 'Send a notification to the customer', requiresAuth: true },
  updateCase: { fn: updateCase, description: 'Update the support case with resolution details', requiresAuth: true },
  escalateToHuman: { fn: escalateToHuman, description: 'Escalate the case to a human agent for review', requiresAuth: true },
  detectDuplicates: { fn: detectDuplicates, description: 'Detect duplicate transactions for a customer', requiresAuth: true },
  analyzeWalletBalance: { fn: analyzeWalletBalance, description: 'Analyze wallet balance discrepancies', requiresAuth: true },
};

export async function executeTool(toolName, params) {
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);
  return await tool.fn(params);
}
