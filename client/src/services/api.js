// API service layer - all backend calls

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Token management
export const getToken = () => localStorage.getItem('axora_pay_token');
export const setToken = (t) => localStorage.setItem('axora_pay_token', t);
export const removeToken = () => localStorage.removeItem('axora_pay_token');
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem('axora_pay_user') || 'null'); } catch { return null; }
};
export const setUser = (u) => localStorage.setItem('axora_pay_user', JSON.stringify(u));
export const removeUser = () => localStorage.removeItem('axora_pay_user');

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export const authApi = {
  login: (email, password) => apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
  getDemoCredentials: () => apiFetch('/api/auth/demo-credentials'),
};

// Dashboard & Analytics
export const dashboardApi = {
  stats: () => apiFetch('/api/dashboard/stats'),
  activity: () => apiFetch('/api/dashboard/activity'),
  trends: () => apiFetch('/api/analytics/trends'),
};

// Cases
export const casesApi = {
  list: (params = {}) => apiFetch(`/api/cases?${new URLSearchParams(params)}`),
  get: (id) => apiFetch(`/api/cases/${id}`),
  create: (data) => apiFetch('/api/cases', { method: 'POST', body: JSON.stringify(data) }),
};

// Agent
export const agentApi = {
  sendMessage: (caseId, content) => apiFetch('/api/agent/message', { method: 'POST', body: JSON.stringify({ caseId, content }) }),
  startDemo: (caseId) => apiFetch('/api/agent/demo/start', { method: 'POST', body: JSON.stringify({ caseId }) }),
};

// Customers
export const customersApi = {
  list: (params = {}) => apiFetch(`/api/customers?${new URLSearchParams(params)}`),
  get: (id) => apiFetch(`/api/customers/${id}`),
};

// Transactions
export const transactionsApi = {
  list: (params = {}) => apiFetch(`/api/transactions?${new URLSearchParams(params)}`),
  get: (id) => apiFetch(`/api/transactions/${id}`),
};

// Audit
export const auditApi = {
  list: (params = {}) => apiFetch(`/api/audit-logs?${new URLSearchParams(params)}`),
};

// Escalations
export const escalationsApi = {
  list: (params = {}) => apiFetch(`/api/escalations?${new URLSearchParams(params)}`),
  update: (id, data) => apiFetch(`/api/escalations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// Admin
export const adminApi = {
  policies: () => apiFetch('/api/admin/policies'),
  updatePolicies: (config) => apiFetch('/api/admin/policies/config', { method: 'PATCH', body: JSON.stringify(config) }),
  tools: () => apiFetch('/api/admin/tools'),
  metrics: () => apiFetch('/api/admin/metrics'),
  customers: () => apiFetch('/api/admin/customers'),
};

// Health
export const healthApi = {
  check: () => apiFetch('/api/health'),
  resetDemo: () => apiFetch('/api/agent/demo/reset', { method: 'POST' }),
};
