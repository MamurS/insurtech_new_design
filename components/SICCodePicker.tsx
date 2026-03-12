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
    <div ref={wrapperRef} className={className} style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', padding: 10, borderRadius: 8, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 42, background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1 }}
      >
        <span style={{ color: displayValue ? t.text1 : t.text4 }}>
          {displayValue || 'Select industry classification...'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, flexShrink: 0 }}>
          {sicCode && (
            <button onClick={handleClear} style={{ padding: 2, borderRadius: 4 }}>
              <X size={14} style={{ color: t.text4 }} />
            </button>
          )}
          <ChevronDown size={14} style={{ color: t.text4 }} />
        </div>
      </div>

      {isOpen && (
        <div
          style={{ position: 'absolute', zIndex: 50, width: '100%', borderRadius: 8, marginTop: 4, overflow: 'hidden', background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadowMd }}
        >
          {/* Search */}
          <div style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} className="-translate-y-1/2" style={{ position: 'absolute', left: 10, top: '50%', color: t.text4 }} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code or description..."
                style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 6, fontSize: 14, border: `1px solid ${t.border}`, outline: 'none' }}
              />
            </div>
          </div>

          {/* Results */}
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {filteredCodes ? (
              // Search results mode
              filteredCodes.length > 0 ? (
                filteredCodes.map(c => (
                  <button
                    key={c.code}
                    onClick={() => handleSelect(c.code, c.section)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      paddingLeft: 12,
                      paddingRight: 12,
                      paddingTop: 8,
                      paddingBottom: 8,
                      fontSize: 14,
                      borderBottom: `1px solid ${t.border}`,
                      ...(c.code === sicCode
                        ? { background: t.accent + '18', color: t.accent }
                        : { color: t.text2 }),
                    }}
                  >
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginRight: 8, color: t.text4 }}>{c.code}</span>
                    {c.description}
                  </button>
                ))
              ) : (
                <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 24, paddingBottom: 24, fontSize: 14, textAlign: 'center', color: t.text4 }}>
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
                      style={{ width: '100%', textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, background: t.bgCard, borderBottom: `1px solid ${t.border}` }}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, width: 16, color: t.text4 }}>{section.code}</span>
                      <span style={{ color: t.text2 }}>{section.title}</span>
                      <span style={{ fontSize: 12, marginLeft: 'auto', color: t.text4 }}>{sectionCodes.length}</span>
                    </button>
                    {isExpanded && sectionCodes.map(c => (
                      <button
                        key={c.code}
                        onClick={() => handleSelect(c.code, c.section)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          paddingLeft: 40,
                          paddingRight: 12,
                          paddingTop: 6,
                          paddingBottom: 6,
                          fontSize: 14,
                          borderBottom: `1px solid ${t.border}`,
                          ...(c.code === sicCode
                            ? { background: t.accent + '18', color: t.accent }
                            : { color: t.text3 }),
                        }}
                      >
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginRight: 8, color: t.text4 }}>{c.code}</span>
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
