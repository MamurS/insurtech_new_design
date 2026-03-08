import { useState, createContext, useContext, useEffect, useRef, useCallback } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const ThemeCtx = createContext({ theme: "dark", setTheme: () => {} });
const useTheme = () => useContext(ThemeCtx).theme;
const useSetTheme = () => useContext(ThemeCtx).setTheme;

const THEMES = {
  dark: {
    bgApp: "#06090f", bgPanel: "#0c1118", bgSidebar: "#080c12", bgInput: "#0a0e16",
    bgInputDis: "#0a0d12", bgRowAlt: "#0e1520", bgCard: "#0d1219", bgHover: "#121c2a", bgActive: "#162640",
    border: "#172030", borderL: "#1c2840", borderS: "#0d1520",
    text1: "#d0dced", text2: "#8ba3c7", text3: "#5a7a9c", text4: "#3a5878", text5: "#253a52",
    topbar: "#080c12", sideGroup: "#2a4060", tagPlBg: "#111", tagPlColor: "#555",
    accent: "#2563eb", accentHover: "#3b82f6", accentMuted: "#1e40af",
    success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
    successBg: "#10b98118", warningBg: "#f59e0b18", dangerBg: "#ef444418",
    shadow: "0 1px 3px rgba(0,0,0,0.4)",
    shadowLg: "0 8px 32px rgba(0,0,0,0.5)",
    glow: "0 0 20px rgba(37,99,235,0.15)",
  },
  light: {
    bgApp: "#f1f5f9", bgPanel: "#ffffff", bgSidebar: "#f8fafc", bgInput: "#ffffff",
    bgInputDis: "#f1f5f9", bgRowAlt: "#f8fafc", bgCard: "#f8fafc", bgHover: "#e2e8f0", bgActive: "#dbeafe",
    border: "#e2e8f0", borderL: "#cbd5e1", borderS: "#f1f5f9",
    text1: "#0f172a", text2: "#334155", text3: "#64748b", text4: "#94a3b8", text5: "#cbd5e1",
    topbar: "#ffffff", sideGroup: "#94a3b8", tagPlBg: "#f1f5f9", tagPlColor: "#94a3b8",
    accent: "#2563eb", accentHover: "#1d4ed8", accentMuted: "#3b82f6",
    success: "#059669", warning: "#d97706", danger: "#dc2626",
    successBg: "#05966918", warningBg: "#d9770618", dangerBg: "#dc262618",
    shadow: "0 1px 3px rgba(0,0,0,0.08)",
    shadowLg: "0 8px 32px rgba(0,0,0,0.12)",
    glow: "0 0 20px rgba(37,99,235,0.08)",
  },
};

