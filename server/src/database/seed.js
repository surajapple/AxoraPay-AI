import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // Clean DB
  await prisma.agentStep.deleteMany();
  await prisma.agentExecution.deleteMany();
  await prisma.caseMessage.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.case.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.merchant.deleteMany();
  await prisma.user.deleteMany();
  await prisma.policy.deleteMany();
  await prisma.systemSetting.deleteMany();

  // Settings
  await prisma.systemSetting.createMany({
    data: [
      { id: 'AUTO_REFUND_LIMIT', value: '5000', description: 'Auto Refund Limit (₹)' },
      { id: 'REFUND_WINDOW_DAYS', value: '30', description: 'Refund Window (Days)' },
      { id: 'MAX_REFUNDS_PER_CUSTOMER', value: '3', description: 'Max Monthly Refunds' },
      { id: 'SUSPICIOUS_RISK_THRESHOLD', value: '75', description: 'Suspicious Risk Threshold' },
      { id: 'FREEZE_ON_SUSPICIOUS', value: 'true', description: 'Auto-Freeze Suspicious Accounts' },
      { id: 'REQUIRE_KYC_FOR_REFUND', value: 'true', description: 'Require KYC for Refund' },
    ]
  });

  // Policies
  await prisma.policy.createMany({
    data: [
      {
        name: 'Auto-Refund Eligibility',
        description: 'Automatically approves refunds under ₹5,000 for failed transactions within 30 days.',
        conditions: JSON.stringify(['amount <= 5000', 'status == FAILED', 'debitStatus == DEBITED', 'days_since_txn <= 30']),
        action: 'ALLOW',
      },
      {
        name: 'High-Value Escalation',
        description: 'Escalates refunds > ₹5,000 to human support agents.',
        conditions: JSON.stringify(['amount > 5000', 'debitStatus == DEBITED']),
        action: 'HUMAN_REVIEW',
      },
      {
        name: 'Suspicious Transaction Freeze',
        description: 'Freezes account and flags transaction if risk score exceeds 75.',
        conditions: JSON.stringify(['customer.riskScore > 75']),
        action: 'DENY_AND_FREEZE',
      }
    ]
  });

  // Users
  await prisma.user.create({
    data: {
      email: 'admin@axorapay.com',
      name: 'Admin User',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
    }
  });

  await prisma.user.create({
    data: {
      email: 'demo@axorapay.com',
      name: 'Demo Customer',
      password: await bcrypt.hash('demo123', 10),
      role: 'CUSTOMER',
    }
  });

  await prisma.user.create({
    data: {
      email: 'agent@axorapay.com',
      name: 'Support Agent',
      password: await bcrypt.hash('agent123', 10),
      role: 'AGENT',
    }
  });

  await prisma.user.create({
    data: {
      email: 'rahul@email.com',
      name: 'Rahul Sharma',
      password: await bcrypt.hash('test123', 10),
      role: 'CUSTOMER',
    }
  });

  // Merchants
  const merchants = await Promise.all([
    prisma.merchant.create({ data: { name: 'Zomato', category: 'Food Delivery' } }),
    prisma.merchant.create({ data: { name: 'Swiggy', category: 'Food Delivery' } }),
    prisma.merchant.create({ data: { name: 'Amazon', category: 'E-commerce' } }),
    prisma.merchant.create({ data: { name: 'Flipkart', category: 'E-commerce' } }),
    prisma.merchant.create({ data: { name: 'Uber', category: 'Transport' } }),
  ]);

  // Customers
  const customerNames = [
    'Alice Sharma', 'Bob Verma', 'Charlie Singh', 'Diana Patel', 'Eve Gupta',
    'Frank Reddy', 'Grace Rao', 'Hank Das', 'Ivy Menon', 'Jack Iyer',
    'Karen Nair', 'Liam Joshi', 'Mia Kapoor', 'Noah Mehta', 'Olivia Desai',
    'Peter Shah', 'Quinn Bhat', 'Rachel Bose', 'Sam Ghosh', 'Tina Sen'
  ];

  const customers = [];
  for (let i = 0; i < 20; i++) {
    const kycStatus = i % 10 === 0 ? 'PENDING' : 'VERIFIED';
    const riskScore = i === 4 ? 85 : i === 8 ? 45 : Math.floor(Math.random() * 20);
    const accountStatus = riskScore > 75 ? 'FROZEN' : 'ACTIVE';
    let email = `${customerNames[i].split(' ')[0].toLowerCase()}@example.com`;
    let name = customerNames[i];
    if (i === 0) {
      email = 'rahul@email.com';
      name = 'Rahul Sharma';
    } else if (i === 1) {
      email = 'demo@axorapay.com';
      name = 'Demo Customer';
    }

    customers.push(await prisma.customer.create({
      data: {
        name: name,
        email: email,
        phone: `+9198765432${i.toString().padStart(2, '0')}`,
        kycStatus,
        riskScore,
        accountStatus,
        walletBalance: Math.floor(Math.random() * 10000),
      }
    }));
  }

  // Transactions
  const txnStatuses = ['SUCCESS', 'FAILED', 'PENDING'];
  const transactions = [];
  
  // Specific demo transaction 1: Failed payment + debit
  transactions.push(await prisma.transaction.create({
    data: {
      id: 'TXN20001',
      customerId: customers[0].id,
      merchantId: merchants[0].id,
      amount: 500,
      type: 'DEBIT',
      status: 'FAILED',
      debitStatus: 'DEBITED',
      paymentMethod: 'UPI',
      description: 'Zomato Order #9912',
      failureReason: 'Bank Server Timeout',
    }
  }));

  // Specific demo transaction 2: Duplicate payment
  transactions.push(await prisma.transaction.create({
    data: {
      id: 'TXN20002',
      customerId: customers[1].id,
      merchantId: merchants[1].id,
      amount: 850,
      type: 'DEBIT',
      status: 'SUCCESS',
      debitStatus: 'DEBITED',
      paymentMethod: 'UPI',
      description: 'Swiggy Order #8812',
    }
  }));
  transactions.push(await prisma.transaction.create({
    data: {
      id: 'TXN20003',
      customerId: customers[1].id,
      merchantId: merchants[1].id,
      amount: 850,
      type: 'DEBIT',
      status: 'SUCCESS',
      debitStatus: 'DEBITED',
      paymentMethod: 'UPI',
      description: 'Swiggy Order #8812',
    }
  }));

  // Specific demo transaction 3: Suspicious transaction
  transactions.push(await prisma.transaction.create({
    data: {
      id: 'TXN20004',
      customerId: customers[4].id, // High risk customer
      merchantId: merchants[2].id,
      amount: 4999,
      type: 'DEBIT',
      status: 'SUCCESS',
      debitStatus: 'DEBITED',
      paymentMethod: 'CARD',
      description: 'Amazon Purchase',
    }
  }));

  // Specific demo transaction 4: High value refund requiring human approval
  transactions.push(await prisma.transaction.create({
    data: {
      id: 'TXN20005',
      customerId: customers[2].id,
      merchantId: merchants[3].id,
      amount: 12000,
      type: 'DEBIT',
      status: 'FAILED',
      debitStatus: 'DEBITED',
      paymentMethod: 'UPI',
      description: 'Flipkart Order',
      failureReason: 'Timeout',
    }
  }));

  // Generate 50+ random transactions
  for (let i = 0; i < 50; i++) {
    const status = txnStatuses[Math.floor(Math.random() * txnStatuses.length)];
    const debitStatus = status === 'SUCCESS' ? 'DEBITED' : (Math.random() > 0.5 ? 'DEBITED' : 'NOT_DEBITED');
    transactions.push(await prisma.transaction.create({
      data: {
        customerId: customers[Math.floor(Math.random() * customers.length)].id,
        merchantId: merchants[Math.floor(Math.random() * merchants.length)].id,
        amount: Math.floor(Math.random() * 2000) + 100,
        type: 'DEBIT',
        status,
        debitStatus,
        paymentMethod: Math.random() > 0.5 ? 'UPI' : 'CARD',
      }
    }));
  }

  // Cases
  const case1 = await prisma.case.create({
    data: {
      id: 'CASE-DEMO-001',
      customerId: customers[0].id,
      transactionId: 'TXN20001',
      issueType: 'PAYMENT_FAILED_DEBITED',
      title: 'Payment Failed but Amount Debited',
      description: 'My payment of ₹500 failed but the money was deducted from my account for Zomato.',
      status: 'OPEN',
      priority: 'HIGH',
    }
  });

  const case2 = await prisma.case.create({
    data: {
      id: 'CASE-DEMO-002',
      customerId: customers[1].id,
      transactionId: 'TXN20002',
      issueType: 'DUPLICATE_PAYMENT',
      title: 'Duplicate charge on Swiggy',
      description: 'I was charged twice for the same Swiggy order',
      status: 'OPEN',
      priority: 'MEDIUM',
    }
  });

  const case3 = await prisma.case.create({
    data: {
      id: 'CASE-DEMO-003',
      customerId: customers[4].id,
      transactionId: 'TXN20004',
      issueType: 'SUSPICIOUS_TRANSACTION',
      title: 'Unrecognized transaction',
      description: 'I do not recognize a ₹4,999 transaction on my account — it looks suspicious',
      status: 'ESCALATED',
      priority: 'CRITICAL',
    }
  });

  const case4 = await prisma.case.create({
    data: {
      id: 'CASE-DEMO-004',
      customerId: customers[2].id,
      transactionId: 'TXN20005',
      issueType: 'MERCHANT_DISPUTE',
      title: 'High value refund delay',
      description: 'I paid ₹12,000 to Flipkart but order failed and amount is stuck.',
      status: 'ESCALATED',
      priority: 'HIGH',
    }
  });

  // Random Cases
  for (let i = 0; i < 10; i++) {
    await prisma.case.create({
      data: {
        customerId: customers[Math.floor(Math.random() * customers.length)].id,
        issueType: 'GENERAL_INQUIRY',
        title: 'General Support Question',
        description: 'I need help with my account.',
        status: Math.random() > 0.5 ? 'RESOLVED' : 'OPEN',
      }
    });
  }

  // Escalations
  await prisma.escalation.create({
    data: {
      caseId: case3.id,
      customerId: case3.customerId,
      reason: 'High risk score (85) and suspicious transaction amount.',
      priority: 'CRITICAL',
      status: 'PENDING',
    }
  });

  await prisma.escalation.create({
    data: {
      caseId: case4.id,
      customerId: case4.customerId,
      reason: 'Amount (₹12,000) exceeds auto-refund limit. Requires human approval.',
      priority: 'HIGH',
      status: 'PENDING',
    }
  });

  // 100+ audit logs
  for (let i = 0; i < 100; i++) {
    await prisma.auditLog.create({
      data: {
        action: ['LOGIN', 'CASE_CREATED', 'AGENT_STARTED', 'TOOL_EXECUTED', 'POLICY_CHECKED'][Math.floor(Math.random() * 5)],
        actor: Math.random() > 0.8 ? 'SYSTEM' : 'AI_AGENT',
      }
    });
  }

  console.log('Database seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
