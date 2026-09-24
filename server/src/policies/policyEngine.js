/**
 * Policy Engine — Deterministic Rule Engine
 * The LLM can PROPOSE actions. This engine AUTHORIZES them.
 * 
 * Outputs: ALLOW | DENY | HUMAN_REVIEW
 */

export const POLICY_DECISIONS = {
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  HUMAN_REVIEW: 'HUMAN_REVIEW',
};

// Policy configuration (can be toggled via admin)
let policyConfig = {
  AUTO_REFUND_LIMIT: 5000,          // ₹5,000 max for auto-refund
  SUSPICIOUS_RISK_THRESHOLD: 50,    // Risk score threshold
  REFUND_WINDOW_DAYS: 30,           // Refund eligibility window (days)
  MAX_REFUNDS_PER_CUSTOMER: 3,      // Per month
  FREEZE_ON_SUSPICIOUS: true,       // Auto-freeze suspicious accounts
  REQUIRE_KYC_FOR_REFUND: false,    // KYC requirement for refund
};

export function getPolicyConfig() {
  return { ...policyConfig };
}

export function updatePolicyConfig(updates) {
  policyConfig = { ...policyConfig, ...updates };
  return policyConfig;
}

/**
 * Evaluate refund policy
 */
export function evaluateRefundPolicy(context) {
  const {
    transaction,
    customer,
    refundAlreadyIssued,
    refundAttempts = 0,
    suspiciousActivity = false,
  } = context;

  const reasons = [];
  const checks = [];

  // Check 1: Transaction must have FAILED status
  const txnFailed = transaction.status === 'FAILED';
  checks.push({ rule: 'Transaction status is FAILED', passed: txnFailed });
  if (!txnFailed) {
    return {
      decision: POLICY_DECISIONS.DENY,
      reason: 'Transaction did not fail — refund not applicable.',
      checks,
      riskLevel: 'LOW',
    };
  }

  // Check 2: Amount must have been debited
  const amountDebited = transaction.debit_status === 'DEBITED';
  checks.push({ rule: 'Amount was debited from customer account', passed: amountDebited });
  if (!amountDebited) {
    return {
      decision: POLICY_DECISIONS.DENY,
      reason: 'Amount was never debited — no refund needed.',
      checks,
      riskLevel: 'LOW',
    };
  }

  // Check 3: No duplicate refund
  const noDuplicate = !refundAlreadyIssued;
  checks.push({ rule: 'No prior refund issued for this transaction', passed: noDuplicate });
  if (!noDuplicate) {
    return {
      decision: POLICY_DECISIONS.DENY,
      reason: 'Refund has already been issued for this transaction.',
      checks,
      riskLevel: 'LOW',
    };
  }

  // Check 4: Within refund window
  const txnDate = new Date(transaction.created_at);
  const daysSinceTxn = (Date.now() - txnDate.getTime()) / (1000 * 60 * 60 * 24);
  const withinWindow = daysSinceTxn <= policyConfig.REFUND_WINDOW_DAYS;
  checks.push({ rule: `Transaction within ${policyConfig.REFUND_WINDOW_DAYS}-day refund window`, passed: withinWindow });
  if (!withinWindow) {
    return {
      decision: POLICY_DECISIONS.DENY,
      reason: `Transaction is older than ${policyConfig.REFUND_WINDOW_DAYS} days — outside refund window.`,
      checks,
      riskLevel: 'LOW',
    };
  }

  // Check 5: Suspicious activity
  const isSuspicious = suspiciousActivity || (customer && customer.risk_score >= policyConfig.SUSPICIOUS_RISK_THRESHOLD);
  checks.push({ rule: 'No suspicious activity detected', passed: !isSuspicious });
  if (isSuspicious) {
    return {
      decision: POLICY_DECISIONS.HUMAN_REVIEW,
      reason: 'Suspicious activity detected. Manual review required before any financial action.',
      checks,
      riskLevel: 'HIGH',
    };
  }

  // Check 6: High-value transaction
  const belowAutoLimit = transaction.amount <= policyConfig.AUTO_REFUND_LIMIT;
  checks.push({ rule: `Amount ≤ ₹${policyConfig.AUTO_REFUND_LIMIT.toLocaleString('en-IN')} (auto-refund limit)`, passed: belowAutoLimit });
  if (!belowAutoLimit) {
    return {
      decision: POLICY_DECISIONS.HUMAN_REVIEW,
      reason: `Transaction amount ₹${transaction.amount.toLocaleString('en-IN')} exceeds automatic refund limit of ₹${policyConfig.AUTO_REFUND_LIMIT.toLocaleString('en-IN')}. Manager approval required.`,
      checks,
      riskLevel: 'MEDIUM',
    };
  }

  // Check 7: Multiple refund attempts
  const tooManyAttempts = refundAttempts >= policyConfig.MAX_REFUNDS_PER_CUSTOMER;
  checks.push({ rule: `Refund attempts within limit (${refundAttempts}/${policyConfig.MAX_REFUNDS_PER_CUSTOMER} monthly)`, passed: !tooManyAttempts });
  if (tooManyAttempts) {
    return {
      decision: POLICY_DECISIONS.HUMAN_REVIEW,
      reason: 'Customer has reached maximum refund threshold for this month. Manual review required.',
      checks,
      riskLevel: 'MEDIUM',
    };
  }

  // Check 8: KYC requirement
  if (policyConfig.REQUIRE_KYC_FOR_REFUND && customer && customer.kyc_status !== 'VERIFIED') {
    checks.push({ rule: 'KYC verification completed', passed: false });
    return {
      decision: POLICY_DECISIONS.HUMAN_REVIEW,
      reason: 'Customer KYC not verified. Refund requires manual approval.',
      checks,
      riskLevel: 'MEDIUM',
    };
  }
  checks.push({ rule: 'Customer identity verified', passed: true });

  // All checks passed → ALLOW
  return {
    decision: POLICY_DECISIONS.ALLOW,
    reason: `All policy checks passed. Automatic refund of ₹${transaction.amount.toLocaleString('en-IN')} authorized.`,
    checks,
    riskLevel: 'LOW',
    authorizedAmount: transaction.amount,
  };
}

