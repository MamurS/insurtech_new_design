import React from 'react';
import { useThemeTokens } from '../../theme/useTheme';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ open, onClose, title, width, size = 'md', children, footer }) => {
  const t = useThemeTokens();

  if (!open) return null;

  const sizeWidths = { sm: 500, md: 700, lg: 900 };
  const resolvedWidth = width || sizeWidths[size];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: resolvedWidth,
          maxWidth: '90vw',
          maxHeight: '85vh',
          background: t.bgPanel,
          border: `1px solid ${t.borderL}`,
          borderRadius: 12,
          boxShadow: t.shadowLg,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {title && (
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, color: t.text1, fontSize: 18 }}>{title}</span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: t.text4,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div style={{ overflow: 'auto', flex: 1, padding: 24, maxHeight: '70vh' }}>
          {children}
        </div>
        {footer && (
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${t.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
