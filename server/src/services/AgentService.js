import { PrismaClient } from '@prisma/client';
import { ToolService } from './ToolService.js';
import { PolicyEngine } from './PolicyEngine.js';

const prisma = new PrismaClient();

const emitAgentStep = async (caseId, type, title, description, data, durationMs, execId) => {
  const step = await prisma.agentStep.create({
    data: {
      agentExecutionId: execId,
      type,
      title,
      description,
      data: JSON.stringify(data),
      duration: durationMs
    }
  });

  if (global.io) {
    global.io.to(`case_${caseId}`).emit('agent_step', step);
  }

  await new Promise(r => setTimeout(r, durationMs));
  return step;
};

export class AgentService {
  static async executeWorkflow(caseId) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: { transaction: true, customer: true }
    });

    if (!caseData || caseData.status === 'RESOLVED') return;

    if (global.io) global.io.to(`case_${caseId}`).emit('agent_started');

    const exec = await prisma.agentExecution.create({
      data: { caseId, status: 'RUNNING' }
    });

    try {
      // 1. THINKING
      await emitAgentStep(caseId, 'THINKING', 'Analyzing intent', 'Interpreting customer message and identifying issue type.', { intent: caseData.issueType }, 1200, exec.id);

      if (!caseData.transactionId) {
        // Simple inquiry
        await emitAgentStep(caseId, 'COMPLETED', 'Resolved', 'General inquiry answered.', {}, 800, exec.id);
        await prisma.case.update({ where: { id: caseId }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
        return;
      }

      // 2. TOOL_CALL (Fetch Txn)
      await emitAgentStep(caseId, 'TOOL_CALL', 'getCustomerTransaction', `Fetching transaction ${caseData.transactionId}`, { id: caseData.transactionId }, 900, exec.id);

      // 3. POLICY_CHECK
      const policyRes = await PolicyEngine.evaluateRefund(caseData.transactionId);
      await emitAgentStep(caseId, 'POLICY_CHECK', 'Evaluate Refund Policy', policyRes.reason, policyRes, 1500, exec.id);

      if (policyRes.decision === 'ALLOW') {
        // 4. EXECUTING (Create Refund)
        const refundRes = await ToolService.createRefund({
          transactionId: caseData.transactionId,
          amount: caseData.transaction.amount,
          reason: 'Autonomous agent refund'
        });
        await emitAgentStep(caseId, 'EXECUTING', 'createRefund', 'Initiating refund with bank API.', refundRes, 2000, exec.id);

        // 5. VERIFYING
        await emitAgentStep(caseId, 'VERIFYING', 'verifyRefundStatus', 'Polling for bank confirmation.', {}, 1500, exec.id);
        await ToolService.verifyRefund({ refundId: refundRes.refundId });
        await emitAgentStep(caseId, 'VERIFYING', 'Verification Complete', 'Refund verified successfully.', { status: 'COMPLETED' }, 800, exec.id);

        // 6. RESOLVE
        await prisma.case.update({ where: { id: caseId }, data: { status: 'RESOLVED', resolution: 'Autonomous Refund Issued', policyDecision: 'ALLOW', refundAmount: caseData.transaction.amount, resolvedAt: new Date() } });
        await emitAgentStep(caseId, 'COMPLETED', 'Case Resolved', 'Case marked as resolved successfully.', {}, 500, exec.id);
      } 
      else if (policyRes.decision === 'HUMAN_REVIEW') {
        // Escalate
        await emitAgentStep(caseId, 'HUMAN_REVIEW', 'Escalating to Human', 'Policy requires manual intervention.', policyRes, 1000, exec.id);
        await prisma.escalation.create({
          data: { caseId, customerId: caseData.customerId, reason: policyRes.reason }
        });
        await prisma.case.update({ where: { id: caseId }, data: { status: 'ESCALATED', escalationReason: policyRes.reason, policyDecision: 'HUMAN_REVIEW' } });
      } 
      else if (policyRes.decision === 'DENY') {
        // Deny
        await emitAgentStep(caseId, 'COMPLETED', 'Case Denied', 'Policy denied the action.', policyRes, 1000, exec.id);
        await prisma.case.update({ where: { id: caseId }, data: { status: 'RESOLVED', resolution: 'Request Denied by Policy', policyDecision: 'DENY', resolvedAt: new Date() } });
        
        if (caseData.issueType === 'SUSPICIOUS_TRANSACTION' || caseData.customer.riskScore > 75) {
           await emitAgentStep(caseId, 'EXECUTING', 'freezeAccount', 'Freezing account due to high risk.', {}, 1000, exec.id);
           await ToolService.freezeAccount({ customerId: caseData.customerId, reason: 'High risk' });
        }
      }

      await prisma.agentExecution.update({
        where: { id: exec.id },
        data: { status: 'SUCCESS', endedAt: new Date() }
      });
      
      // Emit case_updated event to force dashboard/lists to refresh
      if (global.io) global.io.emit('case_updated', caseId);
      
    } catch (e) {
      console.error(e);
      await emitAgentStep(caseId, 'FAILED', 'Agent Error', e.message, {}, 500, exec.id);
      await prisma.agentExecution.update({
        where: { id: exec.id },
        data: { status: 'FAILED', endedAt: new Date() }
      });
    }
  }
}