/**
 * Evaluate suspicious transaction policy
 */
export function evaluateSuspiciousPolicy(context) {
  const { transaction, customer, riskSignals = [] } = context;
  const checks = [];

  const highRisk = customer && customer.risk_score >= policyConfig.SUSPICIOUS_RISK_THRESHOLD;
  checks.push({ rule: 'Customer risk score within acceptable range', passed: !highRisk });

  const hasSuspiciousSignals = riskSignals.length > 0;
  checks.push({ rule: 'No suspicious transaction signals', passed: !hasSuspiciousSignals });

  return {
    decision: POLICY_DECISIONS.HUMAN_REVIEW,
    reason: 'Suspicious transaction requires mandatory human review. No automatic financial action allowed.',
    checks,
    riskLevel: 'CRITICAL',
    shouldFreezeAccount: policyConfig.FREEZE_ON_SUSPICIOUS,
  };
}

/**
 * Evaluate duplicate payment policy
 */
export function evaluateDuplicatePolicy(context) {
  const { duplicateTransaction, originalTransaction, customer } = context;
  const checks = [];

  // Same merchant, same amount, same order ID
  const sameDetails =
    duplicateTransaction.merchant_id === originalTransaction.merchant_id &&
    duplicateTransaction.amount === originalTransaction.amount &&
    duplicateTransaction.order_id === originalTransaction.order_id;
  checks.push({ rule: 'Duplicate transaction confirmed (same merchant, amount, order)', passed: sameDetails });

  if (!sameDetails) {
    return {
      decision: POLICY_DECISIONS.DENY,
      reason: 'Transactions do not match duplicate criteria.',
      checks,
      riskLevel: 'LOW',
    };
  }

  const belowLimit = duplicateTransaction.amount <= policyConfig.AUTO_REFUND_LIMIT;
  checks.push({ rule: `Duplicate amount ≤ ₹${policyConfig.AUTO_REFUND_LIMIT.toLocaleString('en-IN')}`, passed: belowLimit });

  if (!belowLimit) {
    return {
      decision: POLICY_DECISIONS.HUMAN_REVIEW,
      reason: 'High-value duplicate requires manual verification.',
      checks,
      riskLevel: 'MEDIUM',
    };
  }

  return {
    decision: POLICY_DECISIONS.ALLOW,
    reason: `Duplicate payment confirmed. Refund of ₹${duplicateTransaction.amount.toLocaleString('en-IN')} authorized for duplicate transaction.`,
    checks,
    riskLevel: 'LOW',
    authorizedAmount: duplicateTransaction.amount,
  };
}

