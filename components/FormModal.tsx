import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const FormModal: React.FC<FormModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children
}) => {
  const { t } = useTheme();
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative rounded-2xl w-full max-w-6xl mx-4 my-auto min-h-0" style={{ background: t.bgPanel, boxShadow: t.shadowLg }}>
        {/* Header */}
        <div className="sticky top-0 z-10 rounded-t-2xl border-b px-6 py-4 flex items-center justify-between" style={{ background: t.bgPanel, borderColor: t.border }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: t.text1 }}>{title}</h2>
            {subtitle && <p className="text-sm mt-0.5" style={{ color: t.text4 }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: t.text4 }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-6 max-h-[calc(100vh-10rem)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FormModal;
