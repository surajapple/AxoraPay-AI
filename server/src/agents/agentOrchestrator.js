/**
 * Agent Orchestrator
 * Implements: UNDERSTAND → PLAN → RETRIEVE → ANALYZE → POLICY CHECK → ACT → VERIFY → UPDATE → RESPOND
 *
 * The LLM REASONS. The Policy Engine AUTHORIZES. The Tools ACT.
 */

import { createAIProvider } from '../services/ai/aiProvider.js';
import { executeTool, logAudit, updateCase } from '../tools/toolRegistry.js';
import {
  evaluateRefundPolicy,
  evaluateSuspiciousPolicy,
  evaluateDuplicatePolicy,
  evaluateMerchantDisputePolicy,
  evaluateFreezePolicy,
  POLICY_DECISIONS,
} from '../policies/policyEngine.js';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection.js';

const ai = createAIProvider();

// Step status types
export const STEP_STATUS = {
  THINKING: 'THINKING',
  TOOL_CALL: 'TOOL_CALL',
  POLICY_CHECK: 'POLICY_CHECK',
  EXECUTING: 'EXECUTING',
  VERIFYING: 'VERIFYING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
};

function createStep(type, title, description, data = {}) {
  return {
    id: uuidv4(),
    type,
    title,
    description,
    data,
    timestamp: new Date().toISOString(),
    status: type,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main agent orchestration loop
 * Returns a stream of steps for real-time UI updates
 */
export async function runAgent({ caseId, customerId, customerMessage, transactionId, issueType: providedIssueType, onStep }) {
  const steps = [];
  const emit = async (step) => {
    steps.push(step);
    if (onStep) await onStep(step);
    await sleep(300); // Small delay for realistic streaming effect
  };

  try {
    // ── Step 1: Understand the Issue ─────────────────────────────────────────
    await emit(createStep(STEP_STATUS.THINKING, 'Understanding the issue', `Analyzing customer message: "${customerMessage.slice(0, 80)}..."`, { message: customerMessage }));

    const customer = await executeTool('getCustomer', { customerId, caseId });

    const issueAnalysis = await ai.analyzeIssue(customerMessage, {
      customerId,
      customerName: customer.name,
      transactionId,
      accountStatus: customer.account_status,
      riskScore: customer.risk_score,
    });

    const issueType = providedIssueType || issueAnalysis.issueType;

    await emit(createStep(STEP_STATUS.THINKING, 'Issue classified', `Issue Type: ${issueType} | Confidence: ${(issueAnalysis.confidence * 100).toFixed(0)}% | Urgency: ${issueAnalysis.urgency}`, {
      issueType, confidence: issueAnalysis.confidence, urgency: issueAnalysis.urgency, summary: issueAnalysis.summary,
    }));

    // Update case with initial analysis
    await updateCase({ caseId, aiConfidence: issueAnalysis.confidence, agentSteps: steps });

    // ── Route to issue-specific handler ─────────────────────────────────────
    let result;
    switch (issueType) {
      case 'PAYMENT_FAILED_DEBITED':
        result = await handlePaymentFailedDebited({ caseId, customerId, transactionId, customer, emit, steps });
        break;
      case 'DUPLICATE_PAYMENT':
        result = await handleDuplicatePayment({ caseId, customerId, transactionId, customer, emit, steps });
        break;
      case 'UPI_FAILED':
        result = await handleUPIFailed({ caseId, customerId, transactionId, customer, emit, steps });
        break;
      case 'WALLET_BALANCE_ISSUE':
        result = await handleWalletIssue({ caseId, customerId, customer, emit, steps });
        break;
      case 'SUSPICIOUS_TRANSACTION':
        result = await handleSuspiciousTransaction({ caseId, customerId, transactionId, customer, emit, steps });
        break;
      case 'MERCHANT_DISPUTE':
        result = await handleMerchantDispute({ caseId, customerId, transactionId, customer, customerMessage, emit, steps });
        break;
      default:
        result = await handleGeneral({ caseId, customerId, transactionId, customer, customerMessage, emit, steps });
    }

    // ── Generate Customer Response ───────────────────────────────────────────
    await emit(createStep(STEP_STATUS.THINKING, 'Generating customer response', 'Composing a clear, empathetic response for the customer...'));

    const customerResponse = await ai.generateCustomerResponse({
      issueType,
      caseId,
      transaction: result.transaction,
      refund: result.refund,
      policyDecision: result.policyResult?.decision,
      resolution: result.resolution,
      transactionCount: result.transactionCount,
      discrepancy: result.discrepancy,
    });

    const explanation = await ai.generateExplanation({
      issueType,
      transaction: result.transaction,
      policyResult: result.policyResult,
      refund: result.refund,
      caseId,
    });

    // ── Final Case Update ───────────────────────────────────────────────────
    await updateCase({
      caseId,
      status: result.status || 'RESOLVED',
      resolution: result.resolution,
      aiExplanation: JSON.stringify(explanation),
      policyDecision: result.policyResult?.decision,
      agentSteps: steps,
      refundAmount: result.refund?.amount,
    });

    await emit(createStep(STEP_STATUS.COMPLETED, 'Case resolved', `Resolution: ${result.resolution}`, {
      resolution: result.resolution,
      customerResponse,
      explanation,
    }));

    logAudit({ caseId, action: 'AGENT_COMPLETED', details: { issueType, resolution: result.resolution, stepsCount: steps.length } });

    return {
      success: true,
      issueType,
      issueAnalysis,
      steps,
      customerResponse,
      explanation,
      resolution: result.resolution,
      status: result.status || 'RESOLVED',
      policyResult: result.policyResult,
      refund: result.refund,
      transaction: result.transaction,
      escalation: result.escalation,
    };

  } catch (error) {
    console.error('Agent error:', error);
    await emit(createStep(STEP_STATUS.FAILED, 'Agent encountered an error', error.message, { error: error.message }));
    await updateCase({ caseId, status: 'INVESTIGATING', agentSteps: steps });
    logAudit({ caseId, action: 'AGENT_ERROR', details: { error: error.message }, status: 'FAILED' });
    return { success: false, error: error.message, steps };
  }
}

// ── HANDLER: Payment Failed + Debited ────────────────────────────────────────
async function handlePaymentFailedDebited({ caseId, customerId, transactionId, customer, emit, steps }) {
  // Step: Get transaction
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Retrieving transaction', `Tool: getTransaction(${transactionId})`, { tool: 'getTransaction', input: { transactionId } }));
  const transaction = await executeTool('getTransaction', { transactionId, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Transaction found', `${transaction.id} — ₹${transaction.amount.toLocaleString('en-IN')} via ${transaction.payment_method} to ${transaction.merchant_name}`, {
    tool: 'getTransaction', output: transaction,
  }));

  // Step: Check payment status
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Checking payment status', `Tool: checkPaymentStatus(${transactionId})`, { tool: 'checkPaymentStatus' }));
  const paymentStatus = await executeTool('checkPaymentStatus', { transactionId, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Payment status verified', `Status: ${paymentStatus.status} | Debit: ${paymentStatus.debitStatus} | Refund: ${paymentStatus.refundStatus}`, {
    tool: 'checkPaymentStatus', output: paymentStatus,
  }));

  // Step: Check refund eligibility
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Checking refund eligibility', `Tool: checkRefundEligibility(${transactionId})`, { tool: 'checkRefundEligibility' }));
  const eligibility = await executeTool('checkRefundEligibility', { transactionId, customerId, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Refund eligibility determined', `Eligible: ${eligibility.eligible} | Days since transaction: ${eligibility.daysSinceTransaction} | Amount: ₹${eligibility.amount.toLocaleString('en-IN')}`, {
    tool: 'checkRefundEligibility', output: eligibility,
  }));

  // Step: Calculate refund
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Calculating refund amount', `Tool: calculateRefund(${transactionId})`, { tool: 'calculateRefund' }));
  const refundCalc = await executeTool('calculateRefund', { transactionId, caseId });

  // Step: Policy evaluation
  await emit(createStep(STEP_STATUS.POLICY_CHECK, 'Evaluating refund policy', 'Running deterministic policy engine to authorize or deny action...', { policyCheck: true }));
  const policyResult = evaluateRefundPolicy({
    transaction,
    customer,
    refundAlreadyIssued: !!eligibility.existingRefund,
    refundAttempts: eligibility.monthlyRefundCount,
    suspiciousActivity: customer.risk_score >= 50,
  });

  await emit(createStep(STEP_STATUS.POLICY_CHECK, `Policy decision: ${policyResult.decision}`, policyResult.reason, {
    policyResult, checks: policyResult.checks,
  }));

  // Handle policy decision
  if (policyResult.decision === POLICY_DECISIONS.ALLOW) {
    // Execute refund
    await emit(createStep(STEP_STATUS.EXECUTING, 'Initiating refund', `Tool: createRefund(₹${transaction.amount.toLocaleString('en-IN')})`, { tool: 'createRefund', amount: transaction.amount }));
    const refund = await executeTool('createRefund', {
      transactionId,
      customerId,
      amount: transaction.amount,
      reason: 'Payment failed after debit — automatic refund policy',
      policyDecision: policyResult.decision,
      caseId,
    });

    await emit(createStep(STEP_STATUS.EXECUTING, 'Refund initiated', `Refund ID: ${refund.refundId} | Status: ${refund.status}`, { refund }));

    // Verify refund
    await emit(createStep(STEP_STATUS.VERIFYING, 'Verifying refund', `Tool: verifyRefund(${refund.refundId})`, { tool: 'verifyRefund', refundId: refund.refundId }));
    const verification = await executeTool('verifyRefund', { refundId: refund.refundId, caseId });

    await emit(createStep(STEP_STATUS.VERIFYING, 'Refund verified', `Refund status: ${verification.status} ✓`, { verification }));

    // Send notification
    await executeTool('sendNotification', {
      customerId,
      caseId,
      message: `Your refund of ₹${transaction.amount.toLocaleString('en-IN')} for transaction ${transactionId} has been processed. Reference: ${refund.refundId}`,
    });

    await emit(createStep(STEP_STATUS.COMPLETED, 'Customer notified', `Notification sent via app for ₹${transaction.amount.toLocaleString('en-IN')} refund`, { notified: true }));

    return {
      status: 'RESOLVED',
      resolution: `Refund of ₹${transaction.amount.toLocaleString('en-IN')} initiated and verified. Refund ID: ${refund.refundId}`,
      transaction, refund: { ...refund, amount: transaction.amount }, policyResult,
    };
  }

  if (policyResult.decision === POLICY_DECISIONS.HUMAN_REVIEW) {
    await emit(createStep(STEP_STATUS.HUMAN_REVIEW, 'Escalating to human review', policyResult.reason, { policyResult }));
    const escalation = await executeTool('escalateToHuman', {
      caseId,
      customerId,
      reason: policyResult.reason,
      priority: policyResult.riskLevel === 'HIGH' ? 'CRITICAL' : 'HIGH',
    });

    return {
      status: 'ESCALATED',
      resolution: `Case escalated for human review. Reason: ${policyResult.reason}`,
      transaction, policyResult, escalation,
    };
  }

  // DENY
  return {
    status: 'RESOLVED',
    resolution: `Refund denied: ${policyResult.reason}`,
    transaction, policyResult,
  };
}

