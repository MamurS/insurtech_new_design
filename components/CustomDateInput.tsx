
import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, parseDateInput, maskDateInput, getStoredDateFormat } from '../utils/dateUtils';

interface CustomDateInputProps {
    label?: string;
    name: string;
    value: string | undefined;
    onChange: (e: { target: { name: string, value: string } }) => void;
    required?: boolean;
    placeholder?: string;
}

export const CustomDateInput: React.FC<CustomDateInputProps> = ({ label, name, value, onChange, required, placeholder }) => {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    
    // Calendar View State
    const [viewDate, setViewDate] = useState(new Date());
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Initialize display value from prop
    useEffect(() => {
        const formatted = value ? formatDate(value) : '';
        setInputValue(formatted);
        
        // If value exists, set calendar view to that date
        if (value) {
            const dateObj = new Date(value);
            if (!isNaN(dateObj.getTime())) {
                setViewDate(dateObj);
            }
        }
    }, [value]);

    // Handle Outside Click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const masked = maskDateInput(raw); // Use utility to auto-insert separators
        setInputValue(masked);

        // Attempt to parse
        const isoDate = parseDateInput(masked);
        
        // Open calendar to show feedback if user is typing numbers
        if (masked.length > 0 && !isOpen) setIsOpen(true);

        if (isoDate) {
            // If valid date, update parent and calendar view
            const dateObj = new Date(isoDate);
            setViewDate(dateObj);
            onChange({ target: { name, value: isoDate } });
        } else if (masked === '') {
            onChange({ target: { name, value: '' } });
        }
    };

    const handleDayClick = (day: number) => {
        const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
        // Adjust for timezone offset to ensure YYYY-MM-DD matches local selection
        const offsetDate = new Date(newDate.getTime() - (newDate.getTimezoneOffset() * 60000));
        const isoString = offsetDate.toISOString().split('T')[0];
        
        onChange({ target: { name, value: isoString } });
        setInputValue(formatDate(isoString));
        setIsOpen(false);
    };

    const changeMonth = (delta: number) => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
    };

    // --- Calendar Rendering Logic ---
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // Adjust for Monday start if needed, currently Sunday=0
    };

    const daysInCurrentMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()); // 0=Sun, 1=Mon...
    
    // Check if a day is the currently selected value
    const isSelected = (day: number) => {
        if (!value) return false;
        const target = new Date(value);
        return target.getDate() === day && 
               target.getMonth() === viewDate.getMonth() && 
               target.getFullYear() === viewDate.getFullYear();
    };

    const isToday = (day: number) => {
        const today = new Date();
        return day === today.getDate() && 
               viewDate.getMonth() === today.getMonth() && 
               viewDate.getFullYear() === today.getFullYear();
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div className="w-full" ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>}
            <div className="relative">
                <input
                    type="text"
                    name={name}
                    value={inputValue}
                    onChange={handleTextChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder || getStoredDateFormat().toLowerCase()}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm text-gray-900 pr-10 font-mono"
                    autoComplete="off"
                    maxLength={10}
                    required={required}
                />
                <button 
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 p-1 rounded-full transition-colors"
                    tabIndex={-1}
                >
                    <CalendarIcon size={18} />
                </button>

                {/* Custom Calendar Dropdown */}
                {isOpen && (
                    <div className="absolute z-[100] mt-1 p-4 bg-white border border-gray-200 rounded-xl shadow-xl w-72 animate-in fade-in zoom-in-95 duration-100 select-none right-0 sm:left-0 sm:right-auto">
                        
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <button type="button" onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded text-gray-600"><ChevronLeft size={20}/></button>
                            <span className="font-bold text-gray-800">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                            <button type="button" onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded text-gray-600"><ChevronRight size={20}/></button>
                        </div>

                        {/* Weekdays */}
                        <div className="grid grid-cols-7 text-center mb-2">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                <span key={d} className="text-xs font-medium text-gray-400 uppercase">{d}</span>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {/* Empty cells for padding */}
                            {Array.from({ length: firstDay === -1 ? 6 : firstDay }).map((_, i) => (
                                <div key={`empty-${i}`} />
                            ))}
                            
                            {/* Days */}
                            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                                const day = i +1;
                                const selected = isSelected(day);
                                const today = isToday(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => handleDayClick(day)}
                                        className={`
                                            h-9 w-9 rounded-lg text-sm flex items-center justify-center transition-colors
                                            ${selected ? 'bg-blue-600 text-white font-bold shadow-md' : 'text-gray-700 hover:bg-blue-50'}
                                            ${today && !selected ? 'border border-blue-300 font-bold text-blue-600' : ''}
                                        `}
                                    >
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
