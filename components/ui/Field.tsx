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
        <label style={{ fontSize: 12, color: t.text2, fontWeight: 500, letterSpacing: '0.3px' }}>{label}</label>
        {required && <span style={{ color: t.danger, fontSize: 12 }}>*</span>}
        {hint && <span style={{ fontSize: 11, color: t.text4, marginLeft: 4 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
};

export default Field;