// ── HANDLER: Duplicate Payment ─────────────────────────────────────────────
async function handleDuplicatePayment({ caseId, customerId, transactionId, customer, emit, steps }) {
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Retrieving transaction', `Tool: getTransaction(${transactionId})`, { tool: 'getTransaction' }));
  const transaction = await executeTool('getTransaction', { transactionId, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Scanning for duplicates', `Tool: detectDuplicates(${transactionId})`, { tool: 'detectDuplicates' }));
  const dupResult = await executeTool('detectDuplicates', { customerId, transactionId, caseId });

  if (!dupResult.hasDuplicates) {
    await emit(createStep(STEP_STATUS.COMPLETED, 'No duplicates found', 'No duplicate transactions detected for this order.', { hasDuplicates: false }));
    return {
      status: 'RESOLVED',
      resolution: 'No duplicate transactions found for this order.',
      transaction, policyResult: { decision: POLICY_DECISIONS.DENY, reason: 'No duplicate detected' },
    };
  }

  const duplicate = dupResult.duplicates[0];
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Duplicate confirmed', `Found duplicate: ${duplicate.id} — Same merchant, amount ₹${duplicate.amount.toLocaleString('en-IN')}, Order: ${duplicate.order_id}`, { duplicate }));

  // Policy check
  await emit(createStep(STEP_STATUS.POLICY_CHECK, 'Evaluating duplicate payment policy', 'Checking if duplicate refund is authorized...'));
  const policyResult = evaluateDuplicatePolicy({
    duplicateTransaction: duplicate,
    originalTransaction: transaction,
    customer,
  });

  await emit(createStep(STEP_STATUS.POLICY_CHECK, `Policy: ${policyResult.decision}`, policyResult.reason, { policyResult }));

  if (policyResult.decision === POLICY_DECISIONS.ALLOW) {
    await emit(createStep(STEP_STATUS.EXECUTING, 'Refunding duplicate charge', `Tool: createRefund(₹${duplicate.amount.toLocaleString('en-IN')})`, { tool: 'createRefund' }));
    const refund = await executeTool('createRefund', {
      transactionId: duplicate.id,
      customerId,
      amount: duplicate.amount,
      reason: 'Duplicate payment refund — same order charged twice',
      policyDecision: policyResult.decision,
      caseId,
    });

    await emit(createStep(STEP_STATUS.VERIFYING, 'Verifying duplicate refund', `Tool: verifyRefund(${refund.refundId})`));
    const verification = await executeTool('verifyRefund', { refundId: refund.refundId, caseId });

    await emit(createStep(STEP_STATUS.VERIFYING, 'Duplicate refund verified', `Status: ${verification.status} ✓`, { verification }));
    await executeTool('sendNotification', { customerId, caseId, message: `Duplicate charge refund of ₹${duplicate.amount.toLocaleString('en-IN')} processed. Ref: ${refund.refundId}` });

    return {
      status: 'RESOLVED',
      resolution: `Duplicate payment refunded. ₹${duplicate.amount.toLocaleString('en-IN')} will be returned in 3-5 business days.`,
      transaction, refund: { ...refund, amount: duplicate.amount }, policyResult,
    };
  }

  if (policyResult.decision === POLICY_DECISIONS.HUMAN_REVIEW) {
    const escalation = await executeTool('escalateToHuman', { caseId, customerId, reason: policyResult.reason, priority: 'HIGH' });
    return { status: 'ESCALATED', resolution: policyResult.reason, transaction, policyResult, escalation };
  }

  return { status: 'RESOLVED', resolution: policyResult.reason, transaction, policyResult };
}

// ── HANDLER: UPI Failed ──────────────────────────────────────────────────────
async function handleUPIFailed({ caseId, customerId, transactionId, customer, emit, steps }) {
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Retrieving transaction', `Tool: getTransaction(${transactionId})`));
  const transaction = await executeTool('getTransaction', { transactionId, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Checking payment status', `Tool: checkPaymentStatus(${transactionId})`));
  const status = await executeTool('checkPaymentStatus', { transactionId, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Status verified', `UPI Status: ${status.status} | Debit: ${status.debitStatus}`, { status }));

  if (status.debitStatus === 'DEBITED') {
    // Treat as payment_failed_debited
    return await handlePaymentFailedDebited({ caseId, customerId, transactionId, customer, emit, steps });
  }

  // No debit — just explain
  await emit(createStep(STEP_STATUS.POLICY_CHECK, 'Policy evaluation', 'No debit occurred — no financial action required.'));
  const policyResult = { decision: POLICY_DECISIONS.DENY, reason: 'Amount was not debited — no refund required.' };

  await emit(createStep(STEP_STATUS.COMPLETED, 'UPI failure explained', `Payment failed with reason: ${status.failureReason || 'Technical error'}. No amount was debited.`));

  return {
    status: 'RESOLVED',
    resolution: `UPI payment failed — ${status.failureReason || 'Technical error'}. No amount was debited from your account.`,
    transaction, policyResult,
  };
}

// ── HANDLER: Wallet Balance Issue ─────────────────────────────────────────────
async function handleWalletIssue({ caseId, customerId, customer, emit, steps }) {
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Analyzing wallet balance', 'Tool: analyzeWalletBalance'));
  const walletAnalysis = await executeTool('analyzeWalletBalance', { customerId, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Retrieving transaction history', 'Tool: getTransactions'));
  const transactions = await executeTool('getTransactions', { customerId, limit: 20, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Analysis complete', `Current balance: ₹${walletAnalysis.currentBalance?.toLocaleString('en-IN')} | Transactions analyzed: ${walletAnalysis.recentTransactionCount}`, { walletAnalysis }));

  const policyResult = { decision: POLICY_DECISIONS.HUMAN_REVIEW, reason: 'Wallet discrepancies require manual financial reconciliation.' };
  await emit(createStep(STEP_STATUS.POLICY_CHECK, 'Policy: HUMAN_REVIEW', 'Wallet reconciliation requires human review for accuracy.'));

  const escalation = await executeTool('escalateToHuman', { caseId, customerId, reason: 'Wallet balance discrepancy — reconciliation required', priority: 'MEDIUM' });

  return {
    status: 'ESCALATED',
    resolution: 'Wallet balance investigation initiated. Finance team will reconcile within 24-48 hours.',
    policyResult,
    transactionCount: transactions.length,
    discrepancy: walletAnalysis.discrepancyAmount,
    escalation,
  };
}

// ── HANDLER: Suspicious Transaction ──────────────────────────────────────────
async function handleSuspiciousTransaction({ caseId, customerId, transactionId, customer, emit, steps }) {
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Retrieving flagged transaction', `Tool: getTransaction(${transactionId})`));
  const transaction = await executeTool('getTransaction', { transactionId, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Transaction retrieved', `Amount: ₹${transaction.amount.toLocaleString('en-IN')} | Merchant: ${transaction.merchant_name} | Status: ${transaction.status}`, { transaction }));

  // Risk signals
  const riskSignals = [];
  if (transaction.merchant_category === 'Suspicious') riskSignals.push('Unknown merchant category');
  if (transaction.amount > 2000) riskSignals.push('High amount for unknown merchant');
  if (customer.risk_score > 0) riskSignals.push('Customer risk score elevated');

  await emit(createStep(STEP_STATUS.POLICY_CHECK, 'Evaluating fraud policy', `Risk signals detected: ${riskSignals.length}`, { riskSignals }));
  const policyResult = evaluateSuspiciousPolicy({ transaction, customer, riskSignals });
  await emit(createStep(STEP_STATUS.POLICY_CHECK, 'Policy: HUMAN_REVIEW (Suspicious)', policyResult.reason, { policyResult }));

  // Check if we should freeze account
  const freezePolicy = evaluateFreezePolicy({ customer, suspicious: true });
  if (freezePolicy.decision === POLICY_DECISIONS.ALLOW) {
    await emit(createStep(STEP_STATUS.EXECUTING, 'Securing account', 'Tool: freezeAccount — Freezing account as security precaution...'));
    await executeTool('freezeAccount', { customerId, reason: 'Suspicious transaction detected — automatic security freeze', caseId });
    await emit(createStep(STEP_STATUS.EXECUTING, 'Account secured', 'Customer account temporarily frozen for security review.', { frozen: true }));
  }

  // Escalate
  await emit(createStep(STEP_STATUS.HUMAN_REVIEW, 'Escalating to security team', 'Critical escalation — security team notified'));
  const escalation = await executeTool('escalateToHuman', { caseId, customerId, reason: `Suspicious transaction detected. Risk signals: ${riskSignals.join(', ')}. Mandatory security review.`, priority: 'CRITICAL' });

  await executeTool('sendNotification', { customerId, caseId, message: 'SECURITY ALERT: A suspicious transaction has been flagged on your account. Account secured. Our security team will contact you.' });

  return {
    status: 'ESCALATED',
    resolution: 'Suspicious transaction flagged. Account secured. Escalated to security team for investigation.',
    transaction, policyResult, escalation, riskSignals,
  };
}

// ── HANDLER: Merchant Dispute ────────────────────────────────────────────────
async function handleMerchantDispute({ caseId, customerId, transactionId, customer, customerMessage, emit, steps }) {
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Retrieving transaction', `Tool: getTransaction(${transactionId})`));
  const transaction = await executeTool('getTransaction', { transactionId, caseId });

  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Transaction retrieved', `₹${transaction.amount.toLocaleString('en-IN')} paid to ${transaction.merchant_name}`, { transaction }));

  await emit(createStep(STEP_STATUS.POLICY_CHECK, 'Evaluating dispute policy', 'Merchant disputes require evidence verification...'));
  const policyResult = evaluateMerchantDisputePolicy({ transaction, customer });
  await emit(createStep(STEP_STATUS.POLICY_CHECK, `Policy: ${policyResult.decision}`, policyResult.reason, { policyResult }));

  await emit(createStep(STEP_STATUS.EXECUTING, 'Creating dispute case', 'Tool: createDispute'));
  const dispute = await executeTool('createDispute', {
    transactionId,
    customerId,
    type: 'NON_DELIVERY',
    description: customerMessage,
    caseId,
  });

  await emit(createStep(STEP_STATUS.EXECUTING, 'Dispute created', `Dispute ID: ${dispute.disputeId} | Status: ${dispute.status}`, { dispute }));

  const escalation = await executeTool('escalateToHuman', {
    caseId, customerId,
    reason: `Merchant dispute for ₹${transaction.amount.toLocaleString('en-IN')} — product not delivered. Dispute ID: ${dispute.disputeId}`,
    priority: 'HIGH',
  });

  return {
    status: 'ESCALATED',
    resolution: `Dispute created (${dispute.disputeId}). Merchant resolution team will contact both parties within 7-10 business days.`,
    transaction, policyResult, dispute, escalation,
  };
}

// ── HANDLER: General ─────────────────────────────────────────────────────────
async function handleGeneral({ caseId, customerId, transactionId, customer, customerMessage, emit, steps }) {
  await emit(createStep(STEP_STATUS.TOOL_CALL, 'Retrieving account info', 'Tool: getCustomer'));
  const transactions = await executeTool('getTransactions', { customerId, limit: 5, caseId });

  await emit(createStep(STEP_STATUS.COMPLETED, 'Account reviewed', `${transactions.length} recent transactions reviewed. Case logged for follow-up.`));

  return {
    status: 'RESOLVED',
    resolution: 'Customer inquiry logged. Account reviewed. Follow-up scheduled if required.',
    policyResult: { decision: 'DENY', reason: 'No actionable issue found' },
  };
}
