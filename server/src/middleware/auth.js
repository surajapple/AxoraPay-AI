/**
 * Authentication middleware and routes
 * Simple demo auth with roles: CUSTOMER, AGENT, ADMIN
 */

const DEMO_USERS = {
  'demo@resolveai.com': { id: 'CUST2001', role: 'CUSTOMER', name: 'Demo Customer', customerId: 'CUST2001' },
  'admin@resolveai.com': { id: 'ADMIN001', role: 'ADMIN', name: 'Admin User', customerId: 'ADMIN001' },
  'agent@resolveai.com': { id: 'AGENT001', role: 'AGENT', name: 'Support Agent', customerId: 'AGENT001' },
  'rahul@email.com': { id: 'CUST1001', role: 'CUSTOMER', name: 'Rahul Sharma', customerId: 'CUST1001' },
};

const DEMO_PASSWORDS = {
  'demo@resolveai.com': 'demo123',
  'admin@resolveai.com': 'admin123',
  'agent@resolveai.com': 'agent123',
  'rahul@email.com': 'test123',
};

// In-memory session store (for demo)
const sessions = new Map();

export function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = DEMO_USERS[email.toLowerCase()];
  const expectedPwd = DEMO_PASSWORDS[email.toLowerCase()];

  if (!user || expectedPwd !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = `token_${Math.random().toString(36).substring(2)}_${Date.now()}`;
  sessions.set(token, { ...user, loginTime: Date.now() });

  return res.json({ token, user: { id: user.id, name: user.name, role: user.role, email, customerId: user.customerId } });
}

export function logout(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) sessions.delete(token);
  return res.json({ success: true });
}

export function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  // Allow demo token for unauthenticated demo scenarios
  if (token === 'demo_token') {
    req.user = DEMO_USERS['demo@resolveai.com'];
    return next();
  }

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.user = sessions.get(token);
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function getDemoCredentials(req, res) {
  return res.json({
    users: [
      { email: 'demo@resolveai.com', password: 'demo123', role: 'CUSTOMER', description: 'Demo customer account' },
      { email: 'admin@resolveai.com', password: 'admin123', role: 'ADMIN', description: 'Admin dashboard access' },
      { email: 'agent@resolveai.com', password: 'agent123', role: 'AGENT', description: 'Support agent access' },
      { email: 'rahul@email.com', password: 'test123', role: 'CUSTOMER', description: 'Rahul Sharma (has failed transaction TXN10001)' },
    ],
  });
}
