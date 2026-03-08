import React, { useCallback, useRef } from 'react';

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
  colorMap?: Record<string, string>; // value → Tailwind classes for selected state
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

// Default color map for common values
const defaultColorMap: Record<string, string> = {
  // Contract Type
  FAC: 'bg-amber-500 text-white shadow-sm',
  fac: 'bg-amber-500 text-white shadow-sm',
  TREATY: 'bg-emerald-600 text-white shadow-sm',
  treaty: 'bg-emerald-600 text-white shadow-sm',
  // Structure
  PROPORTIONAL: 'bg-blue-600 text-white shadow-sm',
  proportional: 'bg-blue-600 text-white shadow-sm',
  NON_PROPORTIONAL: 'bg-violet-600 text-white shadow-sm',
  'non-proportional': 'bg-violet-600 text-white shadow-sm',
  // Status
  DRAFT: 'bg-slate-500 text-white shadow-sm',
  draft: 'bg-slate-500 text-white shadow-sm',
  PENDING: 'bg-amber-500 text-white shadow-sm',
  pending: 'bg-amber-500 text-white shadow-sm',
  ACTIVE: 'bg-emerald-600 text-white shadow-sm',
  active: 'bg-emerald-600 text-white shadow-sm',
};

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
  const containerRef = useRef<HTMLDivElement>(null);
  const config = sizeConfig[size];

  // Merge default colors with custom colorMap
  const mergedColorMap = { ...defaultColorMap, ...colorMap };

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

  const getSelectedStyle = (optionValue: string): string => {
    return mergedColorMap[optionValue] || 'bg-blue-600 text-white shadow-sm';
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-slate-500 mb-1.5">
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
          rounded-lg border border-slate-200 bg-slate-50
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
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
                ${isSelected
                  ? getSelectedStyle(option.value)
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
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
