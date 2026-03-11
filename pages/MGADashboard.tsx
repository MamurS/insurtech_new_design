import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DB } from '../services/db';
import { BindingAgreement, BordereauxEntry } from '../types';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../theme/useTheme';
import { formatDate } from '../utils/dateUtils';
import {
  Search, RefreshCw, Download, Plus,
  FileSignature, TrendingUp, TrendingDown, DollarSign, BarChart3,
  Building2, Calendar, MoreVertical, Eye, Edit, Trash2,
  FileText, ClipboardList,
  CheckCircle, Clock, AlertCircle, Save, X, Upload, Info,
  Star, Minus
} from 'lucide-react';
import { exportToExcel } from '../services/excelExport';
import { usePageHeader } from '../context/PageHeaderContext';
import { parseBordereaux, ParsedBordereaux } from '../utils/bordereauParser';
import { CompactDateFilter } from '../components/CompactDateFilter';
import { toISODateString } from '../components/DatePickerInput';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';

// ─── Bordereaux Entry Form (inline modal) ───────────────────────

interface BdxFormProps {
  agreementId: string;
  entry?: BordereauxEntry;
  onSave: () => void;
  onCancel: () => void;
}

const BordereauxEntryForm: React.FC<BdxFormProps> = ({ agreementId, entry, onSave, onCancel }) => {
  const toast = useToast();
  const { t } = useTheme();
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedBordereaux | null>(null);
  const isEdit = Boolean(entry);

  const [form, setForm] = useState<Partial<BordereauxEntry>>({
    id: entry?.id || crypto.randomUUID(),
    agreementId,
    bordereauType: entry?.bordereauType || 'PREMIUM',
    periodFrom: entry?.periodFrom || '',
    periodTo: entry?.periodTo || '',
    submissionDate: entry?.submissionDate || new Date().toISOString().split('T')[0],
    status: entry?.status || 'PENDING',
    totalGwp: entry?.totalGwp || 0,
    totalPolicies: entry?.totalPolicies || 0,
    totalClaimsPaid: entry?.totalClaimsPaid || 0,
    totalClaimsReserved: entry?.totalClaimsReserved || 0,
    fileName: entry?.fileName || '',
    notes: entry?.notes || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value,
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setParseResult(null);
    try {
      const parsed = await parseBordereaux(file);
      setParseResult(parsed);
      // Pre-fill form fields with extracted values
      setForm(prev => ({
        ...prev,
        totalGwp: parsed.totalGwp || prev.totalGwp,
        totalPolicies: parsed.totalPolicies || prev.totalPolicies,
        totalClaimsPaid: parsed.totalClaimsPaid || prev.totalClaimsPaid,
        totalClaimsReserved: parsed.totalClaimsReserved || prev.totalClaimsReserved,
        fileName: parsed.fileName,
      }));
      if (Object.keys(parsed.detectedColumns).length > 0) {
        toast.success(`Parsed ${parsed.rowCount} rows from ${parsed.fileName}`);
      } else {
        toast.error('No matching columns detected — please fill in values manually');
      }
    } catch (err: any) {
      console.error('Parse error:', err);
      toast.error('Failed to parse file: ' + (err.message || 'Unknown error'));
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await DB.saveBordereauxEntry({
        id: form.id!,
        agreementId,
        bordereauType: form.bordereauType as BordereauxEntry['bordereauType'],
        periodFrom: form.periodFrom || undefined,
        periodTo: form.periodTo || undefined,
        submissionDate: form.submissionDate || undefined,
        status: (form.status || 'PENDING') as BordereauxEntry['status'],
        totalGwp: Number(form.totalGwp || 0),
        totalPolicies: Number(form.totalPolicies || 0),
        totalClaimsPaid: Number(form.totalClaimsPaid || 0),
        totalClaimsReserved: Number(form.totalClaimsReserved || 0),
        fileName: form.fileName || undefined,
        notes: form.notes,
      });
      toast.success(isEdit ? 'Bordereaux updated' : 'Bordereaux entry added');
      onSave();
    } catch (err: any) {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const formatDetected = (result: ParsedBordereaux): string => {
    const parts: string[] = [];
    if (result.detectedColumns.totalGwp) parts.push(`GWP from '${result.detectedColumns.totalGwp}'`);
    if (result.detectedColumns.totalPolicies) parts.push(`Policies from '${result.detectedColumns.totalPolicies}'`);
    if (result.detectedColumns.totalClaimsPaid) parts.push(`Claims Paid from '${result.detectedColumns.totalClaimsPaid}'`);
    if (result.detectedColumns.totalClaimsReserved) parts.push(`Reserves from '${result.detectedColumns.totalClaimsReserved}'`);
    return parts.length > 0 ? `Detected: ${parts.join(', ')}` : 'No matching columns detected';
  };

  const labelStyle: React.CSSProperties = { color: t.text4, fontSize: 12, fontWeight: 500 };
  const inputStyle: React.CSSProperties = { background: t.bgPanel, border: `1px solid ${t.borderL}`, borderRadius: 8, color: t.text1, fontSize: 13 };

  return (
    <form onSubmit={handleSubmit} style={{ background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h4 style={{ fontSize: 14, fontWeight: 600, color: t.text2 }}>{isEdit ? 'Edit Bordereaux Entry' : 'New Bordereaux Entry'}</h4>

      {/* File Upload */}
      <div style={{ borderRadius: 8, padding: 16, textAlign: 'center', border: `2px dashed ${t.borderL}` }}>
        <label style={{ cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Upload size={20} style={{ color: parsing ? t.accent : t.text5 }} className={parsing ? 'animate-pulse' : ''} />
          <span style={{ fontSize: 14, color: t.text3 }}>{parsing ? 'Parsing...' : 'Upload Excel/CSV bordereaux to auto-fill'}</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            disabled={parsing}
          />
          <span className="hover:underline" style={{ fontSize: 12, color: t.accent }}>Choose file</span>
        </label>
      </div>

      {/* Parse Result Info */}
      {parseResult && Object.keys(parseResult.detectedColumns).length > 0 && (
        <div style={{ borderRadius: 8, padding: 12, display: 'flex', alignItems: 'flex-start', gap: 8, background: t.accentMuted, border: `1px solid ${t.accent}30` }}>
          <Info size={16} style={{ marginTop: 2, flexShrink: 0, color: t.accent }} />
          <div style={{ fontSize: 12, color: t.text1 }}>
            <p style={{ fontWeight: 500 }}>Parsed {parseResult.fileName}: {parseResult.rowCount} rows found.</p>
            <p style={{ marginTop: 2, color: t.accent }}>{formatDetected(parseResult)}</p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div>
          <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>Type</label>
          <select name="bordereauType" value={form.bordereauType} onChange={handleChange} className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 12, paddingRight: 12 }}>
            <option value="PREMIUM">Premium</option>
            <option value="CLAIMS">Claims</option>
            <option value="ADJUSTMENT">Adjustment</option>
          </select>
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>Period From</label>
          <input type="date" name="periodFrom" value={form.periodFrom || ''} onChange={handleChange} className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 12, paddingRight: 12 }} />
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>Period To</label>
          <input type="date" name="periodTo" value={form.periodTo || ''} onChange={handleChange} className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 12, paddingRight: 12 }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div>
          <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>Submission Date</label>
          <input type="date" name="submissionDate" value={form.submissionDate || ''} onChange={handleChange} className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 12, paddingRight: 12 }} />
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>Total GWP</label>
          <input type="number" name="totalGwp" value={form.totalGwp ?? ''} onChange={handleChange} min={0} step="0.01" className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 12, paddingRight: 12 }} />
        </div>
        <div>
          <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>Total Policies</label>
          <input type="number" name="totalPolicies" value={form.totalPolicies ?? ''} onChange={handleChange} min={0} className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 12, paddingRight: 12 }} />
        </div>
      </div>
      {form.bordereauType === 'CLAIMS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <div>
            <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>Total Claims Paid</label>
            <input type="number" name="totalClaimsPaid" value={form.totalClaimsPaid ?? ''} onChange={handleChange} min={0} step="0.01" className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 12, paddingRight: 12 }} />
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>Total Claims Reserved</label>
            <input type="number" name="totalClaimsReserved" value={form.totalClaimsReserved ?? ''} onChange={handleChange} min={0} step="0.01" className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 12, paddingRight: 12 }} />
          </div>
        </div>
      )}
      <div>
        <label style={{ ...labelStyle, display: 'block', marginBottom: 4 }}>Notes</label>
        <input type="text" name="notes" value={form.notes || ''} onChange={handleChange} placeholder="Optional notes" className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" style={{ ...inputStyle, width: '100%', height: 36, paddingLeft: 12, paddingRight: 12 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 14, borderRadius: 8, color: t.text3, background: t.bgPanel, border: `1px solid ${t.borderL}` }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="disabled:opacity-50" style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 6, paddingBottom: 6, fontSize: 14, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, background: t.accent, color: '#fff' }}>
          <Save size={14} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
};

