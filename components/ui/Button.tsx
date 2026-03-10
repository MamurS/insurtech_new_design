import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  style: sx,
  ...rest
}) => {
  const t = useThemeTokens();

  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12 },
    md: { padding: '10px 18px', fontSize: 13 },
    lg: { padding: '12px 24px', fontSize: 14 },
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: t.accent, color: '#fff' },
    ghost: { background: 'transparent', color: t.text2, border: `1px solid ${t.border}` },
    danger: { background: `${t.danger}18`, color: t.danger },
    success: { background: `${t.success}18`, color: t.success },
  };

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    fontWeight: variant === 'primary' ? 600 : 500,
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    ...sizes[size],
    ...variants[variant],
    ...sx,
  };

  return (
    <button
      {...rest}
      style={base}
      onMouseEnter={e => {
        if (variant === 'primary') (e.currentTarget as HTMLElement).style.background = t.accentHover;
        else (e.currentTarget as HTMLElement).style.background = t.bgHover;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = variants[variant].background as string;
      }}
    >
      {icon}{children}
    </button>
  );
};

export default Button;
