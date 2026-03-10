import React, { useCallback, useRef } from 'react';
import { useTheme } from '../theme/useTheme';

interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  label?: string;
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  colorMap?: Record<string, React.CSSProperties>; // value → inline styles for selected state
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

// Default color map for common values (now returns inline style objects)
const getDefaultStyles = (t: any): Record<string, React.CSSProperties> => ({
  FAC: { background: t.warning, color: '#fff', boxShadow: t.shadow },
  fac: { background: t.warning, color: '#fff', boxShadow: t.shadow },
  TREATY: { background: t.success, color: '#fff', boxShadow: t.shadow },
  treaty: { background: t.success, color: '#fff', boxShadow: t.shadow },
  PROPORTIONAL: { background: t.accent, color: '#fff', boxShadow: t.shadow },
  proportional: { background: t.accent, color: '#fff', boxShadow: t.shadow },
  NON_PROPORTIONAL: { background: '#7c3aed', color: '#fff', boxShadow: t.shadow },
  'non-proportional': { background: '#7c3aed', color: '#fff', boxShadow: t.shadow },
  DRAFT: { background: t.text4, color: '#fff', boxShadow: t.shadow },
  draft: { background: t.text4, color: '#fff', boxShadow: t.shadow },
  PENDING: { background: t.warning, color: '#fff', boxShadow: t.shadow },
  pending: { background: t.warning, color: '#fff', boxShadow: t.shadow },
  ACTIVE: { background: t.success, color: '#fff', boxShadow: t.shadow },
  active: { background: t.success, color: '#fff', boxShadow: t.shadow },
});

const sizeConfig = {
  sm: {
    padding: 'px-3',
    text: 'text-xs',
    gap: 'gap-1.5',
    container: 'p-1 h-8',
    buttonHeight: 'h-6'
  },
  md: {
    padding: 'px-4',
    text: 'text-sm',
    gap: 'gap-2',
    container: 'p-1 h-10',
    buttonHeight: 'h-8'
  }
};

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  label,
  options,
  value,
  onChange,
  colorMap,
  size = 'md',
  disabled = false,
  className = ''
}) => {
  const { t } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const config = sizeConfig[size];

  // Merge default colors with custom colorMap
  const defaultStyles = getDefaultStyles(t);
  const mergedColorMap = { ...defaultStyles, ...colorMap };

  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    if (disabled) return;

    let newIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + options.length) % options.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = options.length - 1;
    }

    if (newIndex !== currentIndex) {
      onChange(options[newIndex].value);
      // Focus the new button
      const buttons = containerRef.current?.querySelectorAll('button');
      buttons?.[newIndex]?.focus();
    }
  }, [disabled, onChange, options]);

  const getSelectedStyle = (optionValue: string): React.CSSProperties => {
    return mergedColorMap[optionValue] || { background: t.accent, color: '#fff', boxShadow: t.shadow };
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium mb-1.5" style={{ color: t.text4 }}>
          {label}
        </label>
      )}
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label={label}
        className={`
          inline-flex items-center
          ${config.container}
          rounded-lg
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{ borderColor: t.border, border: `1px solid ${t.border}`, background: t.bgCard }}
      >
        {options.map((option, index) => {
          const isSelected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              disabled={disabled}
              onClick={() => !disabled && onChange(option.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`
                ${config.padding}
                ${config.text}
                ${config.buttonHeight}
                inline-flex items-center justify-center ${config.gap}
                font-medium rounded-md
                transition-all duration-150
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
              style={isSelected ? getSelectedStyle(option.value) : { color: t.text3 }}
            >
              {option.icon && <span className="w-4 h-4 flex items-center justify-center">{option.icon}</span>}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SegmentedControl;
