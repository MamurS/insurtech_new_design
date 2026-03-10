
import React from 'react';
import DatePicker from 'react-datepicker';
import { getStoredDateFormat } from '../utils/dateUtils';
import { useTheme } from '../theme/useTheme';

const getPickerFormat = (): string => {
    const appFormat = getStoredDateFormat();
    const formatMap: Record<string, string> = {
        'dd.mm.yyyy': 'dd.MM.yyyy',
        'dd/mm/yyyy': 'dd/MM/yyyy',
        'mm/dd/yyyy': 'MM/dd/yyyy',
        'mm.dd.yyyy': 'MM.dd.yyyy',
        'dd-mm-yyyy': 'dd-MM-yyyy',
        'mm-dd-yyyy': 'MM-dd-yyyy'
    };
    return formatMap[appFormat] || 'dd.MM.yyyy';
};

interface Props {
    value: Date | null;
    onChange: (date: Date | null) => void;
    placeholder?: string;
}

const CompactDateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { t: any }>(
    ({ t, ...props }, ref) => (
        <input
            ref={ref}
            {...props}
            className="w-full px-2 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text2 }}
        />
    )
);

export const CompactDateFilter: React.FC<Props> = ({ value, onChange, placeholder = 'dd.mm.yyyy' }) => {
    const { t } = useTheme();
    const format = getPickerFormat();
    return (
        <div style={{ width: '120px' }} className="flex-shrink-0">
            <DatePicker
                selected={value}
                onChange={onChange}
                dateFormat={format}
                placeholderText={placeholder}
                customInput={<CompactDateInput t={t} />}
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                autoComplete="off"
                popperProps={{ strategy: 'fixed' }}
                isClearable
            />
        </div>
    );
};
