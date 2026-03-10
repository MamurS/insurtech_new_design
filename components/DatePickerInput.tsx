
import React from 'react';
import DatePicker from 'react-datepicker';
import { getStoredDateFormat } from '../utils/dateUtils';
import { Calendar } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

interface DatePickerInputProps {
    value: Date | null;
    onChange: (date: Date | null) => void;
    placeholder?: string;
    className?: string;
    minDate?: Date;
    maxDate?: Date;
    disabled?: boolean;
    required?: boolean;
    label?: string;
    wrapperClassName?: string;
}

// Convert app date format to react-datepicker format
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

const ThemedDateInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { themeStyles: React.CSSProperties; extraClass: string }>(
    ({ themeStyles, extraClass, ...props }, ref) => (
        <input ref={ref} {...props} className={`${props.className || ''} ${extraClass}`} style={themeStyles} />
    )
);

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
    value,
    onChange,
    placeholder,
    className = '',
    minDate,
    maxDate,
    disabled = false,
    required = false,
    label,
    wrapperClassName = ''
}) => {
    const { t } = useTheme();
    const format = getPickerFormat();

    React.useEffect(() => {
        if (!document.getElementById('datepicker-portal')) {
            const div = document.createElement('div');
            div.id = 'datepicker-portal';
            document.body.appendChild(div);
        }
    }, []);

    const inputStyles: React.CSSProperties = {
        background: disabled ? t.bgCard : t.bgPanel,
        border: `1px solid ${t.border}`,
        color: t.text1,
    };

    return (
        <div className={`${wrapperClassName || 'w-full'} flex-shrink-0`}>
            {label && <label className="block text-sm font-medium mb-1.5" style={{ color: t.text3 }}>{label} {required && <span style={{ color: t.danger }}>*</span>}</label>}
            <div className="relative flex-shrink-0">
                <DatePicker
                    selected={value}
                    onChange={onChange}
                    dateFormat={format}
                    placeholderText={placeholder || format.toLowerCase()}
                    customInput={
                        <ThemedDateInput
                            themeStyles={inputStyles}
                            extraClass={`${!wrapperClassName ? 'w-full' : ''} p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${className} ${disabled ? 'cursor-not-allowed' : ''}`}
                        />
                    }
                    minDate={minDate}
                    maxDate={maxDate}
                    disabled={disabled}
                    required={required}
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    autoComplete="off"
                    strictParsing
                    popperPlacement="bottom-start"
                    popperProps={{ strategy: 'fixed' }}
                    portalId="datepicker-portal"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.text4 }}>
                    <Calendar size={16} />
                </div>
            </div>
        </div>
    );
};

// Helper to convert string date (YYYY-MM-DD) to Date object
export const parseDate = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    const d = new Date(dateString);
    // Adjust for timezone to avoid off-by-one errors when strictly treating as YYYY-MM-DD
    // But since inputs are usually local time 00:00:00, simple new Date(str) usually works if str is YYYY-MM-DD
    // However, safest for UI forms is to treat the YYYY-MM-DD string as local midnight
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    return isNaN(d.getTime()) ? null : d;
};

// Helper to convert Date to ISO string (YYYY-MM-DD) for database
export const toISODateString = (date: Date | null): string | null => {
    if (!date) return null;
    // Ensure we return YYYY-MM-DD in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default DatePickerInput;