// ─── ICONS (SVG inline) ─────────────────────────────────────────────────────
const Icon = ({ name, size = 16, color }) => {
  const s = { width: size, height: size, fill: "none", stroke: color || "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    home: <><path d="M3 9.5L8 4.5L13 9.5"/><path d="M5 8.5V13.5H11V8.5"/></>,
    briefcase: <><rect x="2" y="6" width="12" height="8" rx="1"/><path d="M6 6V4a2 2 0 012-2h0a2 2 0 012 2v2"/></>,
    refresh: <><path d="M3 8a5 5 0 019.5-1.5"/><path d="M13 8a5 5 0 01-9.5 1.5"/><polyline points="3 3 3 8 8 8"/><polyline points="13 13 13 8 8 8"/></>,
    zap: <><polygon points="8 1 3 9 8 9 7 15 13 7 8 7 9 1"/></>,
    wallet: <><rect x="2" y="4" width="12" height="10" rx="2"/><path d="M2 8h12"/><circle cx="11" cy="10" r="1"/></>,
    building: <><rect x="3" y="2" width="10" height="12" rx="1"/><path d="M6 5h1M9 5h1M6 8h1M9 8h1M6 11h4"/></>,
    shield: <><path d="M8 1.5L2 4v4c0 3.5 2.5 6 6 7.5 3.5-1.5 6-4 6-7.5V4L8 1.5z"/></>,
    chart: <><path d="M3 13V8"/><path d="M7 13V5"/><path d="M11 13V2"/></>,
    file: <><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3"/></>,
    users: <><circle cx="6" cy="5" r="2.5"/><path d="M1.5 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><circle cx="11.5" cy="5.5" r="1.8"/><path d="M14.5 13c0-2 1-3.2-1.5-3.5"/></>,
    settings: <><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13"/></>,
    search: <><circle cx="7" cy="7" r="4.5"/><path d="M11 11l3 3"/></>,
    bell: <><path d="M8 14c1 0 1.5-.5 1.5-1.5h-3C6.5 13.5 7 14 8 14z"/><path d="M4 10V7a4 4 0 018 0v3l1.5 2H2.5L4 10z"/></>,
    plus: <><path d="M8 3v10M3 8h10"/></>,
    x: <><path d="M4 4l8 8M12 4l-8 8"/></>,
    chevDown: <><path d="M4 6l4 4 4-4"/></>,
    chevRight: <><path d="M6 4l4 4-4 4"/></>,
    arrowRight: <><path d="M3 8h10M9 4l4 4-4 4"/></>,
    globe: <><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2.5 2 10 0 12M8 2c-2 2.5-2 10 0 12"/></>,
    hash: <><path d="M4 6h9M3 10h9M6 3l-1 10M11 3l-1 10"/></>,
    filter: <><path d="M2 3h12L9 8.5V12l-2 1V8.5L2 3z"/></>,
    edit: <><path d="M10 3l3 3L5 14H2v-3L10 3z"/></>,
    eye: <><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></>,
    trash: <><path d="M3 5h10M5 5V3h6v2M6 8v4M10 8v4"/><path d="M4 5l.5 9a1 1 0 001 1h5a1 1 0 001-1L12 5"/></>,
    download: <><path d="M8 2v9M4 8l4 4 4-4"/><path d="M3 13h10"/></>,
    layers: <><path d="M8 2L2 6l6 4 6-4L8 2z"/><path d="M2 10l6 4 6-4"/></>,
    clock: <><circle cx="8" cy="8" r="6"/><path d="M8 4v4l2.5 1.5"/></>,
    check: <><path d="M3 8l3 3 7-7"/></>,
    moon: <><path d="M12 3a6 6 0 00-8.5 8.5A6 6 0 0012 3z"/></>,
    sun: <><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M12.5 3.5l-1.5 1.5M5 11l-1.5 1.5"/></>,
  };
  return <svg viewBox="0 0 16 16" style={s}>{paths[name]}</svg>;
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const MOCK_POLICIES = [
  { id: "POL-2024-001", client: "UzTransgaz JSC", product: "Property All Risks", premium: 45200, currency: "USD", status: "Active", inception: "2024-01-15", expiry: "2025-01-14", stage: "Bound", type: "direct", class: "08, 09" },
  { id: "POL-2024-002", client: "Almalyk GMK", product: "D&O Liability", premium: 18500, currency: "USD", status: "Active", inception: "2024-03-01", expiry: "2025-02-28", stage: "Bound", type: "direct", class: "16" },
  { id: "POL-2024-003", client: "Navoi MMC", product: "Trade Credit", premium: 62000, currency: "USD", status: "Pending", inception: "2024-06-01", expiry: "2025-05-31", stage: "Quote", type: "direct", class: "14" },
  { id: "POL-2024-004", client: "Uzbekistan Airways", product: "Surety Bond", premium: 8900, currency: "USD", status: "Active", inception: "2024-02-10", expiry: "2025-02-09", stage: "Bound", type: "direct", class: "15" },
  { id: "POL-2024-005", client: "Ipoteka Bank", product: "BBB", premium: 31000, currency: "USD", status: "Renewal", inception: "2023-07-01", expiry: "2024-06-30", stage: "Renewal", type: "direct", class: "16" },
  { id: "POL-2024-006", client: "Hamkorbank OJSC", product: "D&O Liability", premium: 14200, currency: "USD", status: "Lapsed", inception: "2023-04-01", expiry: "2024-03-31", stage: "Expired", type: "direct", class: "16" },
  { id: "POL-2024-007", client: "PKN Orlen UZ", product: "Property All Risks", premium: 88000, currency: "USD", status: "Active", inception: "2024-04-15", expiry: "2025-04-14", stage: "Bound", type: "direct", class: "08, 09" },
  { id: "POL-2024-008", client: "Mortgage Refinancing Co", product: "Trade Credit", premium: 27500, currency: "USD", status: "Pending", inception: "2024-07-01", expiry: "2025-06-30", stage: "Referral", type: "direct", class: "14" },
];

const MOCK_INWARD = [
  { id: "INW-2024-001", cedant: "Alfa Insurance RU", product: "Property All Risks", ourShare: 25, premium: 18500, currency: "USD", status: "Active", inception: "2024-01-01", expiry: "2024-12-31", contractType: "Facultative", subType: "foreign" },
  { id: "INW-2024-002", cedant: "Swiss Re", product: "Marine Hull", ourShare: 15, premium: 42000, currency: "USD", status: "Active", inception: "2024-03-01", expiry: "2025-02-28", contractType: "Treaty - QS", subType: "foreign" },
  { id: "INW-2024-003", cedant: "Kafolat JSC", product: "Motor Fleet", ourShare: 30, premium: 9800, currency: "USD", status: "Active", inception: "2024-02-01", expiry: "2025-01-31", contractType: "Facultative", subType: "domestic" },
  { id: "INW-2024-004", cedant: "Gross Insurance", product: "Property All Risks", ourShare: 20, premium: 14200, currency: "USD", status: "Pending", inception: "2024-06-01", expiry: "2025-05-31", contractType: "Facultative", subType: "domestic" },
  { id: "INW-2024-005", cedant: "Munich Re", product: "Energy Onshore", ourShare: 10, premium: 67000, currency: "USD", status: "Active", inception: "2024-04-01", expiry: "2025-03-31", contractType: "Treaty - XL", subType: "foreign" },
];

const MODULES = [
  { id: "policy", label: "Policy Admin", icon: "briefcase", layer: "core", color: "#2563eb", enabled: true, required: true, version: "v2.1", desc: "Full policy lifecycle", deps: [], events: ["PolicyIssued", "PolicyEndorsed", "PolicyRenewed", "PolicyCancelled"], functions: [{ name: "Quote Management", status: "live" }, { name: "Policy Binding", status: "live" }, { name: "Endorsements", status: "live" }, { name: "Renewals Engine", status: "dev" }, { name: "Cancellations", status: "planned" }, { name: "Document Generation", status: "live" }] },
  { id: "claims", label: "Claims", icon: "zap", layer: "core", color: "#ef4444", enabled: true, required: false, version: "v1.4", desc: "End-to-end claims lifecycle", deps: ["policy"], events: ["ClaimRegistered", "ReserveUpdated", "ClaimPaid", "ClaimClosed"], functions: [{ name: "FNOL Registration", status: "live" }, { name: "Reserve Setting", status: "live" }, { name: "Claims Investigation", status: "dev" }, { name: "Payment Processing", status: "dev" }, { name: "Subrogation", status: "planned" }, { name: "Claims Analytics", status: "planned" }] },
  { id: "reinsurance", label: "Reinsurance", icon: "refresh", layer: "specialty", color: "#8b5cf6", enabled: true, required: false, version: "v1.0", desc: "Treaty & facultative accounting", deps: ["policy", "claims"], events: ["CessionCalculated", "BordereauGenerated", "RIPaymentDue"], functions: [{ name: "Treaty Registry", status: "live" }, { name: "Facultative Slips", status: "live" }, { name: "Cession Calculation", status: "dev" }, { name: "Loss Bordereau", status: "dev" }, { name: "Premium Bordereau", status: "planned" }, { name: "RI Accounting", status: "planned" }] },
  { id: "financial_lines", label: "Financial Lines", icon: "shield", layer: "specialty", color: "#10b981", enabled: true, required: false, version: "v0.9", desc: "Credit, Surety, D&O, BBB", deps: ["policy"], events: ["CreditLimitSet", "BondIssued", "DefaultNotified"], functions: [{ name: "Trade Credit UW", status: "live" }, { name: "Surety Bonds", status: "live" }, { name: "D&O Liability", status: "dev" }, { name: "BBB Module", status: "dev" }, { name: "Credit Monitoring", status: "planned" }, { name: "NPI", status: "planned" }] },
  { id: "billing", label: "Billing", icon: "wallet", layer: "core", color: "#f59e0b", enabled: true, required: false, version: "v1.2", desc: "Premium billing & commissions", deps: ["policy"], events: ["InvoiceCreated", "PaymentReceived", "CommissionPaid"], functions: [{ name: "Premium Invoicing", status: "live" }, { name: "Installment Plans", status: "live" }, { name: "Agent Commissions", status: "dev" }, { name: "Broker Statements", status: "dev" }, { name: "Collections Workflow", status: "planned" }, { name: "Refund Processing", status: "planned" }] },
  { id: "finance", label: "Finance", icon: "building", layer: "foundation", color: "#06b6d4", enabled: true, required: true, version: "v1.1", desc: "GL, reserves, IFRS 17", deps: ["policy", "billing", "claims"], events: ["JournalPosted", "ReserveCalculated", "ReportGenerated"], functions: [{ name: "General Ledger", status: "dev" }, { name: "Insurance Reserves", status: "planned" }, { name: "IFRS 17 Engine", status: "planned" }, { name: "Regulatory Reporting", status: "planned" }, { name: "FX Management", status: "live" }, { name: "Budgeting & Forecast", status: "planned" }] },
];

const LAYERS = [
  { id: "specialty", label: "Specialty Modules", color: "#8b5cf6" },
  { id: "core", label: "Core Insurance", color: "#2563eb" },
  { id: "foundation", label: "Financial Foundation", color: "#06b6d4" },
];

const CURRENCIES = ["USD", "EUR", "UZS", "GBP", "RUB", "KZT", "CHF"];
const COUNTRIES = ["Uzbekistan", "Russia", "Kazakhstan", "United Kingdom", "Germany", "France", "Switzerland", "UAE", "Turkey", "USA", "South Korea", "Other"];
const INSURANCE_PRODUCTS = [
  { id: 1, name: "Property All Risks", code: "PAR", class: "08, 09" },
  { id: 2, name: "Construction All Risks", code: "CAR", class: "08" },
  { id: 3, name: "General Third Party Liability", code: "GTPL", class: "13" },
  { id: 4, name: "Directors & Officers", code: "DO", class: "16" },
  { id: 5, name: "Bankers Blanket Bond", code: "BBB", class: "16" },
  { id: 6, name: "Trade Credit Insurance", code: "TCI", class: "14" },
  { id: 7, name: "Surety Bond", code: "SUR", class: "15" },
  { id: 8, name: "Cargo Insurance", code: "CAG", class: "07" },
  { id: 9, name: "Energy Onshore", code: "ENO", class: "08" },
  { id: 10, name: "Marine Hull", code: "MAR", class: "06" },
];
const MOCK_ENTITIES = [
  { id: 1, name: "UzTransgaz JSC", type: "Insured", country: "Uzbekistan", inn: "200234567", industry: "Energy / Gas" },
  { id: 2, name: "Almalyk GMK", type: "Insured", country: "Uzbekistan", inn: "200456789", industry: "Mining / Metals" },
  { id: 3, name: "Navoi MMC", type: "Insured", country: "Uzbekistan", inn: "200123456", industry: "Mining / Gold" },
  { id: 4, name: "Uzbekistan Airways", type: "Insured", country: "Uzbekistan", inn: "200567890", industry: "Aviation" },
  { id: 5, name: "Ipoteka Bank", type: "Insured", country: "Uzbekistan", inn: "200678901", industry: "Banking" },
  { id: 6, name: "Kafolat JSC", type: "Cedant", country: "Uzbekistan", inn: "200111222", industry: "Insurance" },
  { id: 7, name: "Marsh (UK) Ltd", type: "Broker", country: "United Kingdom", inn: null, industry: "Insurance Broking" },
  { id: 8, name: "Munich Re", type: "Cedant", country: "Germany", inn: null, industry: "Reinsurance" },
  { id: 9, name: "Swiss Re", type: "Cedant", country: "Switzerland", inn: null, industry: "Reinsurance" },
  { id: 10, name: "Alfa Insurance", type: "Cedant", country: "Russia", inn: null, industry: "Insurance" },
];
const FX_RATES = { USD: 12750, EUR: 13820, GBP: 16100, RUB: 138, KZT: 28, CHF: 14200, UZS: 1 };

const MOCK_USERS = [
  { id: 1, name: "Mamur Yusupov", email: "m.yusupov@mosaic.uz", role: "Super Admin", status: "Active", last: "Just now" },
  { id: 2, name: "Dilshod Karimov", email: "d.karimov@mosaic.uz", role: "Underwriter", status: "Active", last: "2h ago" },
  { id: 3, name: "Nodira Azimova", email: "n.azimova@mosaic.uz", role: "Claims", status: "Active", last: "1d ago" },
  { id: 4, name: "Akbar Rakhimov", email: "a.rakhimov@mosaic.uz", role: "Finance", status: "Active", last: "3h ago" },
  { id: 5, name: "Zarina Usmanova", email: "z.usmanova@mosaic.uz", role: "Viewer", status: "Inactive", last: "30d ago" },
];

const MOCK_ACTIVITY = [
  { ev: "PolicyIssued", pol: "POL-2024-007", client: "PKN Orlen UZ", time: "2h ago", color: "#10b981" },
  { ev: "RenewalDue", pol: "POL-2024-005", client: "Ipoteka Bank", time: "1d ago", color: "#2563eb" },
  { ev: "ClaimRegistered", pol: "POL-2024-002", client: "Almalyk GMK", time: "2d ago", color: "#ef4444" },
  { ev: "QuoteSubmitted", pol: "POL-2024-008", client: "Mortgage Co", time: "3d ago", color: "#f59e0b" },
  { ev: "CessionCalculated", pol: "INW-2024-005", client: "Munich Re", time: "4d ago", color: "#8b5cf6" },
];

const FX_MOCK = [
  { currency: "USD", rate: 12750, prev: 12680, source: "CBU.uz" },
  { currency: "EUR", rate: 13820, prev: 13900, source: "CBU.uz" },
  { currency: "GBP", rate: 16100, prev: 16050, source: "CBU.uz" },
  { currency: "RUB", rate: 138, prev: 140, source: "CBU.uz" },
];

const MOCK_AUDIT = [
  { time: "09:15", user: "m.yusupov", action: "Policy Bound", detail: "POL-2024-007 · PKN Orlen UZ" },
  { time: "08:40", user: "d.karimov", action: "Quote Created", detail: "POL-2024-008 · Mortgage Co" },
  { time: "Yesterday", user: "n.azimova", action: "Claim Registered", detail: "CLM-2024-003 · Almalyk GMK" },
  { time: "Yesterday", user: "a.rakhimov", action: "Payment Recorded", detail: "INV-2024-012 · $45,200" },
  { time: "Mar 02", user: "m.yusupov", action: "User Invited", detail: "z.usmanova@mosaic.uz" },
];

// ─── STATUS STYLING ─────────────────────────────────────────────────────────
const statusStyle = {
  Active: { bg: "#10b98118", color: "#10b981", dot: "#10b981" },
  Pending: { bg: "#f59e0b18", color: "#f59e0b", dot: "#f59e0b" },
  Renewal: { bg: "#2563eb18", color: "#3b82f6", dot: "#3b82f6" },
  Lapsed: { bg: "#ef444418", color: "#ef4444", dot: "#ef4444" },
  Inactive: { bg: "#64748b18", color: "#64748b", dot: "#64748b" },
};
const stageColor = { Quote: "#3b82f6", Referral: "#f59e0b", Bound: "#10b981", Renewal: "#8b5cf6", Expired: "#64748b", Facultative: "#8b5cf6", "Treaty - QS": "#10b981", "Treaty - XL": "#f59e0b", "Treaty - Surplus": "#06b6d4" };
const roleColor = { "Super Admin": "#ef4444", Admin: "#f59e0b", Underwriter: "#2563eb", Claims: "#8b5cf6", Finance: "#06b6d4", Viewer: "#64748b" };
const sbadge = {
  live: { bg: "#10b98118", color: "#10b981", label: "Live" },
  dev: { bg: "#3b82f618", color: "#3b82f6", label: "In Dev" },
  planned: { bg: "#64748b12", color: "#64748b", label: "Planned" },
};

// ─── REUSABLE UI ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = statusStyle[status] || statusStyle.Pending;
  return <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 20, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 500 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />{status}</span>;
}

