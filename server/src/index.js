import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

import authRouter from './routes/auth.routes.js';
import casesRouter from './routes/cases.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import customersRouter from './routes/customers.routes.js';
import analyticsRouter from './routes/analytics.routes.js';
import transactionsRouter from './routes/transactions.routes.js';
import escalationsRouter from './routes/escalations.routes.js';
import auditRouter from './routes/audit.routes.js';
import agentRouter from './routes/agent.routes.js';
import adminRouter from './routes/admin.routes.js';

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
    credentials: true,
  }
});

const PORT = process.env.PORT || 3001;

// Make io accessible to routes/services via req.app.get('io') or global
app.set('io', io);
global.io = io;

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// ── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('join_case', (caseId) => {
    socket.join(`case_${caseId}`);
    console.log(`Socket ${socket.id} joined case_${caseId}`);
  });

  socket.on('leave_case', (caseId) => {
    socket.leave(`case_${caseId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/cases', casesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/customers', customersRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/escalations', escalationsRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/agent', agentRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const customersCount = await prisma.customer.count();
    res.json({
      status: 'healthy',
      database: 'prisma-sqlite',
      customers: customersCount,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ status: 'unhealthy', error: e.message });
  }
});

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// Start server
httpServer.listen(PORT, async () => {
  try {
    // Quick DB check
    await prisma.$connect();
    console.log(`\n🚀 AxoraPay Backend (Dynamic) running on http://localhost:${PORT}`);
    console.log(`📁 Database: Prisma SQLite connected`);
    console.log(`🔌 WebSockets: Socket.IO initialized\n`);
  } catch (e) {
    console.error('Failed to connect to database:', e);
  }
});

export default app;
