import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../theme/useTheme';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ContextBarProps {
  status?: string;
  breadcrumbs: BreadcrumbItem[];
}

export const ContextBar: React.FC<ContextBarProps> = ({ status, breadcrumbs }) => {
  const { t } = useTheme();

  const getStatusStyle = (s: string): React.CSSProperties => {
    switch (s?.toUpperCase()) {
      case 'DRAFT':
        return { background: t.bgCard, color: t.text3, border: '1px solid ' + t.borderL };
      case 'PENDING':
        return { background: t.warningBg, color: t.warning, border: '1px solid ' + t.warning + '60' };
      case 'ACTIVE':
        return { background: t.successBg, color: t.success, border: '1px solid ' + t.success + '60' };
      case 'EXPIRED':
      case 'CANCELLED':
        return { background: t.dangerBg, color: t.danger, border: '1px solid ' + t.danger + '60' };
      default:
        return { background: t.bgCard, color: t.text3, border: '1px solid ' + t.borderL };
    }
  };

  return (
    <div className="px-6 py-3 mb-6" style={{ background: t.bgCard, borderBottom: '1px solid ' + t.border }}>
      <div className="flex items-center gap-2 text-sm">
        {status && (
          <>
            <span
              className="px-2.5 py-1 text-xs font-medium rounded"
              style={getStatusStyle(status)}
            >
              {status}
            </span>
            <ChevronRight className="w-4 h-4" style={{ color: t.text5 }} />
          </>
        )}

        {breadcrumbs.map((item, index) => (
          <React.Fragment key={index}>
            {item.href ? (
              <Link
                to={item.href}
                className="transition-colors"
                style={{ color: t.text4 }}
              >
                {item.label}
              </Link>
            ) : (
              <span className="font-medium" style={{ color: t.text1 }}>{item.label}</span>
            )}
            {index < breadcrumbs.length - 1 && (
              <ChevronRight className="w-4 h-4" style={{ color: t.text5 }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ContextBar;
