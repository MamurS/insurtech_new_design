import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  col?: number;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, required, hint, col = 1, children }) => {
  const t = useThemeTokens();

  return (
    <div style={{ gridColumn: `span ${col}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <label style={{ fontSize: 11, color: t.text3, fontWeight: 500, letterSpacing: '0.3px' }}>{label}</label>
        {required && <span style={{ color: t.danger, fontSize: 11 }}>*</span>}
        {hint && <span style={{ fontSize: 10, color: t.text5, marginLeft: 4 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
};

export default Field;
