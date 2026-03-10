import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
}

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  style: sx,
  ...rest
}) => {
  const t = useThemeTokens();

  return (
    <select
      {...rest}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: 8,
        background: t.bgInput,
        border: `1px solid ${t.border}`,
        color: value ? t.text1 : t.text4,
        fontSize: 13,
        outline: 'none',
        fontFamily: 'inherit',
        ...sx,
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return <option key={val} value={val}>{label}</option>;
      })}
    </select>
  );
};

export default Select;