function StageBadge({ stage }) {
  const c = stageColor[stage] || "#64748b";
  return <span style={{ background: `${c}15`, color: c, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{stage}</span>;
}

function Btn({ children, variant = "primary", size = "md", icon, onClick, style: sx }) {
  const theme = useTheme(); const t = THEMES[theme];
  const base = { display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 7, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s", fontFamily: "inherit" };
  const sizes = { sm: { padding: "5px 10px", fontSize: 11 }, md: { padding: "7px 14px", fontSize: 12 }, lg: { padding: "10px 20px", fontSize: 13 } };
  const variants = {
    primary: { background: t.accent, color: "#fff" },
    ghost: { background: "transparent", color: t.text2, border: `1px solid ${t.border}` },
    danger: { background: t.dangerBg, color: t.danger },
    success: { background: t.successBg, color: t.success },
  };
  return <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...sx }} onMouseEnter={e => { if (variant === "primary") e.currentTarget.style.background = t.accentHover; else e.currentTarget.style.background = t.bgHover; }} onMouseLeave={e => { e.currentTarget.style.background = variants[variant].background; }}>{icon && <Icon name={icon} size={14} />}{children}</button>;
}

function Input({ value, onChange, placeholder, type = "text", disabled, style: sx }) {
  const theme = useTheme(); const t = THEMES[theme];
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{ width: "100%", padding: "8px 12px", borderRadius: 7, background: disabled ? t.bgInputDis : t.bgInput, border: `1px solid ${t.border}`, color: disabled ? t.text4 : t.text1, fontSize: 12, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s", fontFamily: "inherit", ...sx }} onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />;
}

function Select({ value, onChange, options, placeholder }) {
  const theme = useTheme(); const t = THEMES[theme];
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 7, background: t.bgInput, border: `1px solid ${t.border}`, color: value ? t.text1 : t.text4, fontSize: 12, outline: "none", fontFamily: "inherit" }}>
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
  </select>;
}

function EntitySearch({ value, onChange, onSelect, placeholder, entities }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const theme = useTheme(); const t = THEMES[theme];
  const filtered = q.length > 1 ? entities.filter(e => e.name.toLowerCase().includes(q.toLowerCase())) : [];
  return <div style={{ position: "relative" }}>
    <input value={value ? value.name : q} onChange={e => { setQ(e.target.value); onChange(null); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={placeholder} style={{ width: "100%", padding: "8px 12px", borderRadius: 7, background: t.bgInput, border: `1px solid ${t.border}`, color: t.text1, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
    {open && filtered.length > 0 && <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: t.bgPanel, border: `1px solid ${t.borderL}`, borderRadius: 8, marginTop: 4, boxShadow: t.shadowLg, overflow: "hidden" }}>
      {filtered.slice(0, 5).map(e => <div key={e.id} onClick={() => { onSelect(e); setOpen(false); setQ(""); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${t.borderS}` }} onMouseEnter={ev => ev.currentTarget.style.background = t.bgHover} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
        <div style={{ color: t.text1, fontSize: 12, fontWeight: 500 }}>{e.name}</div>
        <div style={{ color: t.text4, fontSize: 10, marginTop: 2 }}>{e.type} · {e.country}</div>
      </div>)}
    </div>}
  </div>;
}

function ProductSearch({ value, onChange, onSelect }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const theme = useTheme(); const t = THEMES[theme];
  const filtered = q.length > 1 ? INSURANCE_PRODUCTS.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase())) : [];
  return <div style={{ position: "relative" }}>
    <input value={value ? value.name : q} onChange={e => { setQ(e.target.value); onChange(null); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search cover type..." style={{ width: "100%", padding: "8px 12px", borderRadius: 7, background: THEMES[useTheme()].bgInput, border: `1px solid ${THEMES[useTheme()].border}`, color: THEMES[useTheme()].text1, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
    {open && filtered.length > 0 && <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: THEMES[useTheme()].bgPanel, border: `1px solid ${THEMES[useTheme()].borderL}`, borderRadius: 8, marginTop: 4, boxShadow: THEMES[useTheme()].shadowLg }}>
      {filtered.slice(0, 6).map(p => <div key={p.id} onClick={() => { onSelect(p); setOpen(false); setQ(""); }} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${THEMES[useTheme()].borderS}` }} onMouseEnter={ev => ev.currentTarget.style.background = THEMES[useTheme()].bgHover} onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: THEMES[useTheme()].text1, fontSize: 12 }}>{p.name}</span><span style={{ color: THEMES[useTheme()].text4, fontSize: 10, fontFamily: "monospace" }}>{p.code}</span></div>
        <div style={{ color: THEMES[useTheme()].text4, fontSize: 10 }}>Class {p.class}</div>
      </div>)}
    </div>}
  </div>;
}

