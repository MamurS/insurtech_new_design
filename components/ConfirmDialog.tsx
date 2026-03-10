import React from 'react';
import { AlertTriangle, Trash2, HelpCircle, Info } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

type ConfirmVariant = 'danger' | 'warning' | 'info' | 'default';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
}

const getVariantConfig = (t: any) => ({
  danger: {
    icon: Trash2,
    iconBgStyle: { background: t.danger + '18' },
    iconColorStyle: { color: t.danger },
    confirmBgStyle: { background: t.danger, color: '#fff' },
  },
  warning: {
    icon: AlertTriangle,
    iconBgStyle: { background: t.warning + '18' },
    iconColorStyle: { color: t.warning },
    confirmBgStyle: { background: t.warning, color: '#fff' },
  },
  info: {
    icon: Info,
    iconBgStyle: { background: t.accent + '18' },
    iconColorStyle: { color: t.accent },
    confirmBgStyle: { background: t.accent, color: '#fff' },
  },
  default: {
    icon: HelpCircle,
    iconBgStyle: { background: t.bgCard },
    iconColorStyle: { color: t.text3 },
    confirmBgStyle: { background: t.accent, color: '#fff' },
  }
});

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false
}) => {
  const { t } = useTheme();

  if (!isOpen) return null;

  const variantConfig = getVariantConfig(t);
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { e.stopPropagation(); if (!isLoading) onCancel(); }}
    >
      <div
        className="rounded-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200 border"
        style={{ background: t.bgPanel, boxShadow: t.shadowLg, borderColor: t.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full" style={config.iconBgStyle}>
              <Icon className="w-6 h-6" style={config.iconColorStyle} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1" style={{ color: t.text1 }}>{title}</h3>
              <p className="leading-relaxed text-sm" style={{ color: t.text3 }}>{message}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 flex justify-end gap-3 border-t" style={{ background: t.bgCard, borderColor: t.border }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ color: t.text2 }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            style={{ ...config.confirmBgStyle, boxShadow: t.shadow }}
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
