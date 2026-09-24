/**
 * AI Provider Abstraction Layer
 * Supports: GeminiProvider | DemoProvider
 * Application never crashes due to missing API key.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Demo Provider ─────────────────────────────────────────────────────────────
// Deterministic responses for demo mode (no API key required)
export class DemoProvider {
  constructor() {
    this.name = 'DemoProvider';
    this.modelName = 'demo-deterministic';
  }

  async analyzeIssue(customerMessage, context) {
    const msg = customerMessage.toLowerCase();

    // Detect issue type from message
    if (msg.includes('failed') && (msg.includes('deducted') || msg.includes('debited') || msg.includes('charged'))) {
      return {
        issueType: 'PAYMENT_FAILED_DEBITED',
        confidence: 0.95,
        summary: 'Customer reports a failed payment where amount was debited from their account.',
        suggestedTools: ['getCustomer', 'getTransaction', 'checkPaymentStatus', 'checkRefundEligibility'],
        intent: 'REFUND_REQUEST',
        urgency: 'HIGH',
        extractedAmount: this._extractAmount(customerMessage),
      };
    }
    if (msg.includes('twice') || msg.includes('duplicate') || msg.includes('double')) {
      return {
        issueType: 'DUPLICATE_PAYMENT',
        confidence: 0.92,
        summary: 'Customer reports being charged twice for the same transaction.',
        suggestedTools: ['getCustomer', 'getTransactions', 'detectDuplicates'],
        intent: 'REFUND_REQUEST',
        urgency: 'MEDIUM',
        extractedAmount: this._extractAmount(customerMessage),
      };
    }
    if (msg.includes('upi') && msg.includes('fail')) {
      return {
        issueType: 'UPI_FAILED',
        confidence: 0.90,
        summary: 'Customer reports a failed UPI payment.',
        suggestedTools: ['getCustomer', 'getTransaction', 'checkPaymentStatus'],
        intent: 'STATUS_CHECK',
        urgency: 'MEDIUM',
        extractedAmount: this._extractAmount(customerMessage),
      };
    }
    if (msg.includes('wallet') && (msg.includes('balance') || msg.includes('incorrect') || msg.includes('wrong'))) {
      return {
        issueType: 'WALLET_BALANCE_ISSUE',
        confidence: 0.88,
        summary: 'Customer reports incorrect wallet balance.',
        suggestedTools: ['getCustomer', 'analyzeWalletBalance', 'getTransactions'],
        intent: 'BALANCE_INQUIRY',
        urgency: 'MEDIUM',
        extractedAmount: null,
      };
    }
    if (msg.includes("don't recognize") || msg.includes('suspicious') || msg.includes('unknown') || msg.includes('unauthorized')) {
      return {
        issueType: 'SUSPICIOUS_TRANSACTION',
        confidence: 0.93,
        summary: 'Customer reports an unrecognized or suspicious transaction.',
        suggestedTools: ['getCustomer', 'getTransaction', 'freezeAccount', 'escalateToHuman'],
        intent: 'FRAUD_REPORT',
        urgency: 'CRITICAL',
        extractedAmount: this._extractAmount(customerMessage),
      };
    }
    if (msg.includes('merchant') || msg.includes("didn't receive") || msg.includes('not delivered') || msg.includes('product')) {
      return {
        issueType: 'MERCHANT_DISPUTE',
        confidence: 0.87,
        summary: 'Customer reports non-delivery of product after payment.',
        suggestedTools: ['getCustomer', 'getTransaction', 'createDispute', 'escalateToHuman'],
        intent: 'DISPUTE',
        urgency: 'HIGH',
        extractedAmount: this._extractAmount(customerMessage),
      };
    }

    // Generic fallback
    return {
      issueType: 'GENERAL_INQUIRY',
      confidence: 0.70,
      summary: 'Customer has a general inquiry about a payment or account issue.',
      suggestedTools: ['getCustomer', 'getTransactions'],
      intent: 'INQUIRY',
      urgency: 'LOW',
      extractedAmount: this._extractAmount(customerMessage),
    };
  }

  async generateCustomerResponse(context) {
    const { issueType, resolution, transaction, refund, policyDecision, caseId } = context;

    const responses = {
      PAYMENT_FAILED_DEBITED: refund
        ? `Hi! I've looked into your payment issue and I'm happy to help. 

**What happened:** Your payment of ₹${transaction?.amount?.toLocaleString('en-IN')} to ${transaction?.merchant_name} failed, but the amount was debited from your account.

**Action taken:** I've initiated a refund of ₹${refund.amount?.toLocaleString('en-IN')} for transaction ${transaction?.id}.

**Verification:** The refund has been verified and is now processing.

**Timeline:** Your money will be returned to your account within 3-5 business days.

**Case ID:** ${caseId}

Is there anything else I can help you with?`
        : `I've investigated your payment issue. The transaction ${transaction?.id} shows FAILED status${transaction?.debit_status === 'DEBITED' ? ' and the amount was debited' : ' but no amount was debited'}. ${resolution || 'Please contact support for further assistance.'}`,

      DUPLICATE_PAYMENT: refund
        ? `I've identified and resolved your duplicate payment issue!

**Finding:** You were charged twice for the same order (₹${transaction?.amount?.toLocaleString('en-IN')} each).

**Action:** The duplicate charge of ₹${refund?.amount?.toLocaleString('en-IN')} has been refunded.

**Timeline:** Refund will reflect in 3-5 business days.

**Case ID:** ${caseId}`
        : `I've found what appears to be a duplicate charge. Our team will review this case. Case ID: ${caseId}`,

      SUSPICIOUS_TRANSACTION: `I've flagged this transaction for immediate security review.

**Action taken:**
- Transaction has been flagged for fraud review
- Your account has been temporarily secured as a precaution
- Case escalated to our security team (priority: CRITICAL)

**Next steps:** Our security team will review this within 2 hours and contact you on your registered phone number.

**Case ID:** ${caseId}

⚠️ If you did NOT initiate this transaction, please do not share your OTP or PIN with anyone.`,

      MERCHANT_DISPUTE: `I've created a dispute for your transaction.

**Dispute Created:** Your case has been escalated to our merchant resolution team.

**Evidence collected:** Transaction details, merchant information, and your complaint description.

**Timeline:** Resolution within 7-10 business days as per our dispute policy.

**Case ID:** ${caseId}

We'll keep you updated via SMS and app notifications.`,

      WALLET_BALANCE_ISSUE: `I've analyzed your wallet transaction history.

**Investigation:** Reviewed your recent ${context.transactionCount || 'recent'} transactions.

**Finding:** ${context.discrepancy ? `A discrepancy of ₹${context.discrepancy} was detected. A reconciliation case has been created.` : 'Your wallet balance appears to be correct based on your transaction history.'}

**Case ID:** ${caseId}

Our finance team will review and reconcile within 24-48 hours.`,

      UPI_FAILED: `I've checked your UPI payment status.

**Status:** The payment failed — ${transaction?.debit_status === 'DEBITED' ? 'however the amount was debited and a refund will be initiated' : 'and no amount was debited from your account'}.

${transaction?.failure_reason ? `**Reason:** ${transaction.failure_reason}` : ''}

**Case ID:** ${caseId}`,

      GENERAL_INQUIRY: `Thank you for reaching out! I've reviewed your account and am looking into your concern.

**Case ID:** ${caseId}

A support agent will follow up if any action is required.`,
    };

    return responses[issueType] || responses.GENERAL_INQUIRY;
  }

  async generateExplanation(context) {
    const { issueType, transaction, policyResult, refund, caseId } = context;

    return {
      issueIdentified: this._getIssueDescription(issueType),
      evidence: transaction
        ? `Transaction ${transaction.id} — Status: ${transaction.status}, Debit Status: ${transaction.debit_status}, Amount: ₹${transaction.amount?.toLocaleString('en-IN')}`
        : 'Transaction details retrieved from database.',
      policyApplied: policyResult
        ? `${policyResult.decision}: ${policyResult.reason}`
        : 'Policy evaluation completed.',
      actionTaken: refund
        ? `Refund of ₹${refund.amount?.toLocaleString('en-IN')} initiated (Refund ID: ${refund.refundId})`
        : 'Case processed per policy guidelines.',
      verificationResult: refund
        ? `Refund successfully verified and processing. Expected in 3-5 business days.`
        : 'Case outcome verified and recorded.',
    };
  }

  _extractAmount(message) {
    const match = message.match(/[₹rs\.]*\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
    return null;
  }

  _getIssueDescription(issueType) {
    const descriptions = {
      PAYMENT_FAILED_DEBITED: 'Payment failed but amount was debited from customer account.',
      DUPLICATE_PAYMENT: 'Customer charged twice for the same transaction.',
      UPI_FAILED: 'UPI payment failed.',
      WALLET_BALANCE_ISSUE: 'Wallet balance discrepancy reported.',
      SUSPICIOUS_TRANSACTION: 'Unrecognized or suspicious transaction detected.',
      MERCHANT_DISPUTE: 'Customer did not receive product/service despite successful payment.',
      GENERAL_INQUIRY: 'General customer inquiry.',
    };
    return descriptions[issueType] || 'Customer issue identified and analyzed.';
  }
}

// ── Gemini Provider ───────────────────────────────────────────────────────────
export class GeminiProvider {
  constructor(apiKey) {
    this.name = 'GeminiProvider';
    this.modelName = 'gemini-1.5-flash';
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });
  }

  async analyzeIssue(customerMessage, context) {
    const prompt = `You are an AI customer support agent for a digital payments platform similar to Paytm.

Analyze the following customer message and extract structured information.

Customer Message: "${customerMessage}"

Customer Context:
${JSON.stringify(context, null, 2)}

Respond ONLY with valid JSON in this exact format:
{
  "issueType": "PAYMENT_FAILED_DEBITED" | "DUPLICATE_PAYMENT" | "UPI_FAILED" | "WALLET_BALANCE_ISSUE" | "SUSPICIOUS_TRANSACTION" | "MERCHANT_DISPUTE" | "GENERAL_INQUIRY",
  "confidence": 0.0 to 1.0,
  "summary": "Brief description of the issue",
  "suggestedTools": ["tool1", "tool2"],
  "intent": "REFUND_REQUEST" | "STATUS_CHECK" | "FRAUD_REPORT" | "DISPUTE" | "BALANCE_INQUIRY" | "INQUIRY",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "extractedAmount": number or null,
  "keyEntities": {}
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Gemini analyzeIssue error:', e.message);
    }

    // Fallback to demo provider
    return new DemoProvider().analyzeIssue(customerMessage, context);
  }

  async generateCustomerResponse(context) {
    const { issueType, resolution, transaction, refund, caseId, policyDecision } = context;
    const prompt = `You are a helpful, empathetic AI customer support agent for AxoraPay (a Paytm-like payments platform).

Generate a professional, concise customer-facing response for the following resolved case:

Issue Type: ${issueType}
Case ID: ${caseId}
Transaction: ${JSON.stringify(transaction || {})}
Refund: ${JSON.stringify(refund || {})}
Policy Decision: ${policyDecision}
Resolution: ${resolution}

Requirements:
- Be empathetic and professional
- Be specific (include amounts, transaction IDs, case IDs)
- Mention next steps and timelines
- Keep it under 200 words
- Use markdown formatting

Respond with only the customer message text.`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      console.error('Gemini generateCustomerResponse error:', e.message);
      return new DemoProvider().generateCustomerResponse(context);
    }
  }

  async generateExplanation(context) {
    try {
      const prompt = `Generate a transparent AI explanation for this resolved customer case:
${JSON.stringify(context, null, 2)}

Respond with JSON:
{
  "issueIdentified": "...",
  "evidence": "...",
  "policyApplied": "...",
  "actionTaken": "...",
  "verificationResult": "..."
}`;
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Gemini generateExplanation error:', e.message);
    }
    return new DemoProvider().generateExplanation(context);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────
export function createAIProvider() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim() && apiKey !== 'your_gemini_api_key_here') {
    console.log('🤖 Using GeminiProvider (API key detected)');
    try {
      return new GeminiProvider(apiKey);
    } catch (e) {
      console.warn('⚠️ GeminiProvider initialization failed, falling back to DemoProvider:', e.message);
    }
  }
  console.log('🤖 Using DemoProvider (no API key — demo mode active)');
  return new DemoProvider();
}
