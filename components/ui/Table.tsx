import React, { useState } from 'react';
import { useThemeTokens } from '../../theme/useTheme';

interface Column<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
}

function Table<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  onRowClick,
  selectedKey,
}: TableProps<T>) {
  const t = useThemeTokens();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  let sorted = data;
  if (sortKey) {
    sorted = [...data].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }

  const gridCols = columns.map(c => c.width || '1fr').join(' ');

  return (
    <div style={{
      background: t.bgPanel,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: t.shadow,
    }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        padding: '12px 20px',
        borderBottom: `1px solid ${t.border}`,
        color: t.text3,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
      }}>
        {columns.map(col => (
          <span
            key={col.key}
            onClick={col.sortable ? () => toggleSort(col.key) : undefined}
            style={{
              cursor: col.sortable ? 'pointer' : 'default',
              textAlign: col.align || 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
              gap: 4,
            }}
          >
            {col.label}
            {col.sortable && sortKey === col.key && (
              <span style={{ color: t.accent, fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
            )}
          </span>
        ))}
      </div>
      {/* Rows */}
      {sorted.map(row => {
        const key = String(row[keyField]);
        const isSelected = selectedKey === key;
        return (
          <div
            key={key}
            onClick={() => onRowClick?.(row)}
            style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              padding: '14px 20px',
              borderBottom: `1px solid ${t.borderS}`,
              cursor: onRowClick ? 'pointer' : 'default',
              background: isSelected ? t.bgActive : 'transparent',
              transition: 'background 0.12s',
              fontSize: 13,
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = t.bgHover; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
          >
            {columns.map(col => (
              <span
                key={col.key}
                style={{ textAlign: col.align || 'left', color: t.text1 }}
              >
                {col.render ? col.render(row) : row[col.key]}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default Table;
