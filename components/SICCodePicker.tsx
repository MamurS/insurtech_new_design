import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, X } from 'lucide-react';
import { SIC_SECTIONS, SIC_CODES, formatSICDisplay } from '../data/sicCodes';

interface SICCodePickerProps {
  sicCode: string;
  sicSection: string;
  onChange: (sicCode: string, sicSection: string) => void;
  className?: string;
}

export const SICCodePicker: React.FC<SICCodePickerProps> = ({ sicCode, sicSection, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const filteredCodes = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return SIC_CODES.filter(c =>
      c.code.includes(q) || c.description.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [search]);

  const toggleSection = (sectionCode: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionCode)) next.delete(sectionCode);
      else next.add(sectionCode);
      return next;
    });
  };

  const handleSelect = (code: string, section: string) => {
    onChange(code, section);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', '');
  };

  const displayValue = sicCode ? formatSICDisplay(sicCode) : '';

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 outline-none transition-all text-sm text-gray-900 cursor-pointer flex items-center justify-between min-h-[42px]"
      >
        <span className={displayValue ? 'text-gray-900 truncate' : 'text-gray-400'}>
          {displayValue || 'Select industry classification...'}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {sicCode && (
            <button onClick={handleClear} className="p-0.5 hover:bg-gray-100 rounded">
              <X size={14} className="text-gray-400" />
            </button>
          )}
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code or description..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-y-auto">
            {filteredCodes ? (
              // Search results mode
              filteredCodes.length > 0 ? (
                filteredCodes.map(c => (
                  <button
                    key={c.code}
                    onClick={() => handleSelect(c.code, c.section)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0 ${
                      c.code === sicCode ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span className="font-mono text-xs text-gray-500 mr-2">{c.code}</span>
                    {c.description}
                  </button>
                ))
              ) : (
                <div className="px-3 py-6 text-sm text-gray-400 text-center">
                  No codes matching "{search}"
                </div>
              )
            ) : (
              // Browse by section mode
              SIC_SECTIONS.map(section => {
                const isExpanded = expandedSections.has(section.code);
                const sectionCodes = SIC_CODES.filter(c => c.section === section.code);
                return (
                  <div key={section.code}>
                    <button
                      onClick={() => toggleSection(section.code)}
                      className="w-full text-left px-3 py-2 text-sm font-medium bg-gray-50 hover:bg-gray-100 flex items-center gap-2 border-b border-gray-100"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="font-mono text-xs text-gray-400 w-4">{section.code}</span>
                      <span className="text-gray-700">{section.title}</span>
                      <span className="text-xs text-gray-400 ml-auto">{sectionCodes.length}</span>
                    </button>
                    {isExpanded && sectionCodes.map(c => (
                      <button
                        key={c.code}
                        onClick={() => handleSelect(c.code, c.section)}
                        className={`w-full text-left pl-10 pr-3 py-1.5 text-sm hover:bg-blue-50 border-b border-gray-50 ${
                          c.code === sicCode ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
                        }`}
                      >
                        <span className="font-mono text-xs text-gray-400 mr-2">{c.code}</span>
                        {c.description}
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
