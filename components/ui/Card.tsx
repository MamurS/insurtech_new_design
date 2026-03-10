import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, style: sx, className, onClick }) => {
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
        ...sx,
      }}
    >
      {children}
    </div>
  );
};

export default Card;
