import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';
import { X } from 'lucide-react';

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

const SidePanel: React.FC<SidePanelProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 360,
}) => {
  const t = useThemeTokens();

  if (!open) return null;

  return (
    <div
      style={{
        width,
        minWidth: width,
        height: '100%',
        background: t.bgPanel,
        borderLeft: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontWeight: 700, color: t.text1, fontSize: 15 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: t.text3, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: t.text4,
            cursor: 'pointer',
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};

export default SidePanel;

/** Helper: renders a labeled field row inside a SidePanel */
export const PanelField: React.FC<{
  label: string;
  value?: React.ReactNode;
}> = ({ label, value }) => {
  const t = useThemeTokens();
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: t.text3, letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: t.text1 }}>
        {value ?? <span style={{ color: t.text4 }}>—</span>}
      </div>
    </div>
  );
};
