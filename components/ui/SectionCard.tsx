import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, subtitle, icon, color = '#2563eb', children }) => {
  const t = useThemeTokens();

  return (
    <div style={{
      background: t.bgPanel,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      <div style={{
        padding: '16px 22px',
        borderBottom: `1px solid ${t.border}`,
        borderLeft: `3px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {icon && <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <div>
          <div style={{ fontWeight: 600, color: t.text1, fontSize: 15 }}>{title}</div>
          {subtitle && <div style={{ color: t.text4, fontSize: 12, marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </div>
  );
};

export default SectionCard;
