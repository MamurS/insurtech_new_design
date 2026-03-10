import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeTokens } from '../../theme/useTheme';
import {
  LayoutDashboard, Briefcase, ArrowDownRight, Zap, Shield,
  Wallet, Building2, Plus, Globe, Home, Settings, Search,
  FileSpreadsheet, AlertOctagon, ClipboardList, BarChart3,
  Receipt, Calculator, FileCheck, FileText
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  group?: string;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const t = useThemeTokens();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    { label: 'Dashboard', icon: <LayoutDashboard size={16} />, path: '/', group: 'Navigation' },
    { label: 'Policy Admin', icon: <Briefcase size={16} />, path: '/direct-insurance', group: 'Navigation' },
    { label: 'Inward Reinsurance', icon: <ArrowDownRight size={16} />, path: '/inward-reinsurance', group: 'Navigation' },
    { label: 'Inward RI — Foreign', icon: <Globe size={16} />, path: '/inward-reinsurance/foreign', group: 'Navigation' },
    { label: 'Inward RI — Domestic', icon: <Home size={16} />, path: '/inward-reinsurance/domestic', group: 'Navigation' },
    { label: 'Claims', icon: <AlertOctagon size={16} />, path: '/claims', group: 'Navigation' },
    { label: 'MGA / Binders', icon: <Zap size={16} />, path: '/mga', group: 'Navigation' },
    { label: 'Analytics', icon: <BarChart3 size={16} />, path: '/analytics', group: 'Navigation' },
    { label: 'Financial Statements', icon: <Receipt size={16} />, path: '/financial-statements', group: 'Finance' },
    { label: 'Risk Accumulation', icon: <Shield size={16} />, path: '/risk-accumulation', group: 'Finance' },
    { label: 'IBNR Estimation', icon: <Calculator size={16} />, path: '/ibnr/manual', group: 'Finance' },
    { label: 'Regulatory Reporting', icon: <FileCheck size={16} />, path: '/regulatory', group: 'Finance' },
    { label: 'Reinsurance Slips', icon: <FileSpreadsheet size={16} />, path: '/slips', group: 'Navigation' },
    { label: 'Legal Entities', icon: <Building2 size={16} />, path: '/entities', group: 'Configuration' },
    { label: 'Clause Library', icon: <FileText size={16} />, path: '/clauses', group: 'Configuration' },
    { label: 'My Agenda', icon: <ClipboardList size={16} />, path: '/agenda', group: 'Navigation' },
    { label: 'Settings', icon: <Settings size={16} />, path: '/settings', group: 'Configuration' },
    { label: 'New Direct Policy', icon: <Plus size={16} />, path: '/new', group: 'Actions' },
    { label: 'New Inward Foreign', icon: <Globe size={16} />, path: '/inward-reinsurance/foreign/new', group: 'Actions' },
    { label: 'New Inward Domestic', icon: <Home size={16} />, path: '/inward-reinsurance/domestic/new', group: 'Actions' },
    { label: 'Admin Console', icon: <Settings size={16} />, path: '/admin', group: 'Configuration' },
  ];

  const filtered = q
    ? commands.filter(c => c.label.toLowerCase().includes(q.toLowerCase()))
    : commands;

  useEffect(() => {
    if (open && ref.current) ref.current.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 120,
      }}
      onClick={onClose}
    >
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 480,
          background: t.bgPanel,
          border: `1px solid ${t.borderL}`,
          borderRadius: 14,
          boxShadow: t.shadowLg,
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Search size={16} style={{ color: t.text4, flexShrink: 0 }} />
          <input
            ref={ref}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search commands, pages..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: t.text1,
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <span style={{
            fontSize: 10,
            color: t.text5,
            background: t.bgApp,
            padding: '2px 6px',
            borderRadius: 4,
            border: `1px solid ${t.border}`,
          }}>
            ESC
          </span>
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
          {filtered.map((c, i) => (
            <div
              key={i}
              onClick={() => {
                navigate(c.path);
                onClose();
                setQ('');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                color: t.text3,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {c.icon}
              <span style={{ color: t.text1, fontSize: 13 }}>{c.label}</span>
              {c.group && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: t.text5 }}>{c.group}</span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: t.text4, fontSize: 13 }}>
              No results found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
