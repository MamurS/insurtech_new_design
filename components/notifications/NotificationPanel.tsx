import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface NotificationItem {
  ev: string;
  pol: string;
  client: string;
  time: string;
  color: string;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  items?: NotificationItem[];
}

const DEFAULT_ITEMS: NotificationItem[] = [
  { ev: 'PolicyIssued', pol: 'POL-2024-007', client: 'PKN Orlen UZ', time: '2h ago', color: '#10b981' },
  { ev: 'RenewalDue', pol: 'POL-2024-005', client: 'Ipoteka Bank', time: '1d ago', color: '#2563eb' },
  { ev: 'ClaimRegistered', pol: 'POL-2024-002', client: 'Almalyk GMK', time: '2d ago', color: '#ef4444' },
  { ev: 'QuoteSubmitted', pol: 'POL-2024-008', client: 'Mortgage Co', time: '3d ago', color: '#f59e0b' },
  { ev: 'CessionCalculated', pol: 'INW-2024-005', client: 'Munich Re', time: '4d ago', color: '#8b5cf6' },
];

const NotificationPanel: React.FC<NotificationPanelProps> = ({ open, onClose, items = DEFAULT_ITEMS }) => {
  const t = useThemeTokens();

  if (!open) return null;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={onClose} />
      <div style={{
        position: 'absolute',
        top: 44,
        right: 8,
        width: 340,
        background: t.bgPanel,
        border: `1px solid ${t.borderL}`,
        borderRadius: 12,
        boxShadow: t.shadowLg,
        zIndex: 999,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, color: t.text1, fontSize: 13 }}>Notifications</span>
          <span style={{ fontSize: 11, color: t.accent, cursor: 'pointer', fontWeight: 500 }}>Mark all read</span>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {items.map((a, i) => (
            <div
              key={i}
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${t.borderS}`,
                display: 'flex',
                gap: 10,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.bgHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: a.color,
                marginTop: 5,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: t.text1, fontWeight: 500 }}>{a.ev}</div>
                <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>{a.client} · {a.pol}</div>
                <div style={{ fontSize: 10, color: t.text5, marginTop: 3 }}>{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default NotificationPanel;