/**
 * Evaluate merchant dispute policy
 */
export function evaluateMerchantDisputePolicy(context) {
  const { transaction, customer } = context;
  const checks = [];

  const txnDate = new Date(transaction.created_at);
  const daysSinceTxn = (Date.now() - txnDate.getTime()) / (1000 * 60 * 60 * 24);
  const withinWindow = daysSinceTxn <= 30;
  checks.push({ rule: 'Dispute filed within 30 days', passed: withinWindow });

  // Merchant disputes always require human review
  return {
    decision: POLICY_DECISIONS.HUMAN_REVIEW,
    reason: 'Merchant disputes require evidence verification and merchant communication. Escalated for human review.',
    checks,
    riskLevel: 'MEDIUM',
  };
}

/**
 * Evaluate account freeze policy
 */
export function evaluateFreezePolicy(context) {
  const { customer, suspicious } = context;
  const checks = [];

  checks.push({ rule: 'Suspicious activity confirmed', passed: suspicious });
  checks.push({ rule: 'Auto-freeze policy enabled', passed: policyConfig.FREEZE_ON_SUSPICIOUS });

  if (suspicious && policyConfig.FREEZE_ON_SUSPICIOUS) {
    return {
      decision: POLICY_DECISIONS.ALLOW,
      reason: 'Suspicious activity confirmed. Account freeze authorized per security policy.',
      checks,
      riskLevel: 'HIGH',
    };
  }

  return {
    decision: POLICY_DECISIONS.DENY,
    reason: 'Freeze conditions not met.',
    checks,
    riskLevel: 'LOW',
  };
}

export const POLICIES = [
  {
    id: 'POL001',
    name: 'Auto Refund Policy',
    description: 'Automatically refund failed transactions where amount was debited',
    conditions: [
      'transaction.status === FAILED',
      'transaction.debit_status === DEBITED',
      'refund not already issued',
      'amount ≤ ₹5,000',
      'within 30-day window',
      'no suspicious activity',
    ],
    action: 'AUTO_REFUND',
    enabled: true,
  },
  {
    id: 'POL002',
    name: 'High Value Escalation Policy',
    description: 'Escalate refund requests above ₹5,000 for manual approval',
    conditions: ['transaction.amount > ₹5,000'],
    action: 'HUMAN_REVIEW',
    enabled: true,
  },
  {
    id: 'POL003',
    name: 'Suspicious Activity Policy',
    description: 'Flag and escalate suspicious transactions for security review',
    conditions: ['customer.risk_score >= 50', 'OR suspicious signals detected'],
    action: 'HUMAN_REVIEW + FREEZE_ACCOUNT',
    enabled: true,
  },
  {
    id: 'POL004',
    name: 'Duplicate Payment Policy',
    description: 'Automatically refund confirmed duplicate payments',
    conditions: ['same merchant', 'same order ID', 'same amount', 'within 24 hours'],
    action: 'AUTO_REFUND_DUPLICATE',
    enabled: true,
  },
  {
    id: 'POL005',
    name: 'Merchant Dispute Policy',
    description: 'Route all merchant disputes to human review with evidence collection',
    conditions: ['issue_type === MERCHANT_DISPUTE'],
    action: 'HUMAN_REVIEW',
    enabled: true,
  },
  {
    id: 'POL006',
    name: 'Multiple Refund Limit Policy',
    description: 'Limit automatic refunds to 3 per customer per month',
    conditions: ['refund_count >= 3 per month'],
    action: 'HUMAN_REVIEW',
    enabled: true,
  },
];
