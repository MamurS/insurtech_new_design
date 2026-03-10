import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, X } from 'lucide-react';
import { SIC_SECTIONS, SIC_CODES, formatSICDisplay } from '../data/sicCodes';
import { useTheme } from '../theme/useTheme';

interface SICCodePickerProps {
  sicCode: string;
  sicSection: string;
  onChange: (sicCode: string, sicSection: string) => void;
  className?: string;
}

export const SICCodePicker: React.FC<SICCodePickerProps> = ({ sicCode, sicSection, onChange, className = '' }) => {
  const { t } = useTheme();
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
        className="w-full p-2.5 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 outline-none transition-all text-sm cursor-pointer flex items-center justify-between min-h-[42px]"
        style={{ background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1 }}
      >
        <span style={{ color: displayValue ? t.text1 : t.text4 }}>
          {displayValue || 'Select industry classification...'}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {sicCode && (
            <button onClick={handleClear} className="p-0.5 rounded">
              <X size={14} style={{ color: t.text4 }} />
            </button>
          )}
          <ChevronDown size={14} style={{ color: t.text4 }} />
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute z-50 w-full rounded-lg mt-1 overflow-hidden"
          style={{ background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadowMd }}
        >
          {/* Search */}
          <div className="p-2" style={{ borderBottom: `1px solid ${t.border}` }}>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: t.text4 }} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code or description..."
                className="w-full pl-8 pr-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                style={{ border: `1px solid ${t.border}` }}
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
                    className="w-full text-left px-3 py-2 text-sm last:border-0"
                    style={{
                      borderBottom: `1px solid ${t.border}`,
                      ...(c.code === sicCode
                        ? { background: t.accent + '18', color: t.accent }
                        : { color: t.text2 }),
                    }}
                  >
                    <span className="font-mono text-xs mr-2" style={{ color: t.text4 }}>{c.code}</span>
                    {c.description}
                  </button>
                ))
              ) : (
                <div className="px-3 py-6 text-sm text-center" style={{ color: t.text4 }}>
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
                      className="w-full text-left px-3 py-2 text-sm font-medium flex items-center gap-2"
                      style={{ background: t.bgCard, borderBottom: `1px solid ${t.border}` }}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className="font-mono text-xs w-4" style={{ color: t.text4 }}>{section.code}</span>
                      <span style={{ color: t.text2 }}>{section.title}</span>
                      <span className="text-xs ml-auto" style={{ color: t.text4 }}>{sectionCodes.length}</span>
                    </button>
                    {isExpanded && sectionCodes.map(c => (
                      <button
                        key={c.code}
                        onClick={() => handleSelect(c.code, c.section)}
                        className="w-full text-left pl-10 pr-3 py-1.5 text-sm"
                        style={{
                          borderBottom: `1px solid ${t.border}`,
                          ...(c.code === sicCode
                            ? { background: t.accent + '18', color: t.accent }
                            : { color: t.text3 }),
                        }}
                      >
                        <span className="font-mono text-xs mr-2" style={{ color: t.text4 }}>{c.code}</span>
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
