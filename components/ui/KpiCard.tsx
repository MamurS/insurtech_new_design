import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  up?: boolean | null;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  delta,
  up,
  sub,
  color = '#2563eb',
  icon,
}) => {
  const t = useThemeTokens();

  return (
    <div style={{
      background: t.bgPanel,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: t.shadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: t.text3, fontWeight: 500, letterSpacing: '0.5px' }}>{label}</div>
        {icon && (
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: `${color}12`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {icon}
          </div>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: t.text1, marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {delta && (
          <span style={{
            fontSize: 12,
            color: up === true ? t.success : up === false ? t.danger : t.accent,
            fontWeight: 600,
          }}>
            {up === true ? '↑' : up === false ? '↓' : '→'} {delta}
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: t.text4 }}>· {sub}</span>}
      </div>
      <div style={{
        position: 'absolute',
        right: -8,
        bottom: -8,
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: `${color}06`,
      }} />
    </div>
  );
};

export default KpiCard;