function SectionCard({ title, subtitle, icon, color, children }) {
  const theme = useTheme(); const t = THEMES[theme];
  return <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
    <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, borderLeft: `3px solid ${color}`, display: "flex", alignItems: "center", gap: 10 }}>
      {icon && <Icon name={icon} size={18} color={color} />}
      <div>
        <div style={{ fontWeight: 600, color: t.text1, fontSize: 13 }}>{title}</div>
        {subtitle && <div style={{ color: t.text4, fontSize: 11, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </div>;
}

function Field({ label, required, hint, col = 1, children }) {
  const theme = useTheme(); const t = THEMES[theme];
  return <div style={{ gridColumn: `span ${col}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
      <label style={{ fontSize: 11, color: t.text3, fontWeight: 500, letterSpacing: "0.3px" }}>{label}</label>
      {required && <span style={{ color: t.danger, fontSize: 11 }}>*</span>}
      {hint && <span style={{ fontSize: 10, color: t.text5, marginLeft: 4 }}>{hint}</span>}
    </div>
    {children}
  </div>;
}

function KpiCard({ label, value, delta, up, sub, color = "#2563eb", icon }) {
  const theme = useTheme(); const t = THEMES[theme];
  return <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: "18px 20px", position: "relative", overflow: "hidden", boxShadow: t.shadow }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: t.text3, fontWeight: 500, letterSpacing: "0.5px" }}>{label}</div>
      {icon && <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={16} color={color} /></div>}
    </div>
    <div style={{ fontSize: 24, fontWeight: 700, color: t.text1, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {delta && <span style={{ fontSize: 11, color: up === true ? t.success : up === false ? t.danger : t.accent, fontWeight: 600 }}>{up === true ? "↑" : up === false ? "↓" : "→"} {delta}</span>}
      {sub && <span style={{ fontSize: 10, color: t.text5 }}>· {sub}</span>}
    </div>
    <div style={{ position: "absolute", right: -8, bottom: -8, width: 64, height: 64, borderRadius: "50%", background: `${color}06` }} />
  </div>;
}

// ─── COMMAND PALETTE ────────────────────────────────────────────────────────
function CommandPalette({ open, onClose, navigate }) {
  const theme = useTheme(); const t = THEMES[theme];
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const commands = [
    { label: "Dashboard", icon: "home", action: () => navigate("dashboard") },
    { label: "Policy Admin", icon: "briefcase", action: () => navigate("policy-admin") },
    { label: "Inward Reinsurance", icon: "refresh", action: () => navigate("inward") },
    { label: "Claims", icon: "zap", action: () => navigate("claims") },
    { label: "Financial Lines", icon: "shield", action: () => navigate("financial-lines") },
    { label: "Billing", icon: "wallet", action: () => navigate("billing") },
    { label: "Finance", icon: "building", action: () => navigate("finance") },
    { label: "New Direct Policy", icon: "plus", action: () => navigate("new-request", "direct") },
    { label: "New Inward Foreign", icon: "globe", action: () => navigate("new-request", "inward_foreign") },
    { label: "New Inward Domestic", icon: "home", action: () => navigate("new-request", "inward_domestic") },
    { label: "Admin Console", icon: "settings", action: () => navigate("admin") },
  ];
  const filtered = q ? commands.filter(c => c.label.toLowerCase().includes(q.toLowerCase())) : commands;

  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120 }} onClick={onClose}>
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
    <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: 480, background: t.bgPanel, border: `1px solid ${t.borderL}`, borderRadius: 14, boxShadow: t.shadowLg, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <Icon name="search" size={16} color={t.text4} />
        <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Search commands, pages..." style={{ flex: 1, background: "none", border: "none", color: t.text1, fontSize: 14, outline: "none", fontFamily: "inherit" }} />
        <span style={{ fontSize: 10, color: t.text5, background: t.bgApp, padding: "2px 6px", borderRadius: 4, border: `1px solid ${t.border}` }}>ESC</span>
      </div>
      <div style={{ maxHeight: 320, overflowY: "auto", padding: "6px" }}>
        {filtered.map((c, i) => <div key={i} onClick={() => { c.action(); onClose(); setQ(""); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <Icon name={c.icon} size={16} color={t.text3} />
          <span style={{ color: t.text1, fontSize: 13 }}>{c.label}</span>
        </div>)}
        {filtered.length === 0 && <div style={{ padding: 20, textAlign: "center", color: t.text4, fontSize: 13 }}>No results found</div>}
      </div>
    </div>
  </div>;
}

// ─── NOTIFICATION PANEL ────────────────────────────────────────────────────────
function NotificationPanel({ open, onClose }) {
  const theme = useTheme(); const t = THEMES[theme];
  if (!open) return null;
  return <>
    <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={onClose} />
    <div style={{ position: "absolute", top: 44, right: 8, width: 340, background: t.bgPanel, border: `1px solid ${t.borderL}`, borderRadius: 12, boxShadow: t.shadowLg, zIndex: 999, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: t.text1, fontSize: 13 }}>Notifications</span>
        <span style={{ fontSize: 11, color: t.accent, cursor: "pointer", fontWeight: 500 }}>Mark all read</span>
      </div>
      <div style={{ maxHeight: 360, overflowY: "auto" }}>
        {MOCK_ACTIVITY.map((a, i) => <div key={i} style={{ padding: "12px 16px", borderBottom: `1px solid ${t.borderS}`, display: "flex", gap: 10 }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: t.text1, fontWeight: 500 }}>{a.ev}</div>
            <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>{a.client} · {a.pol}</div>
            <div style={{ fontSize: 10, color: t.text5, marginTop: 3 }}>{a.time}</div>
          </div>
        </div>)}
      </div>
    </div>
  </>;
}

// ─── PAGES ────────────────────────────────────────────────────────────────────

// DASHBOARD
function Dashboard({ navigate }) {
  const theme = useTheme(); const t = THEMES[theme];
  const kpis = [
    { label: "Total GWP", value: "$295,300", delta: "12.4%", up: true, sub: "YTD", color: "#2563eb", icon: "chart" },
    { label: "Active Policies", value: "4", delta: "+1", up: true, sub: "This month", color: "#10b981", icon: "file" },
    { label: "Inward Contracts", value: "5", delta: "+2", up: true, sub: "Foreign + Domestic", color: "#8b5cf6", icon: "refresh" },
    { label: "Renewal Pipeline", value: "$45,700", delta: "30 days", up: null, sub: "Upcoming", color: "#f59e0b", icon: "clock" },
  ];
  const byProduct = [
    { label: "Property All Risks", v: 133200, pct: 45, c: "#2563eb" },
    { label: "Trade Credit", v: 89500, pct: 30, c: "#10b981" },
    { label: "D&O / BBB", v: 32700, pct: 11, c: "#8b5cf6" },
    { label: "Surety Bond", v: 8900, pct: 3, c: "#f59e0b" },
    { label: "Other", v: 31000, pct: 11, c: "#06b6d4" },
  ];
  return <div style={{ padding: "24px 28px" }}>
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.text1, marginBottom: 4, letterSpacing: "-0.3px" }}>Dashboard</div>
      <div style={{ color: t.text3, fontSize: 12 }}>Portfolio overview · Mosaic Insurance Group JSC</div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
      {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
      {/* GWP by Product */}
      <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 22, boxShadow: t.shadow }}>
        <div style={{ fontWeight: 600, color: t.text1, marginBottom: 4, fontSize: 13 }}>GWP by Product Line</div>
        <div style={{ color: t.text4, fontSize: 11, marginBottom: 18 }}>Written premium distribution</div>
        {byProduct.map(item => <div key={item.label} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: t.text2, fontSize: 12 }}>{item.label}</span>
            <span style={{ color: t.text1, fontWeight: 600, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>${item.v.toLocaleString()}</span>
          </div>
          <div style={{ height: 6, background: t.bgApp, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, width: `${item.pct}%`, background: `linear-gradient(90deg, ${item.c}, ${item.c}88)`, transition: "width 0.6s ease" }} />
          </div>
        </div>)}
      </div>
      {/* Recent Activity */}
      <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 22, boxShadow: t.shadow }}>
        <div style={{ fontWeight: 600, color: t.text1, marginBottom: 4, fontSize: 13 }}>Recent Activity</div>
        <div style={{ color: t.text4, fontSize: 11, marginBottom: 18 }}>Latest policy events</div>
        {MOCK_ACTIVITY.map((e, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < MOCK_ACTIVITY.length - 1 ? `1px solid ${t.borderS}` : "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${e.color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.color }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: t.text1, fontSize: 12, fontWeight: 500 }}>{e.client}</div>
            <div style={{ color: t.text4, fontSize: 11 }}>{e.ev} · {e.pol}</div>
          </div>
          <div style={{ color: t.text5, fontSize: 10, flexShrink: 0 }}>{e.time}</div>
        </div>)}
      </div>
    </div>
    {/* Quick Nav Cards */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
      {[
        { label: "Policy Admin", icon: "briefcase", desc: "Direct insurance", color: "#2563eb", nav: "policy-admin" },
        { label: "Inward RI", icon: "refresh", desc: "Foreign & domestic", color: "#8b5cf6", nav: "inward" },
        { label: "Claims", icon: "zap", desc: "FNOL & settlements", color: "#ef4444", nav: "claims" },
        { label: "Finance", icon: "building", desc: "GL & FX rates", color: "#06b6d4", nav: "finance" },
      ].map(c => <div key={c.nav} onClick={() => navigate(c.nav)} style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: "18px 20px", cursor: "pointer", transition: "all 0.2s", boxShadow: t.shadow }} onMouseEnter={e => { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.boxShadow = `0 0 0 1px ${c.color}33`; }} onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = t.shadow; }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${c.color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={c.icon} size={18} color={c.color} />
          </div>
          <div style={{ fontWeight: 600, color: t.text1, fontSize: 13 }}>{c.label}</div>
        </div>
        <div style={{ color: t.text4, fontSize: 11, marginBottom: 10 }}>{c.desc}</div>
        <div style={{ color: c.color, fontSize: 11, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>Open <Icon name="arrowRight" size={12} color={c.color} /></div>
      </div>)}
    </div>
  </div>;
}

// POLICY ADMIN
function PolicyAdmin({ navigate }) {
  const theme = useTheme(); const t = THEMES[theme];
  const [stageFilter, setStageFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const stages = ["All", "Quote", "Referral", "Bound", "Renewal", "Expired"];

  let filtered = stageFilter === "All" ? MOCK_POLICIES : MOCK_POLICIES.filter(p => p.stage === stageFilter);
  if (search) filtered = filtered.filter(p => p.client.toLowerCase().includes(search.toLowerCase()) || p.id.toLowerCase().includes(search.toLowerCase()) || p.product.toLowerCase().includes(search.toLowerCase()));
  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }
  const pol = MOCK_POLICIES.find(p => p.id === selected);
  const toggleSort = (key) => { if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("asc"); } };
  const SortIcon = ({ k }) => sortKey === k ? <span style={{ color: t.accent, fontSize: 10 }}>{sortDir === "asc" ? "↑" : "↓"}</span> : null;

  return <div style={{ padding: "24px 28px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.text1, letterSpacing: "-0.3px" }}>Policy Administration</div>
        <div style={{ color: t.text3, fontSize: 12, marginTop: 4 }}>Direct insurance · Full lifecycle management</div>
      </div>
      <Btn icon="plus" onClick={() => navigate("new-request", "direct")}>New Request</Btn>
    </div>

    {/* Stats row */}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
      {[
        { label: "Total GWP", value: "$295,300", delta: "12.4%", up: true, color: "#2563eb", icon: "chart" },
        { label: "Active", value: "4", delta: "+1", up: true, color: "#10b981", icon: "check" },
        { label: "Avg Premium", value: "$36,913", delta: "3.2%", up: false, color: "#f59e0b", icon: "hash" },
        { label: "Renewal Pipeline", value: "$45,700", delta: "30d", up: null, color: "#8b5cf6", icon: "clock" },
      ].map((k, i) => <KpiCard key={i} {...k} />)}
    </div>

    {/* Filter bar */}
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
        <Icon name="search" size={14} color={t.text4} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search policies..." style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8, background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1, fontSize: 12, outline: "none", fontFamily: "inherit", position: "relative" }} onFocus={e => e.target.style.borderColor = t.accent} onBlur={e => e.target.style.borderColor = t.border} />
        <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={14} color={t.text4} /></div>
      </div>
      <div style={{ display: "flex", gap: 4, background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, padding: 3 }}>
        {stages.map(s => <button key={s} onClick={() => setStageFilter(s)} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, border: "none", cursor: "pointer", background: stageFilter === s ? t.accent : "transparent", color: stageFilter === s ? "#fff" : t.text3, fontWeight: stageFilter === s ? 600 : 400, transition: "all 0.15s", fontFamily: "inherit" }}>{s}</button>)}
      </div>
      <div style={{ color: t.text4, fontSize: 11 }}>{filtered.length} contracts</div>
    </div>

    {/* Table */}
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 360px" : "1fr", gap: 16 }}>
      <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden", boxShadow: t.shadow }}>
        <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 150px 100px 90px 90px", padding: "10px 20px", borderBottom: `1px solid ${t.border}`, color: t.text4, fontSize: 11, fontWeight: 600, letterSpacing: "0.4px" }}>
          <span onClick={() => toggleSort("id")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>POLICY NO. <SortIcon k="id" /></span>
          <span onClick={() => toggleSort("client")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>INSURED / PRODUCT <SortIcon k="client" /></span>
          <span>PERIOD</span>
          <span onClick={() => toggleSort("premium")} style={{ cursor: "pointer", textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>PREMIUM <SortIcon k="premium" /></span>
          <span style={{ textAlign: "center" }}>STAGE</span>
          <span style={{ textAlign: "center" }}>STATUS</span>
        </div>
        {filtered.map(p => <div key={p.id} onClick={() => setSelected(selected === p.id ? null : p.id)} style={{ display: "grid", gridTemplateColumns: "130px 1fr 150px 100px 90px 90px", padding: "12px 20px", borderBottom: `1px solid ${t.borderS}`, cursor: "pointer", background: selected === p.id ? t.bgActive : "transparent", transition: "background 0.12s" }} onMouseEnter={e => { if (selected !== p.id) e.currentTarget.style.background = t.bgHover; }} onMouseLeave={e => { if (selected !== p.id) e.currentTarget.style.background = "transparent"; }}>
          <span style={{ color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500 }}>{p.id}</span>
          <div><div style={{ color: t.text1, fontWeight: 500, fontSize: 12 }}>{p.client}</div><div style={{ color: t.text3, fontSize: 11, marginTop: 1 }}>{p.product}</div></div>
          <div style={{ fontSize: 11 }}><div style={{ color: t.text2 }}>{p.inception}</div><div style={{ color: t.text4 }}>→ {p.expiry}</div></div>
          <span style={{ textAlign: "right", color: t.text1, fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>${p.premium.toLocaleString()}</span>
          <span style={{ textAlign: "center" }}><StageBadge stage={p.stage} /></span>
          <span style={{ textAlign: "center" }}><StatusBadge status={p.status} /></span>
        </div>)}
      </div>

      {/* Detail panel */}
      {pol && <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden", boxShadow: t.shadow }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: t.text1, fontSize: 13 }}>Policy Detail</span>
          <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: t.text4, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, color: t.text4, fontWeight: 600, letterSpacing: "0.5px", marginBottom: 4 }}>POLICY NUMBER</div>
            <div style={{ color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 600 }}>{pol.id}</div>
          </div>
          {[["Insured", pol.client], ["Product", pol.product], ["Class", pol.class], ["Inception", pol.inception], ["Expiry", pol.expiry], ["Premium", `$${pol.premium.toLocaleString()}`], ["Currency", pol.currency]].map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${t.borderS}` }}><span style={{ color: t.text3, fontSize: 12 }}>{l}</span><span style={{ color: t.text1, fontWeight: 500, fontSize: 12 }}>{v}</span></div>)}
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            {["Issue Endorsement", "Initiate Renewal", "Generate Certificate", "View Claims"].map(a => <Btn key={a} variant="ghost" size="sm" style={{ justifyContent: "flex-start", width: "100%" }}>{a}</Btn>)}
          </div>
        </div>
      </div>}
    </div>
  </div>;
}

