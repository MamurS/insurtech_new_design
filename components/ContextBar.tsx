import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ContextBarProps {
  status?: string;
  breadcrumbs: BreadcrumbItem[];
}

const getStatusStyle = (status: string) => {
  switch (status?.toUpperCase()) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-600 border border-slate-300';
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 border border-amber-300';
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-300';
    case 'EXPIRED':
    case 'CANCELLED':
      return 'bg-red-50 text-red-600 border border-red-300';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-300';
  }
};

export const ContextBar: React.FC<ContextBarProps> = ({ status, breadcrumbs }) => {
  return (
    <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 mb-6">
      <div className="flex items-center gap-2 text-sm">
        {status && (
          <>
            <span className={`px-2.5 py-1 text-xs font-medium rounded ${getStatusStyle(status)}`}>
              {status}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </>
        )}

        {breadcrumbs.map((item, index) => (
          <React.Fragment key={index}>
            {item.href ? (
              <Link
                to={item.href}
                className="text-slate-500 hover:text-blue-600 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-900 font-medium">{item.label}</span>
            )}
            {index < breadcrumbs.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ContextBar;
