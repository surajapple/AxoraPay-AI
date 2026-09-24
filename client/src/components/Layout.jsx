import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard, MessageSquare, FileText, AlertTriangle,
  ScrollText, Settings, LogOut, Bot, ChevronLeft, ChevronRight,
  ShieldAlert
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat', icon: MessageSquare, label: 'Customer Chat' },
  { to: '/cases', icon: FileText, label: 'Cases' },
  { to: '/escalations', icon: AlertTriangle, label: 'Escalations' },
  { to: '/audit', icon: ScrollText, label: 'Audit Logs' },
  { to: '/admin', icon: Settings, label: 'Admin Panel' },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 text-surface-900">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col bg-white border-r border-surface-200 transition-all duration-200 flex-shrink-0 z-10 shadow-sm',
        collapsed ? 'w-16' : 'w-64'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-200">
          <div className="w-8 h-8 rounded-md bg-accent-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Bot size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-surface-900 tracking-tight">AxoraPay AI</span>
              <span className="text-[10px] text-surface-500 font-medium">AUTONOMOUS AGENT</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-hide">
          <div className={clsx("text-xs font-semibold text-surface-500 mb-2 px-2 uppercase tracking-wider", collapsed && "hidden")}>
            Menu
          </div>
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-50 text-accent-700'
                  : 'text-surface-600 hover:text-surface-900 hover:bg-surface-50'
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + Collapse */}
        <div className="border-t border-surface-200 p-3 space-y-3">
          {!collapsed && (
            <div className="px-2">
              <div className="text-sm font-semibold text-surface-900">{user?.name}</div>
              <div className="text-xs text-surface-500">{user?.email}</div>
              <div className="mt-1">
                <span className={clsx(
                  'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                  user?.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                  user?.role === 'AGENT' ? 'bg-blue-100 text-blue-700' :
                  'bg-teal-100 text-teal-700'
                )}>
                  {user?.role}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium text-surface-600 hover:text-status-error hover:bg-status-errorBg transition-colors"
              title="Logout"
            >
              <LogOut size={16} className="flex-shrink-0" />
              {!collapsed && <span>Logout</span>}
            </button>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-md text-surface-500 hover:text-surface-900 hover:bg-surface-50 transition-colors"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-6 flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
             {/* Reserved for page title if passed via context, otherwise empty */}
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded bg-status-warningBg border border-status-warning/20">
               <ShieldAlert size={14} className="text-status-warning" />
               <span className="text-[11px] font-semibold text-status-warning uppercase tracking-wide">
                 Demo Environment
               </span>
             </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