// INWARD REINSURANCE
function InwardReinsurance({ navigate }) {
  const theme = useTheme(); const t = THEMES[theme];
  const [subType, setSubType] = useState("all");
  const [search, setSearch] = useState("");
  const types = ["all", "foreign", "domestic"];
  let filtered = subType === "all" ? MOCK_INWARD : MOCK_INWARD.filter(c => c.subType === subType);
  if (search) filtered = filtered.filter(c => c.cedant.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()));

  return <div style={{ padding: "24px 28px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.text1, letterSpacing: "-0.3px" }}>Inward Reinsurance</div>
        <div style={{ color: t.text3, fontSize: 12, marginTop: 4 }}>Foreign & domestic inward contracts</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn icon="globe" onClick={() => navigate("new-request", "inward_foreign")}>New Foreign</Btn>
        <Btn variant="ghost" icon="home" onClick={() => navigate("new-request", "inward_domestic")}>New Domestic</Btn>
      </div>
    </div>

    {/* Filter bar */}
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contracts..." style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8, background: t.bgPanel, border: `1px solid ${t.border}`, color: t.text1, fontSize: 12, outline: "none", fontFamily: "inherit" }} />
        <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><Icon name="search" size={14} color={t.text4} /></div>
      </div>
      <div style={{ display: "flex", gap: 4, background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 8, padding: 3 }}>
        {types.map(s => <button key={s} onClick={() => setSubType(s)} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 11, border: "none", cursor: "pointer", background: subType === s ? t.accent : "transparent", color: subType === s ? "#fff" : t.text3, fontWeight: subType === s ? 600 : 400, transition: "all 0.15s", fontFamily: "inherit", textTransform: "capitalize" }}>{s === "all" ? "All" : s === "foreign" ? "Foreign" : "Domestic"}</button>)}
      </div>
      <div style={{ color: t.text4, fontSize: 11 }}>{filtered.length} contracts</div>
    </div>

    {/* Table */}
    <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden", boxShadow: t.shadow }}>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 100px 80px 100px 140px 80px", padding: "10px 20px", borderBottom: `1px solid ${t.border}`, color: t.text4, fontSize: 11, fontWeight: 600, letterSpacing: "0.4px" }}>
        <span>CONTRACT NO.</span><span>CEDANT / PRODUCT</span><span>TYPE</span><span style={{ textAlign: "right" }}>SHARE</span><span style={{ textAlign: "right" }}>PREMIUM</span><span>PERIOD</span><span style={{ textAlign: "center" }}>STATUS</span>
      </div>
      {filtered.map(c => <div key={c.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr 100px 80px 100px 140px 80px", padding: "12px 20px", borderBottom: `1px solid ${t.borderS}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <span style={{ color: t.accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500 }}>{c.id}</span>
        <div><div style={{ color: t.text1, fontWeight: 500, fontSize: 12 }}>{c.cedant}</div><div style={{ color: t.text3, fontSize: 11, marginTop: 1 }}>{c.product}</div></div>
        <StageBadge stage={c.contractType} />
        <span style={{ textAlign: "right", color: t.text1, fontWeight: 600, fontSize: 12 }}>{c.ourShare}%</span>
        <span style={{ textAlign: "right", color: t.text1, fontWeight: 600, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>${c.premium.toLocaleString()}</span>
        <div style={{ fontSize: 11 }}><div style={{ color: t.text2 }}>{c.inception}</div><div style={{ color: t.text4 }}>→ {c.expiry}</div></div>
        <span style={{ textAlign: "center" }}><StatusBadge status={c.status} /></span>
      </div>)}
    </div>
  </div>;
}

// NEW REQUEST FORM
function NewRequestForm({ navigate, initialType = "direct" }) {
  const theme = useTheme(); const t = THEMES[theme];
  const [reqType, setReqType] = useState(initialType);
  const REQUEST_TYPES = [
    { id: "direct", label: "Direct Insurance", icon: "briefcase", color: "#2563eb", desc: "Direct policy to insured" },
    { id: "inward_foreign", label: "Inward Foreign", icon: "globe", color: "#8b5cf6", desc: "From foreign cedant" },
    { id: "inward_domestic", label: "Inward Domestic", icon: "home", color: "#10b981", desc: "From local cedant" },
  ];
  const [form, setForm] = useState({ insured: null, industry: "", insuredCountry: "", inn: "", legalAddress: "", bankDetails: "", product: null, classOfInsurance: "", contractType: "", channel: "Direct", broker: null, currency: "USD", sumInsured: "", materialDamage: "", businessInterruption: "", grossPremium: "", premiumRate: "", commission: "", inception: "", expiry: "", specialConditions: "", reference: "", ourShare: "" });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const accentColor = REQUEST_TYPES.find(r => r.id === reqType)?.color || "#2563eb";
  const isInward = reqType !== "direct";
  const netPremium = form.grossPremium && form.commission ? (Number(form.grossPremium) * (1 - Number(form.commission) / 100)).toFixed(0) : "";
  const duration = form.inception && form.expiry ? Math.round((new Date(form.expiry) - new Date(form.inception)) / 86400000) : null;
  const handleInsured = (e) => { set("insured", e); set("industry", e.industry || ""); set("insuredCountry", e.country || ""); if (e.inn) set("inn", e.inn); };
  const handleProduct = (p) => { set("product", p); set("classOfInsurance", p.class); };
  const completeness = [
    ["Insured / Cedant", !!form.insured], ["Cover Type", !!form.product], ["Sum Insured", !!form.sumInsured],
    ["Premium", !!form.grossPremium], ["Period", !!(form.inception && form.expiry)],
    ...(form.insuredCountry === "Uzbekistan" ? [["INN", !!form.inn]] : []),
  ];
  const pct = Math.round(completeness.filter(c => c[1]).length / completeness.length * 100);

  return <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", height: "calc(100vh - 82px)" }}>
    <div style={{ padding: "24px 28px", overflowY: "auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.text1, letterSpacing: "-0.3px" }}>New Request</div>
        <div style={{ color: t.text3, fontSize: 12, marginTop: 4 }}>Select type and fill in the details</div>
      </div>
      {/* Type selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        {REQUEST_TYPES.map(rt => <button key={rt.id} onClick={() => setReqType(rt.id)} style={{ flex: 1, padding: "14px 18px", borderRadius: 10, border: `1px solid ${reqType === rt.id ? rt.color : t.border}`, background: reqType === rt.id ? `${rt.color}12` : "transparent", color: reqType === rt.id ? rt.color : t.text3, cursor: "pointer", textAlign: "left", transition: "all 0.15s", fontFamily: "inherit" }}>
          <div style={{ marginBottom: 6 }}><Icon name={rt.icon} size={20} color={reqType === rt.id ? rt.color : t.text4} /></div>
          <div style={{ fontWeight: 600, fontSize: 12 }}>{rt.label}</div>
          <div style={{ fontSize: 10, color: reqType === rt.id ? `${rt.color}99` : t.text5, marginTop: 3 }}>{rt.desc}</div>
        </button>)}
      </div>
      {/* Sections */}
      <SectionCard title={isInward ? "Cedant" : "Insured Party"} subtitle={isInward ? "Ceding company" : "Party being insured"} icon={isInward ? "building" : "briefcase"} color={accentColor}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label={isInward ? "Cedant" : "Insured"} required><EntitySearch value={form.insured} onChange={v => set("insured", v)} onSelect={handleInsured} placeholder="Search..." entities={MOCK_ENTITIES} /></Field>
          <Field label="Industry"><Input value={form.industry} onChange={v => set("industry", v)} placeholder="Auto-filled" /></Field>
          <Field label="Country" required><Select value={form.insuredCountry} onChange={v => set("insuredCountry", v)} options={COUNTRIES} placeholder="Select..." /></Field>
          {form.insuredCountry === "Uzbekistan" && <>
            <Field label="INN (Tax ID)" required hint="🇺🇿"><Input value={form.inn} onChange={v => set("inn", v)} placeholder="9 or 14 digits" /></Field>
            <Field label="Legal Address" col={2} hint="🇺🇿"><Input value={form.legalAddress} onChange={v => set("legalAddress", v)} placeholder="Registered legal address" /></Field>
          </>}
        </div>
      </SectionCard>
      <SectionCard title="Insurance Cover" subtitle="Coverage type and class" icon="file" color={accentColor}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Type of Cover" required><ProductSearch value={form.product} onChange={v => set("product", v)} onSelect={handleProduct} /></Field>
          <Field label="Class" hint="auto"><Input value={form.classOfInsurance} onChange={v => set("classOfInsurance", v)} placeholder="Auto" disabled={!!form.product} /></Field>
          {isInward && <Field label="Contract Type" required><Select value={form.contractType} onChange={v => set("contractType", v)} options={["Facultative", "Treaty - Quota Share", "Treaty - Excess of Loss", "Treaty - Surplus"]} placeholder="Select..." /></Field>}
        </div>
      </SectionCard>
      <SectionCard title="Financial" subtitle="Sums and premium" icon="chart" color={accentColor}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: t.text3, fontWeight: 500, marginBottom: 8 }}>Currency</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {CURRENCIES.map(c => <button key={c} onClick={() => set("currency", c)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${form.currency === c ? accentColor : t.border}`, background: form.currency === c ? `${accentColor}18` : "transparent", color: form.currency === c ? accentColor : t.text4, fontSize: 11, cursor: "pointer", fontWeight: form.currency === c ? 600 : 400, fontFamily: "inherit" }}>{c}</button>)}
          </div>
          {form.currency !== "UZS" && <div style={{ fontSize: 10, color: t.text5, marginTop: 6 }}>1 {form.currency} = {FX_RATES[form.currency]?.toLocaleString()} UZS</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Sum Insured" required><Input value={form.sumInsured} onChange={v => set("sumInsured", v)} placeholder="0.00" type="number" /></Field>
          <Field label="Material Damage"><Input value={form.materialDamage} onChange={v => set("materialDamage", v)} placeholder="0.00" type="number" /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
          <Field label="Rate (‰)"><Input value={form.premiumRate} onChange={v => set("premiumRate", v)} placeholder="0.00" type="number" /></Field>
          <Field label="Gross Premium" required><Input value={form.grossPremium} onChange={v => set("grossPremium", v)} placeholder="0.00" type="number" /></Field>
          <Field label="Commission (%)"><Input value={form.commission} onChange={v => set("commission", v)} placeholder="e.g. 15" type="number" /></Field>
          <Field label="Net Premium" hint="auto"><Input value={netPremium || ""} onChange={() => { }} placeholder="0.00" disabled /></Field>
        </div>
      </SectionCard>
      <SectionCard title="Period" subtitle="Coverage dates" icon="clock" color={accentColor}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Field label="Inception" required><Input type="date" value={form.inception} onChange={v => set("inception", v)} /></Field>
          <Field label="Expiry" required><Input type="date" value={form.expiry} onChange={v => set("expiry", v)} /></Field>
          <Field label="Duration" hint="auto"><div style={{ padding: "8px 12px", borderRadius: 7, background: t.bgApp, border: `1px solid ${t.border}`, color: duration ? accentColor : t.text5, fontSize: 12, fontWeight: 600 }}>{duration ? `${duration} days` : "—"}</div></Field>
        </div>
      </SectionCard>
      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 8, paddingBottom: 20 }}>
        <Btn variant="ghost" onClick={() => navigate(isInward ? "inward" : "policy-admin")}>Cancel</Btn>
        <Btn variant="ghost">Save Draft</Btn>
        <Btn>Submit Request</Btn>
      </div>
    </div>
    {/* Sidebar summary */}
    <div style={{ background: t.bgSidebar, borderLeft: `1px solid ${t.border}`, padding: 20, overflowY: "auto" }}>
      <div style={{ fontWeight: 600, color: t.text1, fontSize: 13, marginBottom: 16 }}>Completeness</div>
      {/* Progress ring */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", width: 80, height: 80 }}>
          <svg viewBox="0 0 36 36" style={{ width: 80, height: 80, transform: "rotate(-90deg)" }}>
            <circle cx="18" cy="18" r="14" fill="none" stroke={t.border} strokeWidth="3" />
            <circle cx="18" cy="18" r="14" fill="none" stroke={accentColor} strokeWidth="3" strokeDasharray={`${pct * 0.88} 88`} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: t.text1 }}>{pct}%</div>
        </div>
      </div>
      {completeness.map(([label, done]) => <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0" }}>
        <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${done ? t.success : t.border}`, background: done ? t.successBg : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {done && <Icon name="check" size={11} color={t.success} />}
        </div>
        <span style={{ fontSize: 12, color: done ? t.text1 : t.text4 }}>{label}</span>
      </div>)}
    </div>
  </div>;
}

// ADMIN CONSOLE
function AdminConsole() {
  const theme = useTheme(); const t = THEMES[theme];
  const setTheme = useSetTheme();
  const [tab, setTab] = useState("settings");
  const TABS = [
    { id: "settings", label: "Settings", icon: "settings" },
    { id: "users", label: "Users & Roles", icon: "users" },
    { id: "architecture", label: "Architecture", icon: "layers" },
    { id: "audit", label: "Audit Log", icon: "clock" },
  ];

  return <div style={{ padding: "24px 28px" }}>
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.text1, letterSpacing: "-0.3px" }}>Admin Console</div>
      <div style={{ color: t.text3, fontSize: 12, marginTop: 4 }}>System configuration & management</div>
    </div>
    {/* Tab bar */}
    <div style={{ display: "flex", gap: 4, marginBottom: 24, background: t.bgPanel, padding: 4, borderRadius: 10, border: `1px solid ${t.border}`, width: "fit-content" }}>
      {TABS.map(tb => <button key={tb.id} onClick={() => setTab(tb.id)} style={{ padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer", background: tab === tb.id ? t.accent : "transparent", color: tab === tb.id ? "#fff" : t.text3, fontSize: 12, fontWeight: tab === tb.id ? 600 : 400, display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s", fontFamily: "inherit" }}>
        <Icon name={tb.icon} size={14} />{tb.label}
      </button>)}
    </div>

    {/* Settings tab */}
    {tab === "settings" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 22, boxShadow: t.shadow }}>
        <div style={{ fontWeight: 600, color: t.text1, fontSize: 13, marginBottom: 16 }}>General Settings</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${t.borderS}` }}>
          <span style={{ color: t.text2, fontSize: 12 }}>Interface Theme</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: t.text4 }}>{theme === "dark" ? "Dark" : "Light"}</span>
            <button onClick={() => setTheme(th => th === "dark" ? "light" : "dark")} style={{ width: 38, height: 20, borderRadius: 10, background: theme === "light" ? t.accent : t.border, border: "none", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: theme === "light" ? 21 : 3, transition: "left 0.2s" }} />
            </button>
          </div>
        </div>
        {[["Company", "Mosaic Insurance Group JSC"], ["Currency", "USD"], ["Timezone", "Asia/Tashkent (UTC+5)"], ["Language", "English / Russian"], ["Policy Prefix", "POL-{YYYY}-"], ["Inward Prefix", "INW-{YYYY}-"]].map(([l, v]) => <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${t.borderS}` }}>
          <span style={{ color: t.text3, fontSize: 12 }}>{l}</span><span style={{ color: t.text1, fontSize: 12, fontWeight: 500 }}>{v}</span>
        </div>)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 22, boxShadow: t.shadow }}>
          <div style={{ fontWeight: 600, color: t.text1, fontSize: 13, marginBottom: 16 }}>FX Rates (CBU)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {FX_MOCK.map(fx => {
              const change = fx.rate - fx.prev; const pctChange = ((change / fx.prev) * 100).toFixed(2);
              return <div key={fx.currency} style={{ background: t.bgApp, border: `1px solid ${t.border}`, borderRadius: 8, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: t.text1, fontSize: 13 }}>{fx.currency}</span>
                  <span style={{ fontSize: 10, color: change >= 0 ? t.success : t.danger, fontWeight: 600 }}>{change >= 0 ? "↑" : "↓"} {Math.abs(pctChange)}%</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.text1, fontVariantNumeric: "tabular-nums" }}>{fx.rate.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: t.text5, marginTop: 2 }}>UZS per 1 {fx.currency}</div>
              </div>;
            })}
          </div>
        </div>
        <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 22, boxShadow: t.shadow }}>
          <div style={{ fontWeight: 600, color: t.text1, fontSize: 13, marginBottom: 16 }}>API Status</div>
          {[
            { name: "CBU.uz Exchange Rates", status: "connected" },
            { name: "Supabase Database", status: "connected" },
            { name: "SMTP Email", status: "warning" },
            { name: "Legal Entity API", status: "connected" },
          ].map(api => <div key={api.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${t.borderS}` }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: api.status === "connected" ? t.success : t.warning }} />
            <span style={{ color: t.text2, fontSize: 12, flex: 1 }}>{api.name}</span>
            <span style={{ fontSize: 10, color: t.text4, textTransform: "capitalize" }}>{api.status}</span>
          </div>)}
        </div>
      </div>
    </div>}

    {/* Users tab */}
    {tab === "users" && <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ color: t.text3, fontSize: 12 }}>{MOCK_USERS.length} users · {MOCK_USERS.filter(u => u.status === "Active").length} active</span>
        <Btn icon="plus">Invite User</Btn>
      </div>
      <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden", boxShadow: t.shadow }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 90px 100px", padding: "10px 20px", borderBottom: `1px solid ${t.border}`, color: t.text4, fontSize: 11, fontWeight: 600 }}>
          <span>NAME</span><span>EMAIL</span><span>ROLE</span><span style={{ textAlign: "center" }}>STATUS</span><span>LAST ACTIVE</span>
        </div>
        {MOCK_USERS.map(u => <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 90px 100px", padding: "12px 20px", borderBottom: `1px solid ${t.borderS}`, alignItems: "center" }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${roleColor[u.role] || "#64748b"}18`, border: `1px solid ${roleColor[u.role] || "#64748b"}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: roleColor[u.role] || "#64748b", fontWeight: 700 }}>{u.name.split(" ").map(n => n[0]).join("")}</div>
            <span style={{ color: t.text1, fontSize: 12, fontWeight: 500 }}>{u.name}</span>
          </div>
          <span style={{ color: t.text3, fontSize: 12 }}>{u.email}</span>
          <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: `${roleColor[u.role] || "#64748b"}15`, color: roleColor[u.role] || "#64748b", fontWeight: 600, width: "fit-content" }}>{u.role}</span>
          <span style={{ textAlign: "center" }}><StatusBadge status={u.status} /></span>
          <span style={{ color: t.text4, fontSize: 11 }}>{u.last}</span>
        </div>)}
      </div>
    </div>}

    {/* Architecture tab */}
    {tab === "architecture" && <div>
      <div style={{ color: t.text3, fontSize: 12, marginBottom: 16 }}>System module map · Click for details</div>
      {LAYERS.map(layer => {
        const lmods = MODULES.filter(m => m.layer === layer.id);
        return <div key={layer.id} style={{ border: `1px solid ${layer.color}22`, borderLeft: `3px solid ${layer.color}`, borderRadius: 10, background: `${layer.color}06`, padding: "18px 22px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: layer.color, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14 }}>{layer.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(lmods.length, 3)}, 1fr)`, gap: 12 }}>
            {lmods.map(mod => <div key={mod.id} style={{ background: t.bgPanel, border: `1px solid ${mod.color}33`, borderRadius: 10, padding: 16, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${mod.color}, transparent)` }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Icon name={mod.icon} size={18} color={mod.color} />
                <div>
                  <div style={{ fontWeight: 600, color: t.text1, fontSize: 12 }}>{mod.label}</div>
                  <div style={{ fontSize: 10, color: mod.color }}>{mod.version}</div>
                </div>
              </div>
              <div style={{ color: t.text3, fontSize: 11, marginBottom: 10, lineHeight: 1.4 }}>{mod.desc}</div>
              <div style={{ display: "flex", gap: 4 }}>
                {["live", "dev", "planned"].map(s => { const cnt = mod.functions.filter(f => f.status === s).length; if (!cnt) return null; const sb = sbadge[s]; return <span key={s} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: sb.bg, color: sb.color, fontWeight: 600 }}>{cnt} {sb.label}</span>; })}
              </div>
            </div>)}
          </div>
        </div>;
      })}
    </div>}

    {/* Audit tab */}
    {tab === "audit" && <div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, overflow: "hidden", boxShadow: t.shadow }}>
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600, color: t.text1, fontSize: 13 }}>Activity Log</span>
        <Btn variant="ghost" size="sm" icon="download">Export</Btn>
      </div>
      {MOCK_AUDIT.map((a, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 120px 1fr 1fr", padding: "12px 20px", borderBottom: `1px solid ${t.borderS}` }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <span style={{ color: t.text4, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>{a.time}</span>
        <span style={{ color: t.text2, fontSize: 12 }}>{a.user}</span>
        <span style={{ color: t.text1, fontSize: 12, fontWeight: 500 }}>{a.action}</span>
        <span style={{ color: t.text3, fontSize: 11 }}>{a.detail}</span>
      </div>)}
    </div>}
  </div>;
}

// STUB PAGE
function StubPage({ label, icon, color = "#2563eb", items = [] }) {
  const theme = useTheme(); const t = THEMES[theme];
  return <div style={{ padding: "24px 28px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}12`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={24} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: t.text1, letterSpacing: "-0.3px" }}>{label}</div>
        <div style={{ fontSize: 12, color: t.text4, marginTop: 2 }}>Module coming soon · Blueprint phase</div>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
      {items.map((item, i) => <div key={i} style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 22, opacity: item.live ? 1 : 0.5, boxShadow: t.shadow }}>
        <div style={{ marginBottom: 10 }}><Icon name={item.icon || "file"} size={20} color={item.live ? color : t.text4} /></div>
        <div style={{ fontWeight: 600, color: t.text1, fontSize: 13, marginBottom: 4 }}>{item.name}</div>
        <div style={{ fontSize: 11, color: t.text4, marginBottom: 10, lineHeight: 1.4 }}>{item.desc}</div>
        <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: item.live ? "#10b98118" : "#3b82f618", color: item.live ? "#10b981" : "#3b82f6", fontWeight: 600 }}>{item.live ? "Live" : "In Dev"}</span>
      </div>)}
    </div>
  </div>;
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function MosaicERP() {
  const [theme, setTheme] = useState("dark");
  const t = THEMES[theme];
  const [page, setPage] = useState("dashboard");
  const [newReqType, setNewReqType] = useState("direct");
  const [sideOpen, setSideOpen] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(v => !v); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const navigate = (target, subType) => {
    if (target === "new-request") { setNewReqType(subType || "direct"); setPage("new-request"); return; }
    setPage(target);
  };

  const renderPage = () => {
    if (page === "dashboard") return <Dashboard navigate={navigate} />;
    if (page === "policy-admin") return <PolicyAdmin navigate={navigate} />;
    if (page === "inward") return <InwardReinsurance navigate={navigate} />;
    if (page === "admin") return <AdminConsole />;
    if (page === "new-request") return <NewRequestForm navigate={navigate} initialType={newReqType} />;
    if (page === "claims") return <StubPage label="Claims" icon="zap" color="#ef4444" items={[
      { icon: "file", name: "FNOL Registration", desc: "First notice of loss intake", live: true },
      { icon: "building", name: "Reserve Setting", desc: "Initial & revised reserves", live: true },
      { icon: "search", name: "Claims Investigation", desc: "Assessment & coverage review", live: false },
      { icon: "wallet", name: "Payment Processing", desc: "Settlement & disbursement", live: false },
      { icon: "refresh", name: "Subrogation", desc: "Recovery from third parties", live: false },
      { icon: "chart", name: "Claims Analytics", desc: "Loss ratios & trends", live: false },
    ]} />;
    if (page === "financial-lines") return <StubPage label="Financial Lines" icon="shield" color="#10b981" items={[
      { icon: "chart", name: "Trade Credit UW", desc: "Buyer risk & credit limits", live: true },
      { icon: "shield", name: "Surety Bonds", desc: "Performance & advance payment", live: true },
      { icon: "briefcase", name: "D&O Liability", desc: "Directors & officers cover", live: false },
      { icon: "building", name: "BBB Module", desc: "Bankers blanket bond", live: false },
      { icon: "eye", name: "Credit Monitoring", desc: "Buyer default alerts", live: false },
      { icon: "x", name: "NPI", desc: "Non-payment insurance", live: false },
    ]} />;
    if (page === "billing") return <StubPage label="Billing" icon="wallet" color="#f59e0b" items={[
      { icon: "file", name: "Premium Invoicing", desc: "Policy & endorsement invoices", live: true },
      { icon: "clock", name: "Installment Plans", desc: "Split & deferred premiums", live: true },
      { icon: "wallet", name: "Agent Commissions", desc: "Commission calculation", live: false },
      { icon: "file", name: "Broker Statements", desc: "Periodic account statements", live: false },
      { icon: "bell", name: "Collections Workflow", desc: "Overdue premium follow-up", live: false },
      { icon: "refresh", name: "Refund Processing", desc: "Cancellation refunds", live: false },
    ]} />;
    if (page === "finance") return <StubPage label="Finance" icon="building" color="#06b6d4" items={[
      { icon: "refresh", name: "FX Management", desc: "CBU rates & revaluation", live: true },
      { icon: "file", name: "General Ledger", desc: "Double-entry accounting", live: false },
      { icon: "building", name: "Insurance Reserves", desc: "IBNR & case reserves", live: false },
      { icon: "layers", name: "IFRS 17 Engine", desc: "CSM & liability calculations", live: false },
      { icon: "chart", name: "Regulatory Reporting", desc: "CBU & tax submissions", live: false },
      { icon: "chart", name: "Budgeting & Forecast", desc: "Plan vs actual tracking", live: false },
    ]} />;
    return <Dashboard navigate={navigate} />;
  };

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "policy-admin", label: "Policy Admin", icon: "briefcase" },
    { id: "inward", label: "Inward RI", icon: "refresh" },
    { id: "claims", label: "Claims", icon: "zap" },
    { id: "financial-lines", label: "Financial Lines", icon: "shield" },
    { id: "billing", label: "Billing", icon: "wallet" },
    { id: "finance", label: "Finance", icon: "building" },
  ];

  const activeTab = page === "new-request" && (newReqType === "inward_foreign" || newReqType === "inward_domestic") ? "inward" :
    page === "new-request" ? "policy-admin" : page;

  const SIDE_ITEMS = {
    dashboard: [{ label: "Overview", icon: "chart", action: () => navigate("dashboard") }, { label: "Activity Feed", icon: "clock" }],
    "policy-admin": [{ label: "Portfolio", icon: "file", action: () => navigate("policy-admin") }, { label: "New Policy", icon: "plus", action: () => navigate("new-request", "direct"), accent: true }, { label: "Analytics", icon: "chart" }],
    inward: [{ label: "All Contracts", icon: "file", action: () => navigate("inward") }, { label: "New Foreign", icon: "globe", action: () => navigate("new-request", "inward_foreign"), accent: true }, { label: "New Domestic", icon: "home", action: () => navigate("new-request", "inward_domestic"), accent: true }],
    claims: [{ label: "All Claims", icon: "file" }, { label: "New FNOL", icon: "plus", accent: true }, { label: "Reserves", icon: "building" }],
    "financial-lines": [{ label: "Trade Credit", icon: "chart" }, { label: "Surety Bonds", icon: "shield" }, { label: "New Bond", icon: "plus", accent: true }],
    billing: [{ label: "Invoices", icon: "file" }, { label: "Installments", icon: "clock" }, { label: "Commissions", icon: "wallet" }],
    finance: [{ label: "General Ledger", icon: "file" }, { label: "FX Rates", icon: "refresh" }, { label: "Reserves", icon: "building" }],
    admin: [{ label: "Settings", icon: "settings", action: () => navigate("admin") }, { label: "Users", icon: "users", action: () => navigate("admin") }, { label: "Architecture", icon: "layers", action: () => navigate("admin") }, { label: "Audit Log", icon: "clock", action: () => navigate("admin") }],
  };
  const sideItems = SIDE_ITEMS[activeTab] || [];

  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        *::-webkit-scrollbar { width: 5px; height: 5px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: ${theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}; border-radius: 10px; }
        *::-webkit-scrollbar-thumb:hover { background: ${theme === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)"}; }
        * { scrollbar-width: thin; scrollbar-color: ${theme === "dark" ? "rgba(255,255,255,0.1) transparent" : "rgba(0,0,0,0.12) transparent"}; }
        input::placeholder, select { font-family: 'DM Sans', sans-serif; }
      `}</style>
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: t.bgApp, color: t.text1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── Top bar ── */}
        <div style={{ background: t.topbar, borderBottom: `1px solid ${t.border}`, padding: "0 16px 0 8px", height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setSideOpen(v => !v)} title="Toggle sidebar" style={{ width: 32, height: 32, borderRadius: 7, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0, opacity: 0.7 }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <div style={{ width: 16, height: 1.5, background: t.text2, borderRadius: 1 }} /><div style={{ width: 16, height: 1.5, background: t.text2, borderRadius: 1 }} /><div style={{ width: 16, height: 1.5, background: t.text2, borderRadius: 1 }} />
            </button>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg, #2563eb, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10, color: "#fff" }}>M</div>
            <span style={{ fontWeight: 700, fontSize: 14, color: t.text1 }}>Mosaic ERP</span>
            <span style={{ padding: "2px 8px", borderRadius: 4, background: t.border, color: t.text3, fontSize: 10, fontWeight: 600 }}>BLUEPRINT</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Search trigger */}
            <button onClick={() => setCmdOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 7, background: t.bgInput, border: `1px solid ${t.border}`, cursor: "pointer", color: t.text4, fontSize: 12 }}>
              <Icon name="search" size={13} color={t.text4} />
              <span>Search...</span>
              <span style={{ fontSize: 10, color: t.text5, background: t.bgApp, padding: "1px 5px", borderRadius: 3, border: `1px solid ${t.border}`, marginLeft: 8 }}>⌘K</span>
            </button>
            {/* Notifications */}
            <button onClick={() => setNotifOpen(v => !v)} style={{ width: 32, height: 32, borderRadius: 7, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <Icon name="bell" size={16} color={t.text3} />
              <div style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: t.danger, border: `2px solid ${t.topbar}` }} />
            </button>
            <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
            {/* Theme toggle */}
            <button onClick={() => setTheme(th => th === "dark" ? "light" : "dark")} style={{ width: 32, height: 32, borderRadius: 7, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={15} color={t.text3} />
            </button>
            {/* User */}
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #2563eb, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, cursor: "pointer" }}>M</div>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ background: t.bgSidebar, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "flex-end", padding: "0 12px", flexShrink: 0, height: 38, gap: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 1, flex: 1 }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return <div key={tab.id} onClick={() => navigate(tab.id)} style={{
                padding: "0 16px", height: 34, display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                borderRadius: "6px 6px 0 0",
                background: active ? t.bgApp : "transparent",
                borderTop: active ? `2px solid ${t.accent}` : `2px solid transparent`,
                borderLeft: active ? `1px solid ${t.border}` : `1px solid transparent`,
                borderRight: active ? `1px solid ${t.border}` : `1px solid transparent`,
                borderBottom: active ? `1px solid ${t.bgApp}` : "none",
                marginBottom: active ? -1 : 0,
                transition: "all 0.12s", position: "relative", zIndex: active ? 2 : 1,
              }} onMouseEnter={e => { if (!active) e.currentTarget.style.background = t.bgHover; }} onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? t.bgApp : "transparent"; }}>
                <Icon name={tab.icon} size={13} color={active ? t.accent : t.text4} />
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? t.text1 : t.text3, whiteSpace: "nowrap" }}>{tab.label}</span>
              </div>;
            })}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 1 }}>
            <div onClick={() => navigate("admin")} style={{
              padding: "0 14px", height: 34, display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
              borderRadius: "6px 6px 0 0",
              background: activeTab === "admin" ? t.bgApp : "transparent",
              borderTop: activeTab === "admin" ? `2px solid ${t.text3}` : `2px solid transparent`,
              borderLeft: activeTab === "admin" ? `1px solid ${t.border}` : `1px solid transparent`,
              borderRight: activeTab === "admin" ? `1px solid ${t.border}` : `1px solid transparent`,
              borderBottom: activeTab === "admin" ? `1px solid ${t.bgApp}` : "none",
              marginBottom: activeTab === "admin" ? -1 : 0,
              position: "relative", zIndex: activeTab === "admin" ? 2 : 1,
            }} onMouseEnter={e => { if (activeTab !== "admin") e.currentTarget.style.background = t.bgHover; }} onMouseLeave={e => { if (activeTab !== "admin") e.currentTarget.style.background = "transparent"; }}>
              <Icon name="settings" size={13} color={activeTab === "admin" ? t.text1 : t.text4} />
              <span style={{ fontSize: 12, fontWeight: activeTab === "admin" ? 600 : 400, color: activeTab === "admin" ? t.text1 : t.text3 }}>Admin</span>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Sidebar */}
          <div style={{
            width: sideOpen ? 190 : 0, minWidth: sideOpen ? 190 : 0,
            background: t.bgSidebar, borderRight: `1px solid ${t.border}`,
            flexShrink: 0, overflow: "hidden",
            transition: "width 0.2s ease, min-width 0.2s ease",
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ width: 190, padding: "14px 0", display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: t.sideGroup, textTransform: "uppercase", letterSpacing: 1.2, padding: "6px 16px 8px", whiteSpace: "nowrap" }}>
                {activeTab === "policy-admin" ? "Direct Insurance" : activeTab === "inward" ? "Reinsurance" : activeTab === "admin" ? "Administration" : activeTab === "claims" ? "Claims" : activeTab === "financial-lines" ? "Financial Lines" : activeTab === "billing" ? "Billing" : activeTab === "finance" ? "Finance" : "Navigation"}
              </div>
              {sideItems.map((item, i) => <div key={i} onClick={item.action} style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 16px", cursor: "pointer", whiteSpace: "nowrap",
                borderLeft: item.accent ? `2px solid ${t.accent}` : "2px solid transparent",
                background: "transparent", transition: "background 0.12s",
              }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <Icon name={item.icon} size={14} color={item.accent ? t.accent : t.text4} />
                <span style={{ fontSize: 12, color: item.accent ? t.accent : t.text3, fontWeight: item.accent ? 600 : 400 }}>{item.label}</span>
              </div>)}
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {renderPage()}
          </div>
        </div>

      </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} navigate={navigate} />
    </ThemeCtx.Provider>
  );
}
