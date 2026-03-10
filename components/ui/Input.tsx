import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string | number;
  onChange?: (value: string) => void;
  onNativeChange?: React.ChangeEventHandler<HTMLInputElement>;
}

const Input: React.FC<InputProps> = ({
  value,
  onChange,
  onNativeChange,
  placeholder,
  type = 'text',
  disabled,
  style: sx,
  ...rest
}) => {
  const t = useThemeTokens();

  return (
    <input
      {...rest}
      type={type}
      value={value}
      onChange={e => {
        if (onNativeChange) onNativeChange(e);
        else if (onChange) onChange(e.target.value);
      }}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '10px 14px',
        borderRadius: 8,
        background: disabled ? t.bgInputDis : t.bgInput,
        border: `1px solid ${t.border}`,
        color: disabled ? t.text4 : t.text1,
        fontSize: 13,
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s',
        fontFamily: 'inherit',
        ...sx,
      }}
      onFocus={e => (e.target.style.borderColor = t.accent)}
      onBlur={e => (e.target.style.borderColor = t.border)}
    />
  );
};

export default Input;
