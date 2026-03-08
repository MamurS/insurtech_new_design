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
      marginBottom: 14,
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${t.border}`,
        borderLeft: `3px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {icon}
        <div>
          <div style={{ fontWeight: 600, color: t.text1, fontSize: 13 }}>{title}</div>
          {subtitle && <div style={{ color: t.text4, fontSize: 11, marginTop: 1 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
};

export default SectionCard;
