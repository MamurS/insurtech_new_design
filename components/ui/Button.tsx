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
    sm: { padding: '5px 10px', fontSize: 11 },
    md: { padding: '7px 14px', fontSize: 12 },
    lg: { padding: '10px 20px', fontSize: 13 },
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: t.accent, color: '#fff' },
    ghost: { background: 'transparent', color: t.text2, border: `1px solid ${t.border}` },
    danger: { background: t.dangerBg, color: t.danger },
    success: { background: t.successBg, color: t.success },
  };

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 7,
    fontWeight: 600,
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
