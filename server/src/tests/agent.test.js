/**
 * AxoraPay Integration Tests
 * Tests all major agent workflows without external API dependencies
 */

import { getDb } from '../database/connection.js';
import { CREATE_TABLES_SQL } from '../database/schema.js';
import {
  evaluateRefundPolicy,
  evaluateSuspiciousPolicy,
  evaluateDuplicatePolicy,
  evaluateMerchantDisputePolicy,
  POLICY_DECISIONS,
} from '../policies/policyEngine.js';

// Simple test runner
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Expected equality'}: expected "${expected}", got "${actual}"`);
  }
}

// ── Test Setup ────────────────────────────────────────────────────────────────
function setupTestDb() {
  const db = getDb();
  db.exec(CREATE_TABLES_SQL);
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM notifications;
    DELETE FROM escalations;
    DELETE FROM disputes;
    DELETE FROM refunds;
    DELETE FROM support_cases;
    DELETE FROM transactions;
    DELETE FROM wallets;
    DELETE FROM merchants;
    DELETE FROM customers;
  `);
  // Insert minimal test data
  db.exec(`
    INSERT OR REPLACE INTO customers (id, name, email, phone, kyc_status, account_status, risk_score)
    VALUES 
      ('TEST_CUST1', 'Test User 1', 'test1@test.com', '+91-9999999991', 'VERIFIED', 'ACTIVE', 0),
      ('TEST_CUST2', 'High Risk User', 'test2@test.com', '+91-9999999992', 'VERIFIED', 'ACTIVE', 75);
  `);
  db.exec(`
    INSERT OR REPLACE INTO merchants (id, name, category) VALUES ('TEST_MERCH', 'Test Merchant', 'E-Commerce');
  `);
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  db.exec(`
    INSERT OR REPLACE INTO transactions (id, customer_id, merchant_id, amount, type, status, debit_status, refund_status, payment_method, order_id, description, metadata, created_at, updated_at)
    VALUES 
      ('TEST_TXN1', 'TEST_CUST1', 'TEST_MERCH', 500, 'PAYMENT', 'FAILED', 'DEBITED', 'NOT_INITIATED', 'UPI', 'TEST-ORD-1', 'Test payment', '{}', '${daysAgo(1)}', datetime('now')),
      ('TEST_TXN2', 'TEST_CUST1', 'TEST_MERCH', 6000, 'PAYMENT', 'FAILED', 'DEBITED', 'NOT_INITIATED', 'UPI', 'TEST-ORD-2', 'High value payment', '{}', '${daysAgo(1)}', datetime('now')),
      ('TEST_TXN3', 'TEST_CUST1', 'TEST_MERCH', 349, 'PAYMENT', 'SUCCESS', 'DEBITED', 'NOT_INITIATED', 'UPI', 'TEST-ORD-DUP', 'Dup payment 1', '{}', '${daysAgo(0)}', datetime('now')),
      ('TEST_TXN4', 'TEST_CUST1', 'TEST_MERCH', 349, 'PAYMENT', 'SUCCESS', 'DEBITED', 'NOT_INITIATED', 'UPI', 'TEST-ORD-DUP', 'Dup payment 2', '{}', '${daysAgo(0)}', datetime('now')),
      ('TEST_TXN5', 'TEST_CUST2', 'TEST_MERCH', 4999, 'PAYMENT', 'SUCCESS', 'DEBITED', 'NOT_INITIATED', 'UPI', 'TEST-ORD-SUSP', 'Suspicious payment', '{}', '${daysAgo(0)}', datetime('now'));
  `);
}

// ── POLICY ENGINE TESTS ───────────────────────────────────────────────────────
console.log('\n📋 Policy Engine Tests');

test('1. Auto refund — ALLOW for eligible transaction', () => {
  const result = evaluateRefundPolicy({
    transaction: { id: 'TEST_TXN1', status: 'FAILED', debit_status: 'DEBITED', amount: 500, created_at: new Date().toISOString() },
    customer: { risk_score: 0, kyc_status: 'VERIFIED' },
    refundAlreadyIssued: false,
    refundAttempts: 0,
    suspiciousActivity: false,
  });
  assertEqual(result.decision, POLICY_DECISIONS.ALLOW, 'Should ALLOW eligible refund');
  assert(result.authorizedAmount === 500, 'Authorized amount should be 500');
  assert(result.checks.every(c => c.passed), 'All checks should pass');
});

test('2. High-value refund — HUMAN_REVIEW for amount > ₹5000', () => {
  const result = evaluateRefundPolicy({
    transaction: { id: 'TEST_TXN2', status: 'FAILED', debit_status: 'DEBITED', amount: 6000, created_at: new Date().toISOString() },
    customer: { risk_score: 0, kyc_status: 'VERIFIED' },
    refundAlreadyIssued: false,
    refundAttempts: 0,
    suspiciousActivity: false,
  });
  assertEqual(result.decision, POLICY_DECISIONS.HUMAN_REVIEW, 'High value should require HUMAN_REVIEW');
  assert(result.riskLevel === 'MEDIUM', 'Risk level should be MEDIUM');
});

test('3. Suspicious activity — HUMAN_REVIEW regardless of amount', () => {
  const result = evaluateRefundPolicy({
    transaction: { id: 'TEST_TXN1', status: 'FAILED', debit_status: 'DEBITED', amount: 100, created_at: new Date().toISOString() },
    customer: { risk_score: 75, kyc_status: 'VERIFIED' },
    refundAlreadyIssued: false,
    refundAttempts: 0,
    suspiciousActivity: false,
  });
  assertEqual(result.decision, POLICY_DECISIONS.HUMAN_REVIEW, 'High risk customer should require review');
});

test('4. Duplicate refund — DENY when refund already exists', () => {
  const result = evaluateRefundPolicy({
    transaction: { id: 'TEST_TXN1', status: 'FAILED', debit_status: 'DEBITED', amount: 500, created_at: new Date().toISOString() },
    customer: { risk_score: 0 },
    refundAlreadyIssued: true,
    refundAttempts: 0,
  });
  assertEqual(result.decision, POLICY_DECISIONS.DENY, 'Should DENY when refund already issued');
});

test('5. No debit — DENY when amount not debited', () => {
  const result = evaluateRefundPolicy({
    transaction: { id: 'TEST_TXN1', status: 'FAILED', debit_status: 'NOT_DEBITED', amount: 500, created_at: new Date().toISOString() },
    customer: { risk_score: 0 },
    refundAlreadyIssued: false,
    refundAttempts: 0,
  });
  assertEqual(result.decision, POLICY_DECISIONS.DENY, 'Should DENY when not debited');
});

test('6. Transaction not failed — DENY for successful transactions', () => {
  const result = evaluateRefundPolicy({
    transaction: { id: 'TEST_TXN3', status: 'SUCCESS', debit_status: 'DEBITED', amount: 500, created_at: new Date().toISOString() },
    customer: { risk_score: 0 },
    refundAlreadyIssued: false,
    refundAttempts: 0,
  });
  assertEqual(result.decision, POLICY_DECISIONS.DENY, 'Should DENY for successful transactions');
});

test('7. Duplicate payment — ALLOW for confirmed duplicate', () => {
  const result = evaluateDuplicatePolicy({
    duplicateTransaction: { id: 'TEST_TXN4', merchant_id: 'TEST_MERCH', amount: 349, order_id: 'TEST-ORD-DUP', status: 'SUCCESS' },
    originalTransaction: { id: 'TEST_TXN3', merchant_id: 'TEST_MERCH', amount: 349, order_id: 'TEST-ORD-DUP' },
    customer: { risk_score: 0 },
  });
  assertEqual(result.decision, POLICY_DECISIONS.ALLOW, 'Confirmed duplicate should be ALLOW');
});

test('8. Suspicious transaction — always HUMAN_REVIEW', () => {
  const result = evaluateSuspiciousPolicy({
    transaction: { id: 'TEST_TXN5', amount: 4999 },
    customer: { risk_score: 75 },
    riskSignals: ['Unknown merchant', 'High amount'],
  });
  assertEqual(result.decision, POLICY_DECISIONS.HUMAN_REVIEW, 'Suspicious should always require review');
  assert(result.shouldFreezeAccount === true, 'Should freeze account on suspicious activity');
});

test('9. Merchant dispute — always HUMAN_REVIEW', () => {
  const result = evaluateMerchantDisputePolicy({
    transaction: { id: 'TEST_TXN3', amount: 12000, created_at: new Date().toISOString() },
    customer: { risk_score: 0 },
  });
  assertEqual(result.decision, POLICY_DECISIONS.HUMAN_REVIEW, 'Merchant disputes always require review');
});

// ── TOOL REGISTRY TESTS ───────────────────────────────────────────────────────
console.log('\n🔧 Tool Registry Tests');

async function runToolTests() {
  setupTestDb();

  const { getCustomer, getTransaction, checkRefundEligibility, checkPaymentStatus } = await import('../tools/toolRegistry.js');

  await test('10. getCustomer — returns customer with wallet', async () => {
    const customer = await getCustomer({ customerId: 'TEST_CUST1' });
    assert(customer.id === 'TEST_CUST1', 'Should return correct customer');
    assert(customer.name === 'Test User 1', 'Should have correct name');
  });

  test('11. getTransaction — returns transaction data', async () => {
    const txn = await getTransaction({ transactionId: 'TEST_TXN1' });
    assert(txn.id === 'TEST_TXN1', 'Should return correct transaction');
    assert(txn.amount === 500, 'Should have correct amount');
    assert(txn.status === 'FAILED', 'Should have FAILED status');
  });

  test('12. checkPaymentStatus — returns payment status details', async () => {
    const status = await checkPaymentStatus({ transactionId: 'TEST_TXN1' });
    assert(status.status === 'FAILED', 'Status should be FAILED');
    assert(status.debitStatus === 'DEBITED', 'Debit status should be DEBITED');
  });

  test('13. checkRefundEligibility — correctly identifies eligible refund', async () => {
    const eligibility = await checkRefundEligibility({ transactionId: 'TEST_TXN1', customerId: 'TEST_CUST1' });
    assert(eligibility.eligible === true, 'Should be eligible for refund');
    assert(eligibility.amount === 500, 'Amount should match');
  });
}

// ── AGENT WORKFLOW TESTS ──────────────────────────────────────────────────────
console.log('\n🤖 Agent Workflow Tests');

async function runAgentTests() {
  setupTestDb();

  const { runAgent } = await import('../agents/agentOrchestrator.js');
  const db = getDb();

  // Insert test support case
  db.prepare(`
    INSERT OR REPLACE INTO support_cases (id, customer_id, transaction_id, issue_type, priority, status, title, description)
    VALUES ('TEST_CASE1', 'TEST_CUST1', 'TEST_TXN1', 'PAYMENT_FAILED_DEBITED', 'HIGH', 'OPEN', 'Test case', 'Payment failed but amount deducted')
  `).run();

  await test('14. Agent workflow — payment failed + debited → auto refund', async () => {
    const result = await runAgent({
      caseId: 'TEST_CASE1',
      customerId: 'TEST_CUST1',
      customerMessage: 'My payment of ₹500 failed but money was deducted',
      transactionId: 'TEST_TXN1',
      issueType: 'PAYMENT_FAILED_DEBITED',
    });
    assert(result.success === true, 'Agent should succeed');
    assert(result.steps.length > 0, 'Should have execution steps');
    assert(result.policyResult?.decision === POLICY_DECISIONS.ALLOW, 'Policy should ALLOW');
    assert(result.status === 'RESOLVED', 'Case should be RESOLVED');
    assert(result.refund !== undefined, 'Should have refund details');
  });

  // Insert high-value test case
  db.prepare(`
    INSERT OR REPLACE INTO support_cases (id, customer_id, transaction_id, issue_type, priority, status, title, description)
    VALUES ('TEST_CASE2', 'TEST_CUST1', 'TEST_TXN2', 'PAYMENT_FAILED_DEBITED', 'CRITICAL', 'OPEN', 'High value test', 'High value payment failed')
  `).run();

  await test('15. Agent workflow — high-value transaction → human review escalation', async () => {
    const result = await runAgent({
      caseId: 'TEST_CASE2',
      customerId: 'TEST_CUST1',
      customerMessage: 'My ₹6000 payment failed but money was deducted',
      transactionId: 'TEST_TXN2',
      issueType: 'PAYMENT_FAILED_DEBITED',
    });
    assert(result.policyResult?.decision === POLICY_DECISIONS.HUMAN_REVIEW, 'High value should escalate');
    assert(result.status === 'ESCALATED', 'Case should be ESCALATED');
    assert(result.escalation !== undefined, 'Should have escalation details');
  });

  // Insert suspicious test case
  db.prepare(`
    INSERT OR REPLACE INTO support_cases (id, customer_id, transaction_id, issue_type, priority, status, title, description)
    VALUES ('TEST_CASE3', 'TEST_CUST2', 'TEST_TXN5', 'SUSPICIOUS_TRANSACTION', 'CRITICAL', 'OPEN', 'Suspicious test', 'Unknown transaction')
  `).run();

  await test('16. Agent workflow — suspicious transaction → freeze + escalate', async () => {
    const result = await runAgent({
      caseId: 'TEST_CASE3',
      customerId: 'TEST_CUST2',
      customerMessage: 'I dont recognize this ₹4999 transaction',
      transactionId: 'TEST_TXN5',
      issueType: 'SUSPICIOUS_TRANSACTION',
    });
    assert(result.status === 'ESCALATED', 'Suspicious should escalate');
    // Check account was frozen
    const customer = db.prepare('SELECT account_status FROM customers WHERE id = ?').get('TEST_CUST2');
    assert(customer.account_status === 'FROZEN', 'Account should be frozen');
  });

  // Insert duplicate test case
  db.prepare(`
    INSERT OR REPLACE INTO support_cases (id, customer_id, transaction_id, issue_type, priority, status, title, description)
    VALUES ('TEST_CASE4', 'TEST_CUST1', 'TEST_TXN3', 'DUPLICATE_PAYMENT', 'MEDIUM', 'OPEN', 'Dup test', 'Charged twice')
  `).run();

  await test('17. Agent workflow — duplicate payment → refund duplicate', async () => {
    const result = await runAgent({
      caseId: 'TEST_CASE4',
      customerId: 'TEST_CUST1',
      customerMessage: 'I was charged twice for the same order',
      transactionId: 'TEST_TXN3',
      issueType: 'DUPLICATE_PAYMENT',
    });
    assert(result.success === true, 'Duplicate resolution should succeed');
    assert(['RESOLVED', 'ESCALATED'].includes(result.status), 'Should resolve or escalate');
  });

  await test('18. Refund verification — refund marked as COMPLETED', async () => {
    const db = getDb();
    const refund = db.prepare("SELECT * FROM refunds WHERE customer_id = 'TEST_CUST1' AND status = 'COMPLETED' LIMIT 1").get();
    assert(refund !== undefined, 'Should have a completed refund');
    assert(refund.amount > 0, 'Refund amount should be positive');
  });
}

// Run all tests
async function main() {
  try {
    await runToolTests();
    await runAgentTests();
  } catch (e) {
    console.error('Test runner error:', e);
    failed++;
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Tests: ${passed + failed} total | ${passed} passed | ${failed} failed`);
  if (failed > 0) {
    console.log('\n⚠️ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
