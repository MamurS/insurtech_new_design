import React from 'react';

const statusStyle: Record<string, { bg: string; color: string; dot: string }> = {
  Active: { bg: '#10b98115', color: '#10b981', dot: '#10b981' },
  Pending: { bg: '#f59e0b15', color: '#f59e0b', dot: '#f59e0b' },
  Renewal: { bg: '#2563eb15', color: '#3b82f6', dot: '#3b82f6' },
  Lapsed: { bg: '#ef444415', color: '#ef4444', dot: '#ef4444' },
  Inactive: { bg: '#64748b15', color: '#64748b', dot: '#64748b' },
  Expired: { bg: '#64748b15', color: '#64748b', dot: '#64748b' },
};

const stageColor: Record<string, string> = {
  Quote: '#3b82f6',
  Referral: '#f59e0b',
  Bound: '#10b981',
  Renewal: '#8b5cf6',
  Expired: '#64748b',
  Facultative: '#8b5cf6',
  'Treaty - QS': '#10b981',
  'Treaty - XL': '#f59e0b',
  'Treaty - Surplus': '#06b6d4',
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = statusStyle[status] || statusStyle.Pending;
  return (
    <span style={{
      background: s.bg,
      color: s.color,
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: 11,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {status}
    </span>
  );
};

export const StageBadge: React.FC<{ stage: string }> = ({ stage }) => {
  const c = stageColor[stage] || '#64748b';
  return (
    <span style={{
      background: `${c}12`,
      color: c,
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
    }}>
      {stage}
    </span>
  );
};

export const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const typeColor: Record<string, string> = {
    DIRECT: '#2563eb',
    'IN-FOREIGN': '#8b5cf6',
    'IN-DOMESTIC': '#10b981',
  };
  const c = typeColor[type] || '#64748b';
  return (
    <span style={{
      background: `${c}12`,
      color: c,
      padding: '4px 10px',
      borderRadius: 20,
      fontSize: 10,
      fontWeight: 600,
    }}>
      {type}
    </span>
  );
};

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const roleColor: Record<string, string> = {
    'Super Admin': '#ef4444',
    Admin: '#f59e0b',
    Underwriter: '#2563eb',
    Claims: '#8b5cf6',
    Finance: '#06b6d4',
    Viewer: '#64748b',
  };
  const c = roleColor[role] || '#64748b';
  return (
    <span style={{
      fontSize: 11,
      padding: '4px 12px',
      borderRadius: 20,
      background: `${c}15`,
      color: c,
      fontWeight: 600,
      width: 'fit-content',
    }}>
      {role}
    </span>
  );
};
