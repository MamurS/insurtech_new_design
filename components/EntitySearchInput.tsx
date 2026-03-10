import React, { useState, useEffect, useRef } from 'react';
import { DB } from '../services/db';
import { LegalEntity } from '../types';
import { Search, ChevronDown, Building2, Loader2 } from 'lucide-react';
import { formatSICDisplay } from '../data/sicCodes';
import { useTheme } from '../theme/useTheme';

interface EntitySearchInputProps {
    label: string;
    value: string;
    onChange: (entityName: string, entityId?: string) => void;
    onEntitySelect?: (entity: LegalEntity) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export const EntitySearchInput: React.FC<EntitySearchInputProps> = ({
    label,
    value,
    onChange,
    onEntitySelect,
    placeholder = "Type to search legal entities...",
    required = false,
    className = ""
}) => {
    const { t } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [entities, setEntities] = useState<LegalEntity[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(value || '');
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Fetch entities on mount
    useEffect(() => {
        const loadEntities = async () => {
            setLoading(true);
            try {
                const data = await DB.getLegalEntities();
                setEntities(data);
            } catch (err) {
                console.error('Failed to load entities:', err);
            } finally {
                setLoading(false);
            }
        };
        loadEntities();
    }, []);

    // Sync searchTerm with external value
    useEffect(() => {
        setSearchTerm(value || '');
    }, [value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Filter entities based on search term (name or code)
    const filteredEntities = entities.filter(entity => {
        const term = searchTerm.toLowerCase();
        return (
            entity.fullName?.toLowerCase().includes(term) ||
            entity.shortName?.toLowerCase().includes(term) ||
            entity.regCodeValue?.toLowerCase().includes(term)
        );
    });

    const handleSelect = (entity: LegalEntity) => {
        setSearchTerm(entity.fullName);
        onChange(entity.fullName, entity.id);
        onEntitySelect?.(entity);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setSearchTerm(newValue);
        onChange(newValue, undefined);
        setIsOpen(true);
    };

    return (
        <div className={`relative w-full ${className}`} ref={wrapperRef}>
            <label className="block text-sm font-medium mb-1.5" style={{ color: t.text3 }}>
                {label} {required && <span style={{ color: t.danger }}>*</span>}
            </label>
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onClick={() => setIsOpen(true)}
                    required={required}
                    placeholder={placeholder}
                    autoComplete="off"
                    className="w-full p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm pr-8"
                    style={{ background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1 }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.text4 }}>
                    {loading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : isOpen ? (
                        <Search size={14} />
                    ) : (
                        <ChevronDown size={14} />
                    )}
                </div>
            </div>

            {isOpen && !loading && (
                <ul
                    className="absolute z-50 w-full rounded-lg mt-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
                    style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadowMd }}
                >
                    {filteredEntities.length > 0 ? (
                        filteredEntities.map((entity) => (
                            <li
                                key={entity.id}
                                onClick={() => handleSelect(entity)}
                                className="px-3 py-2 text-sm cursor-pointer last:border-0"
                                style={{ borderBottom: `1px solid ${t.border}` }}
                            >
                                <div className="flex items-center gap-2">
                                    <Building2 size={14} className="shrink-0" style={{ color: t.text4 }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate" style={{ color: t.text1 }}>
                                            {entity.fullName}
                                        </div>
                                        {(entity.shortName || entity.regCodeValue || entity.sicCode) && (
                                            <div className="text-xs truncate" style={{ color: t.text4 }}>
                                                {entity.shortName && <span>{entity.shortName}</span>}
                                                {entity.shortName && entity.regCodeValue && <span> | </span>}
                                                {entity.regCodeValue && <span>INN: {entity.regCodeValue}</span>}
                                                {entity.sicCode && (
                                                    <span className="ml-1" style={{ color: t.accent }}>
                                                        &bull; {formatSICDisplay(entity.sicCode)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))
                    ) : (
                        <li className="px-3 py-4 text-sm text-center" style={{ color: t.text4 }}>
                            {searchTerm ? (
                                <div>
                                    <p>No entities found matching "{searchTerm}"</p>
                                    <p className="text-xs mt-1">Please add the entity in Entity Manager first</p>
                                </div>
                            ) : (
                                <div>
                                    <p>No entities in database</p>
                                    <p className="text-xs mt-1">Add entities via Entity Manager</p>
                                </div>
                            )}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default EntitySearchInput;
