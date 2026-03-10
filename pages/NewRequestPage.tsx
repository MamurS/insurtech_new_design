import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/useTheme';
import { usePageHeader } from '../context/PageHeaderContext';
import { NewRequestForm } from '../components/NewRequestForm';
import { InwardReinsuranceFormContent } from '../components/InwardReinsuranceFormContent';
import {
  FileText, Globe, Building2, ArrowLeft, CheckCircle2, Circle
} from 'lucide-react';

type RequestType = 'direct' | 'inward-foreign' | 'inward-domestic';

// ─── Progress Ring SVG ──────────────────────────────────────
const ProgressRing: React.FC<{ percent: number; size?: number; stroke?: number; color: string }> = ({
  percent,
  size = 100,
  stroke = 8,
  color,
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        opacity={0.12}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  );
};

// ─── Checklist items for Direct Insurance ───────────────────
const DIRECT_CHECKLIST = [
  { key: 'insured', label: 'Insured Party', section: 1 },
  { key: 'product', label: 'Insurance Cover', section: 2 },
  { key: 'channel', label: 'Channel & Intermediary', section: 3 },
  { key: 'sumInsured', label: 'Sums Insured', section: 4 },
  { key: 'limit', label: 'Limit of Liability', section: 5 },
  { key: 'period', label: 'Period', section: 6 },
  { key: 'deductibles', label: 'Deductibles', section: 7 },
  { key: 'premium', label: 'Premium', section: 8 },
  { key: 'payment', label: 'Payment Terms', section: 9 },
];

const INWARD_CHECKLIST = [
  { key: 'cedent', label: 'Cedent Details', section: 1 },
  { key: 'type', label: 'Type & Structure', section: 2 },
  { key: 'cover', label: 'Cover Details', section: 3 },
  { key: 'period', label: 'Period', section: 4 },
  { key: 'premium', label: 'Premium & Commission', section: 5 },
  { key: 'terms', label: 'Terms & Conditions', section: 6 },
];

const NewRequestPage: React.FC = () => {
  const { t } = useTheme();
  const navigate = useNavigate();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const [requestType, setRequestType] = useState<RequestType>('direct');
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());

  // Clear header
  useEffect(() => {
    setHeaderLeft(
      <button
        onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: t.text3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
      >
        <ArrowLeft size={16} /> Back
      </button>
    );
    setHeaderActions(null);
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [setHeaderActions, setHeaderLeft, t]);

  const handleSave = useCallback(() => {
    navigate('/direct-insurance');
  }, [navigate]);

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const checklist = requestType === 'direct' ? DIRECT_CHECKLIST : INWARD_CHECKLIST;
  const progress = checklist.length > 0 ? Math.round((completedSections.size / checklist.length) * 100) : 0;

  const typeCards: { key: RequestType; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'direct', label: 'Direct Insurance', icon: <FileText size={20} />, desc: 'New direct insurance policy' },
    { key: 'inward-foreign', label: 'Inward Foreign', icon: <Globe size={20} />, desc: 'Foreign reinsurance contract' },
    { key: 'inward-domestic', label: 'Inward Domestic', icon: <Building2 size={20} />, desc: 'Domestic reinsurance contract' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        height: 'calc(100vh - 82px)',
        gap: 0,
      }}
    >
      {/* Left — Scrollable Form */}
      <div style={{ overflow: 'auto', padding: 28 }}>
        {/* Page Title */}
        <h1 style={{ fontSize: 24, fontWeight: 700, color: t.text1, marginBottom: 20, letterSpacing: '-0.3px' }}>
          New Request
        </h1>

        {/* Type Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {typeCards.map(tc => (
            <button
              key={tc.key}
              onClick={() => { setRequestType(tc.key); setCompletedSections(new Set()); }}
              style={{
                padding: '16px 18px',
                borderRadius: 10,
                border: `2px solid ${requestType === tc.key ? t.accent : t.border}`,
                background: requestType === tc.key ? `${t.accent}12` : t.bgPanel,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ color: requestType === tc.key ? t.accent : t.text3, marginBottom: 8 }}>{tc.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: requestType === tc.key ? t.accent : t.text1 }}>{tc.label}</div>
              <div style={{ fontSize: 12, color: t.text3, marginTop: 2 }}>{tc.desc}</div>
            </button>
          ))}
        </div>

        {/* Form Content */}
        {requestType === 'direct' ? (
          <NewRequestForm onSave={handleSave} onCancel={handleCancel} />
        ) : (
          <InwardReinsuranceFormContent
            origin={requestType === 'inward-foreign' ? 'foreign' : 'domestic'}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      </div>

      {/* Right — Progress Sidebar */}
      <div
        style={{
          borderLeft: `1px solid ${t.border}`,
          background: t.bgPanel,
          padding: '28px 20px',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Progress Ring */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <ProgressRing percent={progress} color={t.accent} />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'rotate(0deg)',
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700, color: t.text1 }}>{progress}%</span>
            <span style={{ fontSize: 11, color: t.text3 }}>Complete</span>
          </div>
        </div>

        {/* Section Heading */}
        <div style={{ fontSize: 12, fontWeight: 600, color: t.text3, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 12, alignSelf: 'stretch' }}>
          Required Sections
        </div>

        {/* Checklist */}
        <div style={{ alignSelf: 'stretch' }}>
          {checklist.map(item => {
            const done = completedSections.has(item.key);
            return (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 4,
                  background: done ? `${t.success}08` : 'transparent',
                }}
              >
                {done ? (
                  <CheckCircle2 size={16} style={{ color: t.success, flexShrink: 0 }} />
                ) : (
                  <Circle size={16} style={{ color: t.text5, flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 13, color: done ? t.success : t.text2, fontWeight: done ? 500 : 400 }}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom info */}
        <div style={{ alignSelf: 'stretch', marginTop: 20, padding: '14px 16px', borderRadius: 8, background: `${t.accent}08`, border: `1px solid ${t.accent}20` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.accent, marginBottom: 4 }}>
            {requestType === 'direct' ? 'Direct Insurance' : requestType === 'inward-foreign' ? 'Inward Foreign' : 'Inward Domestic'}
          </div>
          <div style={{ fontSize: 11, color: t.text3 }}>
            Fill in all required sections to submit your request.
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewRequestPage;