// ─── Detail Modal ───────────────────────────────────────────────

interface DetailModalProps {
  agreement: BindingAgreement;
  actualGwp: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ agreement, actualGwp, onClose, onEdit, onDelete }) => {
  const { t } = useTheme();
  const [tab, setTab] = useState<'summary' | 'bordereaux' | 'claims' | 'documents'>('summary');
  const [bdxEntries, setBdxEntries] = useState<BordereauxEntry[]>([]);
  const [bdxLoading, setBdxLoading] = useState(false);
  const [showBdxForm, setShowBdxForm] = useState(false);

  const loadBdx = useCallback(async () => {
    setBdxLoading(true);
    try {
      const entries = await DB.getBordereauxByAgreement(agreement.id);
      setBdxEntries(entries);
    } catch { /* ignore */ }
    setBdxLoading(false);
  }, [agreement.id]);

  useEffect(() => {
    if (tab === 'bordereaux') loadBdx();
  }, [tab, loadBdx]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: agreement.currency || 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  const utilization = agreement.epi > 0 ? (actualGwp / agreement.epi) * 100 : 0;

  const getBdxStatusBadge = (status: string) => {
    const s: Record<string, { bg: string; color: string }> = {
      'PENDING': { bg: t.warningBg, color: t.warning },
      'UNDER_REVIEW': { bg: t.accentMuted, color: t.accent },
      'ACCEPTED': { bg: t.successBg, color: t.success },
      'DISPUTED': { bg: t.dangerBg, color: t.danger },
      'REJECTED': { bg: t.bgInput, color: t.text4 },
    };
    const st = s[status] || { bg: t.bgInput, color: t.text3 };
    return <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, fontSize: 12, fontWeight: 500, background: st.bg, color: st.color, borderRadius: 20 }}>{status.replace('_', ' ')}</span>;
  };

  const tabClass = (tabName: string) => {
    const isActive = tab === tabName;
    return {
      className: 'transition-colors cursor-pointer',
      style: {
        paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8,
        fontSize: 14, fontWeight: 500, borderTopLeftRadius: 8, borderTopRightRadius: 8,
        borderBottom: `2px solid ${isActive ? t.accent : 'transparent'}`,
        color: isActive ? t.accent : t.text4,
      } as React.CSSProperties,
    };
  };

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 24, paddingBottom: 24, overflowY: 'auto' }}>
      <div className="backdrop-blur-sm" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 1024, marginLeft: 16, marginRight: 16, marginTop: 'auto', marginBottom: 'auto', background: t.bgPanel, borderRadius: 16, boxShadow: t.shadowLg }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, paddingLeft: 24, paddingRight: 24, paddingTop: 16, paddingBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.bgPanel, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottom: `1px solid ${t.border}` }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: t.text1 }}>{agreement.agreementNumber}</h2>
            <p style={{ fontSize: 14, color: t.text4 }}>{agreement.mgaName} &middot; {agreement.agreementType.replace('_', ' ')}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onEdit} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 14, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, color: t.accent, border: `1px solid ${t.accent}30` }}>
              <Edit size={14} /> Edit
            </button>
            <button onClick={onDelete} style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 14, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, color: t.danger, border: `1px solid ${t.danger}30` }}>
              <Trash2 size={14} /> Delete
            </button>
            <button onClick={onClose} style={{ padding: 8, borderRadius: 8, color: t.text5 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, paddingLeft: 24, paddingRight: 24, borderBottom: `1px solid ${t.border}` }}>
          <button {...tabClass('summary')} onClick={() => setTab('summary')}>Summary</button>
          <button {...tabClass('bordereaux')} onClick={() => setTab('bordereaux')}>Bordereaux</button>
          <button {...tabClass('claims')} onClick={() => setTab('claims')}>Claims</button>
          <button {...tabClass('documents')} onClick={() => setTab('documents')}>Documents</button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, maxHeight: 'calc(100vh - 14rem)', overflowY: 'auto' }}>
          {tab === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Key metrics row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div style={{ borderRadius: 12, padding: 16, background: t.bgInput }}>
                  <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>EPI</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: t.text1 }}>{formatCurrency(agreement.epi)}</p>
                </div>
                <div style={{ borderRadius: 12, padding: 16, background: t.bgInput }}>
                  <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>Actual GWP</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: actualGwp > 0 ? t.success : t.text5 }}>{formatCurrency(actualGwp)}</p>
                </div>
                <div style={{ borderRadius: 12, padding: 16, background: t.bgInput }}>
                  <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>Utilization</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: utilization > 80 ? t.success : utilization > 50 ? t.warning : t.danger }}>
                    {agreement.epi > 0 ? `${utilization.toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
                <div style={{ borderRadius: 12, padding: 16, background: t.bgInput }}>
                  <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>Our Share</p>
                  <p style={{ fontSize: 15, fontWeight: 600, color: t.text1 }}>{(agreement.ourShare * 100).toFixed(1)}%</p>
                </div>
              </div>

              {/* Details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 32, rowGap: 16 }}>
                {[
                  ['Status', agreement.status],
                  ['Type', agreement.agreementType.replace('_', ' ')],
                  ['Broker', agreement.brokerName || '-'],
                  ['Underwriter', agreement.underwriter || '-'],
                  ['Inception', formatDate(agreement.inceptionDate)],
                  ['Expiry', formatDate(agreement.expiryDate)],
                  ['Currency', agreement.currency],
                  ['Commission', `${agreement.commissionPercent}%`],
                  ['Territory', agreement.territoryScope || '-'],
                  ['Class', agreement.classOfBusiness || '-'],
                  ['Max Per Risk', agreement.maxLimitPerRisk ? formatCurrency(agreement.maxLimitPerRisk) : '-'],
                  ['Aggregate Limit', agreement.aggregateLimit ? formatCurrency(agreement.aggregateLimit) : '-'],
                  ['Deposit Premium', formatCurrency(agreement.depositPremium)],
                  ['Minimum Premium', formatCurrency(agreement.minimumPremium)],
                  ['Claims Authority', formatCurrency(agreement.claimsAuthorityLimit)],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 8, borderBottom: `1px solid ${t.bgInput}` }}>
                    <span style={{ fontSize: 14, color: t.text4 }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: t.text1 }}>{value}</span>
                  </div>
                ))}
              </div>

              {agreement.notes && (
                <div>
                  <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, color: t.text4 }}>Notes</p>
                  <p style={{ fontSize: 14, borderRadius: 8, padding: 12, color: t.text2, background: t.bgInput }}>{agreement.notes}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'bordereaux' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: t.text1 }}>Bordereaux Entries</h3>
                <button onClick={() => setShowBdxForm(true)}
                  style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 14, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, background: t.accent, color: '#fff' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                  <Plus size={14} /> Add Bordereaux
                </button>
              </div>

              {showBdxForm && (
                <BordereauxEntryForm
                  agreementId={agreement.id}
                  onSave={() => { setShowBdxForm(false); loadBdx(); }}
                  onCancel={() => setShowBdxForm(false)}
                />
              )}

              {bdxLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingBottom: 48 }}>
                  <RefreshCw className="animate-spin" size={24} style={{ color: t.accent }} />
                </div>
              ) : bdxEntries.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48, color: t.text5 }}>
                  <ClipboardList size={36} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ fontSize: 14 }}>No bordereaux entries yet</p>
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: t.bgInput }}>
                      <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text4 }}>Period</th>
                      <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text4 }}>Submitted</th>
                      <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text4 }}>Type</th>
                      <th style={{ textAlign: 'right', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text4 }}>GWP</th>
                      <th style={{ textAlign: 'right', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text4 }}>Policies</th>
                      <th style={{ textAlign: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: t.text4 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody style={{ borderColor: t.borderL }} className="divide-y">
                    {bdxEntries.map(bdx => (
                      <tr key={bdx.id}
                        onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, color: t.text1 }}>{formatDate(bdx.periodFrom)} - {formatDate(bdx.periodTo)}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, color: t.text2 }}>{formatDate(bdx.submissionDate)}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}><span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 9999, fontSize: 12, fontWeight: 500, background: t.bgInput, color: t.text2 }}>{bdx.bordereauType}</span></td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'right', fontWeight: 500, color: t.text1 }}>{formatCurrency(bdx.totalGwp)}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'right', color: t.text2 }}>{bdx.totalPolicies}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'center' }}>{getBdxStatusBadge(bdx.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'claims' && (
            <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: t.text5 }}>
              <AlertCircle size={36} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 8, opacity: 0.5 }} />
              <p style={{ fontSize: 14, fontWeight: 500 }}>Claims bordereaux tracking coming soon</p>
            </div>
          )}

          {tab === 'documents' && (
            <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: t.text5 }}>
              <FileText size={36} style={{ marginLeft: 'auto', marginRight: 'auto', marginBottom: 8, opacity: 0.5 }} />
              <p style={{ fontSize: 14, fontWeight: 500 }}>Document management coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Performance Tab Component ──────────────────────────────────

interface PerformanceTabProps {
  agreements: BindingAgreement[];
  bdxGwpMap: Record<string, number>;
  bdxMap: Record<string, BordereauxEntry[]>;
  loading: boolean;
}

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

const fmtCurShort = (amount: number): string => {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
};

const fmtCur = (amount: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const getScoreStars = (utilization: number): number => {
  if (utilization >= 90) return 5;
  if (utilization >= 75) return 4;
  if (utilization >= 50) return 3;
  if (utilization >= 25) return 2;
  return 1;
};

const StarRating: React.FC<{ score: number }> = ({ score }) => {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} style={i <= score ? { color: t.warning, fill: t.warning } : { color: t.borderL }} />
      ))}
    </div>
  );
};

const TrendIndicator: React.FC<{ bdxEntries: BordereauxEntry[] }> = ({ bdxEntries }) => {
  const { t } = useTheme();
  const accepted = bdxEntries
    .filter(b => b.status === 'ACCEPTED' && b.totalGwp > 0)
    .sort((a, b) => (a.periodFrom || '').localeCompare(b.periodFrom || ''));
  if (accepted.length < 2) return <Minus size={14} style={{ color: t.borderL }} />;
  const recent = accepted[accepted.length - 1].totalGwp;
  const prev = accepted[accepted.length - 2].totalGwp;
  if (recent > prev) return <TrendingUp size={14} style={{ color: t.success }} />;
  if (recent < prev) return <TrendingDown size={14} style={{ color: t.danger }} />;
  return <Minus size={14} style={{ color: t.borderL }} />;
};

const PerformanceTab: React.FC<PerformanceTabProps> = ({ agreements, bdxGwpMap, bdxMap, loading }) => {
  const { t } = useTheme();
  // Build performance rows
  const perfRows = useMemo(() => {
    return agreements.map(ag => {
      const gwp = bdxGwpMap[ag.id] || 0;
      const utilization = ag.epi > 0 ? (gwp / ag.epi) * 100 : 0;
      const bdxEntries = bdxMap[ag.id] || [];
      const bdxCount = bdxEntries.length;
      const lastBdxDate = bdxEntries.length > 0
        ? bdxEntries.reduce((latest, b) => {
            const d = b.submissionDate || b.periodTo || '';
            return d > latest ? d : latest;
          }, '')
        : null;

      // Avg quarterly GWP: accepted GWP / quarters elapsed since inception
      let avgQuarterlyGwp = 0;
      if (ag.inceptionDate && gwp > 0) {
        const incDate = new Date(ag.inceptionDate);
        const now = new Date();
        const monthsElapsed = Math.max(1, (now.getFullYear() - incDate.getFullYear()) * 12 + now.getMonth() - incDate.getMonth());
        const quartersElapsed = Math.max(1, monthsElapsed / 3);
        avgQuarterlyGwp = gwp / quartersElapsed;
      }

      return {
        agreement: ag,
        gwp,
        utilization,
        score: getScoreStars(utilization),
        bdxEntries,
        bdxCount,
        lastBdxDate,
        avgQuarterlyGwp,
      };
    }).sort((a, b) => b.utilization - a.utilization);
  }, [agreements, bdxGwpMap, bdxMap]);

  const activeRows = perfRows.filter(r => r.agreement.status === 'ACTIVE');
  const avgUtilization = activeRows.length > 0
    ? activeRows.reduce((s, r) => s + r.utilization, 0) / activeRows.length : 0;
  const bestPerformer = activeRows.length > 0 ? activeRows[0] : null;
  const underperformerCount = activeRows.filter(r => r.utilization < 50).length;
  const totalBdxCount = perfRows.reduce((s, r) => s + r.bdxCount, 0);

  // Chart data: utilization bars
  const utilizationChartData = perfRows
    .filter(r => r.agreement.epi > 0)
    .slice(0, 15)
    .map(r => ({
      name: r.agreement.agreementNumber.length > 18
        ? r.agreement.agreementNumber.substring(0, 15) + '...'
        : r.agreement.agreementNumber,
      utilization: Number(r.utilization.toFixed(1)),
      fill: r.utilization >= 75 ? '#10b981' : r.utilization >= 50 ? '#f59e0b' : '#ef4444',
    }));

  // Quarterly trend data: top 5 agreements by GWP with multiple bdx
  const trendAgreements = perfRows
    .filter(r => r.bdxEntries.filter(b => b.status === 'ACCEPTED').length >= 2)
    .slice(0, 5);

  const trendData = useMemo(() => {
    if (trendAgreements.length === 0) return [];
    // Collect all unique periods across all agreements
    const periodSet = new Set<string>();
    trendAgreements.forEach(r => {
      r.bdxEntries
        .filter(b => b.status === 'ACCEPTED')
        .forEach(b => { if (b.periodTo) periodSet.add(b.periodTo); });
    });
    const periods = Array.from(periodSet).sort();

    return periods.map(period => {
      const point: Record<string, any> = { period: period.substring(0, 7) };
      trendAgreements.forEach((r, i) => {
        const accepted = r.bdxEntries
          .filter(b => b.status === 'ACCEPTED' && (b.periodTo || '') <= period)
          .reduce((s, b) => s + b.totalGwp, 0);
        point[`ag${i}`] = accepted;
        point[`name${i}`] = r.agreement.agreementNumber;
      });
      return point;
    });
  }, [trendAgreements]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: t.accent }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{ borderRadius: 12, padding: 16, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <div style={{ color: t.text4, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            <BarChart3 size={14} />
            Avg Utilization
          </div>
          <p style={{ color: avgUtilization >= 75 ? t.success : avgUtilization >= 50 ? t.warning : t.danger, fontSize: 24, fontWeight: 700 }}>
            {avgUtilization.toFixed(1)}%
          </p>
          <p style={{ color: t.text5, fontSize: 12, marginTop: 2 }}>{activeRows.length} active agreements</p>
        </div>
        <div style={{ borderRadius: 12, padding: 16, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <div style={{ color: t.success, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            <Star size={14} />
            Best Performer
          </div>
          <p style={{ color: t.text1, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bestPerformer?.agreement.mgaName || '-'}</p>
          <p style={{ color: t.text5, fontSize: 12, marginTop: 2 }}>{bestPerformer ? `${bestPerformer.utilization.toFixed(0)}% utilization` : 'No active agreements'}</p>
        </div>
        <div style={{ borderRadius: 12, padding: 16, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <div style={{ color: t.danger, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            <AlertCircle size={14} />
            Underperformers
          </div>
          <p style={{ color: t.danger, fontSize: 24, fontWeight: 700 }}>{underperformerCount}</p>
          <p style={{ color: t.text5, fontSize: 12, marginTop: 2 }}>Below 50% utilization</p>
        </div>
        <div style={{ borderRadius: 12, padding: 16, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
          <div style={{ color: t.accent, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            <ClipboardList size={14} />
            Total Bordereaux
          </div>
          <p style={{ color: t.accent, fontSize: 24, fontWeight: 700 }}>{totalBdxCount}</p>
          <p style={{ color: t.text5, fontSize: 12, marginTop: 2 }}>All submissions</p>
        </div>
      </div>

      {/* Performance Table */}
      <div style={{ borderRadius: 12, overflow: 'hidden', background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
        <div style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 16, paddingBottom: 16, borderBottom: `1px solid ${t.borderL}` }}>
          <h3 style={{ color: t.text1, fontWeight: 600 }}>Agreement Performance</h3>
          <p style={{ color: t.text4, fontSize: 12, marginTop: 2 }}>Utilization, bordereaux activity, and scoring</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 14 }}>
            <thead style={{ background: t.bgInput }}>
              <tr>
                <th style={{ color: t.text4, textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Agreement #</th>
                <th style={{ color: t.text4, textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>MGA / Partner</th>
                <th style={{ color: t.text4, textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Status</th>
                <th style={{ color: t.text4, textAlign: 'right', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>EPI</th>
                <th style={{ color: t.text4, textAlign: 'right', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Actual GWP</th>
                <th style={{ color: t.text4, textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', width: 144 }}>Utilization</th>
                <th style={{ color: t.text4, textAlign: 'right', paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Bdx</th>
                <th style={{ color: t.text4, textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Last Bdx</th>
                <th style={{ color: t.text4, textAlign: 'right', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Avg Qtr GWP</th>
                <th style={{ color: t.text4, textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Score</th>
                <th style={{ color: t.text4, textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: t.borderL }}>
              {perfRows.map(row => {
                const statusColorMap: Record<string, { bg: string; color: string }> = {
                  'ACTIVE': { bg: t.successBg, color: t.success },
                  'DRAFT': { bg: t.bgInput, color: t.text2 },
                  'EXPIRED': { bg: t.warningBg, color: t.warning },
                  'TERMINATED': { bg: t.dangerBg, color: t.danger },
                  'CANCELLED': { bg: t.border, color: t.text4 },
                };
                const barBg = row.utilization >= 75 ? t.success : row.utilization >= 50 ? t.warning : t.danger;
                const sc = statusColorMap[row.agreement.status] || { bg: t.bgInput, color: t.text2 };
                return (
                  <tr key={row.agreement.id}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.bgHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                    <td style={{ color: t.text1, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, fontWeight: 500 }}>{row.agreement.agreementNumber}</td>
                    <td style={{ color: t.text1, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.agreement.mgaName}</td>
                    <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 10, paddingBottom: 10, textAlign: 'center' }}>
                      <span style={{ background: sc.bg, color: sc.color, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 9999, fontSize: 12, fontWeight: 500 }}>
                        {row.agreement.status}
                      </span>
                    </td>
                    <td style={{ color: t.text2, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: 'monospace' }}>{fmtCur(row.agreement.epi)}</td>
                    <td style={{ color: t.text1, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: 'monospace', fontWeight: 500 }}>{row.gwp > 0 ? fmtCur(row.gwp) : '-'}</td>
                    <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ background: t.border, flex: 1, height: 8, borderRadius: 9999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 9999, width: `${Math.min(row.utilization, 100)}%`, background: barBg }} />
                        </div>
                        <span style={{ color: row.utilization >= 75 ? t.success : row.utilization >= 50 ? t.warning : t.danger, fontSize: 12, fontWeight: 600, width: 40, textAlign: 'right' }}>
                          {row.agreement.epi > 0 ? `${row.utilization.toFixed(0)}%` : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: t.text2, paddingLeft: 8, paddingRight: 8, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: 'monospace' }}>{row.bdxCount}</td>
                    <td style={{ color: t.text2, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, fontSize: 12 }}>{row.lastBdxDate ? formatDate(row.lastBdxDate) : '-'}</td>
                    <td style={{ color: t.text1, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, textAlign: 'right', fontFamily: 'monospace' }}>{row.avgQuarterlyGwp > 0 ? fmtCurShort(row.avgQuarterlyGwp) : '-'}</td>
                    <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 10, paddingBottom: 10, textAlign: 'center' }}><StarRating score={row.score} /></td>
                    <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 10, paddingBottom: 10, textAlign: 'center' }}><TrendIndicator bdxEntries={row.bdxEntries} /></td>
                  </tr>
                );
              })}
              {perfRows.length === 0 && (
                <tr><td colSpan={11} style={{ color: t.text5, paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>No agreements found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {/* Utilization Chart */}
        {utilizationChartData.length > 0 && (
          <div style={{ borderRadius: 12, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
            <div style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 16, paddingBottom: 16, borderBottom: `1px solid ${t.borderL}` }}>
              <h3 style={{ color: t.text1, fontWeight: 600 }}>Utilization by Agreement</h3>
              <p style={{ color: t.text4, fontSize: 12, marginTop: 2 }}>Actual GWP as % of EPI</p>
            </div>
            <div style={{ padding: 20 }}>
              <ResponsiveContainer width="100%" height={Math.max(280, utilizationChartData.length * 32)}>
                <BarChart data={utilizationChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" width={120} />
                  <Tooltip
                    formatter={((value: number) => [`${value}%`, 'Utilization']) as any}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <ReferenceLine x={100} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'EPI', position: 'top', fontSize: 10 }} />
                  <Bar dataKey="utilization" name="Utilization %" radius={[0, 4, 4, 0]}>
                    {utilizationChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Quarterly Trend Chart */}
        {trendData.length > 0 && trendAgreements.length > 0 && (
          <div style={{ borderRadius: 12, background: t.bgPanel, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
            <div style={{ paddingLeft: 20, paddingRight: 20, paddingTop: 16, paddingBottom: 16, borderBottom: `1px solid ${t.borderL}` }}>
              <h3 style={{ color: t.text1, fontWeight: 600 }}>Cumulative GWP Trend</h3>
              <p style={{ color: t.text4, fontSize: 12, marginTop: 2 }}>Top agreements by accepted bordereaux over time</p>
            </div>
            <div style={{ padding: 20 }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => fmtCurShort(v)} />
                  <Tooltip
                    formatter={((value: number, name: string, props: any) => {
                      const idx = Number(name.replace('ag', ''));
                      const label = props?.payload?.[`name${idx}`] || name;
                      return [fmtCur(value), label];
                    }) as any}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend formatter={(value: string) => {
                    const idx = Number(value.replace('ag', ''));
                    return trendAgreements[idx]?.agreement.agreementNumber || value;
                  }} />
                  {trendAgreements.map((_, i) => (
                    <Line
                      key={`ag${i}`}
                      type="monotone"
                      dataKey={`ag${i}`}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Dashboard ─────────────────────────────────────────────

const MGADashboard: React.FC = () => {
  const toast = useToast();
  const { t } = useTheme();
  const { setHeaderActions, setHeaderLeft } = usePageHeader();
  const navigate = useNavigate();

  // Page-level tab
  const [activePageTab, setActivePageTab] = useState<'agreements' | 'performance'>('agreements');

  // Data
  const [agreements, setAgreements] = useState<BindingAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, totalEpi: 0, actualGwp: 0 });
  const [bdxGwpMap, setBdxGwpMap] = useState<Record<string, number>>({});
  const [bdxMap, setBdxMap] = useState<Record<string, BordereauxEntry[]>>({});
  const [exporting, setExporting] = useState(false);

  // Infinite scroll (client-side)
  const VISIBLE_INCREMENT = 20;
  const [visibleCount, setVisibleCount] = useState(VISIBLE_INCREMENT);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Search & filters
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilterField, setDateFilterField] = useState<string>('inceptionDate');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // Sticky bar height
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterHeight, setFilterHeight] = useState(62);
  useEffect(() => {
    const el = filterRef.current;
    if (!el) return;
    const update = () => setFilterHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Kebab menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    if (openMenuId) {
      const handler = () => setOpenMenuId(null);
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [openMenuId]);

  // Modals
  const [detailAgreement, setDetailAgreement] = useState<BindingAgreement | null>(null);

  // ─── Data loading ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allAgreements, statsResult] = await Promise.all([
        DB.getBindingAgreements(),
        DB.getBindingAgreementStats(),
      ]);
      setAgreements(allAgreements);
      setStats(statsResult);

      // Build per-agreement GWP map and full bordereaux map
      const gwpMap: Record<string, number> = {};
      const fullBdxMap: Record<string, BordereauxEntry[]> = {};
      for (const ag of allAgreements) {
        try {
          const bdxList = await DB.getBordereauxByAgreement(ag.id);
          fullBdxMap[ag.id] = bdxList;
          const accepted = bdxList.filter(b => b.status === 'ACCEPTED');
          gwpMap[ag.id] = accepted.reduce((sum, b) => sum + b.totalGwp, 0);
        } catch {
          fullBdxMap[ag.id] = [];
          gwpMap[ag.id] = 0;
        }
      }
      setBdxGwpMap(gwpMap);
      setBdxMap(fullBdxMap);
    } catch (err) {
      console.error('Failed to load MGA data:', err);
      toast.error('Failed to load agreements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Search debounce ──────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(value);
      setVisibleCount(VISIBLE_INCREMENT);
    }, 300);
  };

  // ─── Filtering & pagination ───────────────────────────
  const filteredAgreements = agreements.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (typeFilter !== 'all' && a.agreementType !== typeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (
        !a.agreementNumber.toLowerCase().includes(q) &&
        !a.mgaName.toLowerCase().includes(q) &&
        !(a.brokerName || '').toLowerCase().includes(q)
      ) return false;
    }
    // Date filter
    if (dateFrom || dateTo) {
      const fromStr = toISODateString(dateFrom) || '';
      const toStr = toISODateString(dateTo) || '';
      const val = dateFilterField === 'expiryDate' ? (a as any).expiryDate : (a as any).inceptionDate;
      const dateStr = typeof val === 'string' ? val.slice(0, 10) : '';
      if (fromStr && dateStr < fromStr) return false;
      if (toStr && dateStr > toStr) return false;
    }
    return true;
  });

  const totalCount = filteredAgreements.length;
  const pageAgreements = filteredAgreements.slice(0, visibleCount);
  const hasMoreAgreements = visibleCount < totalCount;

  // Reset visibleCount on filter changes
  useEffect(() => {
    setVisibleCount(VISIBLE_INCREMENT);
  }, [searchTerm, statusFilter, typeFilter, dateFrom, dateTo, dateFilterField]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreAgreements) {
          setVisibleCount(prev => prev + VISIBLE_INCREMENT);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreAgreements]);

  // ─── Formatters ───────────────────────────────────────
  const formatCurrency = (amount: number, short = false) => {
    if (short) {
      if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
      if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const s: Record<string, { bg: string; color: string }> = {
      'DRAFT': { bg: t.bgInput, color: t.text2 },
      'ACTIVE': { bg: t.successBg, color: t.success },
      'EXPIRED': { bg: t.warningBg, color: t.warning },
      'TERMINATED': { bg: t.dangerBg, color: t.danger },
      'CANCELLED': { bg: t.border, color: t.text4 },
    };
    const st = s[status] || { bg: t.bgInput, color: t.text2 };
    return <span style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: 9999, fontSize: 12, fontWeight: 500, background: st.bg, color: st.color }}>{status}</span>;
  };

  const getTypeBadge = (type: string) => {
    const s: Record<string, { bg: string; color: string }> = {
      'BINDING_AUTHORITY': { bg: t.accentMuted, color: t.accent },
      'LINESLIP': { bg: t.accentMuted, color: t.accent },
      'TREATY': { bg: t.accentMuted, color: t.success },
    };
    const labels: Record<string, string> = {
      'BINDING_AUTHORITY': 'BA',
      'LINESLIP': 'Lineslip',
      'TREATY': 'Treaty',
    };
    const st = s[type] || { bg: t.bgInput, color: t.text2 };
    return <span style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 9999, fontSize: 12, fontWeight: 500, background: st.bg, color: st.color }}>{labels[type] || type}</span>;
  };

  const getUtilizationDisplay = (agId: string, epi: number) => {
    const gwp = bdxGwpMap[agId] || 0;
    if (epi <= 0) return <span style={{ fontSize: 12, color: t.text5 }}>N/A</span>;
    const pct = (gwp / epi) * 100;
    const color = pct > 80 ? t.success : pct > 50 ? t.warning : t.danger;
    return <span style={{ fontSize: 12, fontWeight: 600, color }}>{pct.toFixed(0)}%</span>;
  };

  // ─── Export ───────────────────────────────────────────
  const handleExport = () => {
    if (filteredAgreements.length === 0) { toast.error('No agreements to export'); return; }
    setExporting(true);
    try {
      const data = filteredAgreements.map(a => ({
        'Agreement #': a.agreementNumber,
        'Type': a.agreementType.replace('_', ' '),
        'MGA': a.mgaName,
        'Broker': a.brokerName || '',
        'Class': a.classOfBusiness || '',
        'Territory': a.territoryScope || '',
        'Currency': a.currency,
        'EPI': a.epi,
        'Actual GWP': bdxGwpMap[a.id] || 0,
        'Utilization %': a.epi > 0 ? Number(((bdxGwpMap[a.id] || 0) / a.epi * 100).toFixed(1)) : 0,
        'Our Share': (a.ourShare * 100).toFixed(1) + '%',
        'Commission %': a.commissionPercent,
        'Inception': a.inceptionDate || '',
        'Expiry': a.expiryDate || '',
        'Status': a.status,
      }));
      exportToExcel(data, `MGA_Agreements_${new Date().toISOString().split('T')[0]}`, 'MGA Agreements');
      toast.success('Exported successfully');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  useEffect(() => {
    setHeaderActions(
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={handleExport} disabled={exporting || filteredAgreements.length === 0}
          className="disabled:opacity-50 disabled:cursor-not-allowed" style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 14, fontWeight: 600, borderRadius: 8, whiteSpace: "nowrap", background: t.accent, color: '#fff', boxShadow: t.shadow }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
          <Download size={14} />
          Export
        </button>
      </div>
    );
    return () => { setHeaderActions(null); setHeaderLeft(null); };
  }, [exporting, filteredAgreements.length, setHeaderActions, setHeaderLeft]);

  // ─── Delete handler ───────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this agreement? This cannot be undone.')) return;
    try {
      await DB.deleteBindingAgreement(id);
      toast.success('Agreement deleted');
      setDetailAgreement(null);
      loadData();
    } catch { toast.error('Failed to delete'); }
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <div>
      {/* Sticky Filter Bar — ALWAYS visible */}
      <div ref={filterRef} className="sticky-filter-blur" style={{ background: t.bgInput, position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, minHeight: 48, overflow: 'visible' }}>
            {/* Page Tab Toggle */}
            <div style={{ background: t.bgInput, display: 'flex', padding: 2, borderRadius: 8 }}>
              <button
                onClick={() => setActivePageTab('agreements')}
                className="transition-all"
                style={activePageTab === 'agreements' ? { background: t.bgPanel, color: t.accent, boxShadow: t.shadow, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, borderRadius: 6, whiteSpace: 'nowrap' as const } : { color: t.text4, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, borderRadius: 6, whiteSpace: 'nowrap' as const }}
                onMouseEnter={(e) => { if (activePageTab !== 'agreements') e.currentTarget.style.color = t.text1; }}
                onMouseLeave={(e) => { if (activePageTab !== 'agreements') e.currentTarget.style.color = t.text4; }}
              >
                Agreements
              </button>
              <button
                onClick={() => setActivePageTab('performance')}
                className="transition-all"
                style={activePageTab === 'performance' ? { background: t.bgPanel, color: t.accent, boxShadow: t.shadow, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, borderRadius: 6, whiteSpace: 'nowrap' as const } : { color: t.text4, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, fontWeight: 500, borderRadius: 6, whiteSpace: 'nowrap' as const }}
                onMouseEnter={(e) => { if (activePageTab !== 'performance') e.currentTarget.style.color = t.text1; }}
                onMouseLeave={(e) => { if (activePageTab !== 'performance') e.currentTarget.style.color = t.text4; }}
              >
                Performance
              </button>
            </div>

            <div style={{ background: t.border, width: 1, height: 20 }} />

            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={14} style={{ color: t.text5, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" placeholder="Search agreements..." value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{ border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1, width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontSize: 14, outline: 'none' }} />
            </div>

            {/* Status */}
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setVisibleCount(VISIBLE_INCREMENT); }}
              
              style={{ border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1 }}>
              <option value="all">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="TERMINATED">Terminated</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Type */}
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setVisibleCount(VISIBLE_INCREMENT); }}
              
              style={{ border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1 }}>
              <option value="all">All Types</option>
              <option value="BINDING_AUTHORITY">Binding Authority</option>
              <option value="LINESLIP">Lineslip</option>
              <option value="TREATY">Treaty</option>
            </select>

            {/* Date Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, width: '280px' }}>
              <select
                value={dateFilterField}
                onChange={(e) => setDateFilterField(e.target.value)}
                
                style={{ border: `1px solid ${t.border}`, background: t.bgPanel, color: t.text1 }}
              >
                <option value="inceptionDate">Inception</option>
                <option value="expiryDate">Expiry</option>
              </select>
              <CompactDateFilter
                value={dateFrom}
                onChange={(d) => { setDateFrom(d); setVisibleCount(VISIBLE_INCREMENT); }}
                placeholder="From"
              />
              <CompactDateFilter
                value={dateTo}
                onChange={(d) => { setDateTo(d); setVisibleCount(VISIBLE_INCREMENT); }}
                placeholder="To"
              />
            </div>

            {/* Refresh */}
            <button onClick={loadData}
              style={{ padding: 8, borderRadius: 8, color: t.text4 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.bgInput)}
              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              title="Refresh">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} style={loading ? { color: t.accent } : {}} />
            </button>

            <div style={{ width: 1, height: 20, background: t.border }} />

            {/* New Agreement */}
            <button onClick={() => navigate('/mga/new')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 8, fontWeight: 500, fontSize: 14, background: t.accent, color: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
              <Plus size={16} />
              New Agreement
            </button>
          </div>
        </div>
      </div>

      {/* Performance Tab */}
      {activePageTab === 'performance' && (
        <PerformanceTab
          agreements={agreements}
          bdxGwpMap={bdxGwpMap}
          bdxMap={bdxMap}
          loading={loading}
        />
      )}

      {/* Agreements Tab */}
      {activePageTab === 'agreements' && (
      <div style={{ marginTop: 4, background: t.bgPanel, borderRadius: 12, border: '1px solid ' + t.border, boxShadow: t.shadow }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
            <RefreshCw className="animate-spin" size={32} style={{ color: t.accent }} />
          </div>
        ) : pageAgreements.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 256, color: t.text4 }}>
            <FileSignature size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>No agreements found</p>
            <p style={{ fontSize: 14 }}>Try adjusting your filters or create a new agreement</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead style={{ position: 'sticky', zIndex: 20, top: `${filterHeight}px`, background: t.bgCard, boxShadow: t.shadow }}>
                  <tr>
                    <th style={{ textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: 96, color: t.text4 }}>Status</th>
                    <th style={{ textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: 80, color: t.text4 }}>Type</th>
                    <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>Agreement #</th>
                    <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>MGA / Partner</th>
                    <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>Broker</th>
                    <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', maxWidth: 100, color: t.text4 }}>Class</th>
                    <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', maxWidth: 100, color: t.text4 }}>Territory</th>
                    <th style={{ textAlign: 'right', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>EPI</th>
                    <th style={{ textAlign: 'right', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>Actual GWP</th>
                    <th style={{ textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: 64, color: t.text4 }}>Util.</th>
                    <th style={{ textAlign: 'right', paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: 64, color: t.text4 }}>Share</th>
                    <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>Inception</th>
                    <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.text4 }}>Expiry</th>
                    <th style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 12, paddingBottom: 12, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pageAgreements.map(ag => {
                    const gwp = bdxGwpMap[ag.id] || 0;
                    return (
                      <tr key={ag.id} onClick={() => setDetailAgreement(ag)} className="transition-colors" style={{ cursor: 'pointer' }}>
                        <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>{getStatusBadge(ag.status)}</td>
                        <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>{getTypeBadge(ag.agreementType)}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontWeight: 500, color: t.text1 }}>{ag.agreementNumber}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Building2 size={14} style={{ flexShrink: 0, color: t.text4 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, color: t.text2 }}>{ag.mgaName}</span>
                          </div>
                        </td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 14, color: t.text3 }}>{ag.brokerName || '-'}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 14, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text3 }} title={ag.classOfBusiness || ''}>{ag.classOfBusiness || '-'}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 14, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text3 }} title={ag.territoryScope || ''}>{ag.territoryScope || '-'}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontStyle: 'italic', fontSize: 14, color: t.text4 }}>{formatCurrency(ag.epi)}</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>
                          <span style={{ fontWeight: 600, color: gwp > 0 ? t.success : t.text4 }}>{gwp > 0 ? formatCurrency(gwp) : '-'}</span>
                        </td>
                        <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>{getUtilizationDisplay(ag.id, ag.epi)}</td>
                        <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 12, paddingBottom: 12, textAlign: 'right', fontSize: 14, fontWeight: 500, color: t.text2 }}>{(ag.ourShare * 100).toFixed(0)}%</td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 14, whiteSpace: 'nowrap', color: t.text3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} style={{ color: t.text4 }} />
                            {formatDate(ag.inceptionDate)}
                          </div>
                        </td>
                        <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, fontSize: 14, whiteSpace: 'nowrap', color: t.text3 }}>{formatDate(ag.expiryDate)}</td>
                        <td style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 8, paddingBottom: 8, textAlign: 'center', position: 'relative' }} onClick={e => e.stopPropagation()}>
                          <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === ag.id ? null : ag.id); }}
                            style={{ padding: 6, borderRadius: 8 }}>
                            <MoreVertical size={16} style={{ color: t.text4 }} />
                          </button>
                          {openMenuId === ag.id && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, borderRadius: 8, paddingTop: 4, paddingBottom: 4, zIndex: 50, minWidth: 120, background: t.bgPanel, boxShadow: t.shadowMd, border: '1px solid ' + t.border }}>
                              <button onClick={() => { setOpenMenuId(null); setDetailAgreement(ag); }}
                                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 14, color: t.text2 }}>
                                <Eye size={14} /> View
                              </button>
                              <button onClick={() => { setOpenMenuId(null); navigate('/mga/edit/' + ag.id); }}
                                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 14, color: t.text2 }}>
                                <Edit size={14} /> Edit
                              </button>
                              <button onClick={() => { setOpenMenuId(null); handleDelete(ag.id); }}
                                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 14, color: t.danger }}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} style={{ height: 4 }} />
            {hasMoreAgreements && (
              <div style={{ display: "flex", justifyContent: "center", paddingTop: 16, paddingBottom: 16 }}>
                <RefreshCw size={20} className="animate-spin" style={{ color: t.accent }} />
              </div>
            )}
          </>
        )}
      </div>
      )}

      {/* Detail Modal */}
      {detailAgreement && (
        <DetailModal
          agreement={detailAgreement}
          actualGwp={bdxGwpMap[detailAgreement.id] || 0}
          onClose={() => setDetailAgreement(null)}
          onEdit={() => {
            const id = detailAgreement.id;
            setDetailAgreement(null);
            navigate('/mga/edit/' + id);
          }}
          onDelete={() => handleDelete(detailAgreement.id)}
        />
      )}
    </div>
  );
};

export default MGADashboard;
