
import React from 'react';
import DatePicker from 'react-datepicker';
import { getStoredDateFormat } from '../utils/dateUtils';

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

export const CompactDateFilter: React.FC<Props> = ({ value, onChange, placeholder = 'dd.mm.yyyy' }) => {
    const format = getPickerFormat();
    return (
        <div style={{ width: '120px' }} className="flex-shrink-0">
            <DatePicker
                selected={value}
                onChange={onChange}
                dateFormat={format}
                placeholderText={placeholder}
                className="w-full px-2 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700"
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
