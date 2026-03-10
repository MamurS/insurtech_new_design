import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
  padding?: number | string;
}

const Card: React.FC<CardProps> = ({ children, style: sx, className, onClick, padding = 22 }) => {
  const t = useThemeTokens();

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: t.bgPanel,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        boxShadow: t.shadow,
        padding,
        ...sx,
      }}
    >
      {children}
    </div>
  );
};

export default Card;
