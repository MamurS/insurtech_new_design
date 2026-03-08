# MOSAIC ERP v2 — Claude Code Implementation Prompt

## MISSION

You are reskinning the **Mosaic ERP** — an enterprise insurance management system for **Mosaic Insurance Group JSC** (Tashkent, Uzbekistan). The complete v1 codebase is already in this repo. You will modify files in-place, adding new files where needed. The project deploys on Cloudflare Pages, connected to Supabase (production + staging).

**This is a visual reskin, not a functional rewrite.** All existing business logic, forms, fields, queries, and features must be preserved. You are working inside the existing repo — modify, restructure, and restyle, but never delete business logic. The UI/UX is being completely redesigned.

---

## WHAT YOU HAVE

### 1. Existing Codebase (v1) — ALREADY IN THIS REPO
All v1 source code is already in this repository. You will modify it in-place. Key facts:
- **Tech stack:** React 18 + TypeScript + Vite + Supabase + Tailwind (utility classes) + Lucide React icons + Recharts + React Router (HashRouter)
- **Total:** ~34,000 lines across 60+ files
- **Database:** Supabase (PostgreSQL) with production + staging environments
- **Auth:** Supabase Auth with RBAC (roles, permissions, authority limits)
- **Deploy:** Cloudflare Pages with Vite build

### 2. UI/UX Design Mockup (v15) — REFERENCE FOR ALL VISUAL DESIGN
The file `mosaic-erp-v15.jsx` is an interactive React mockup showing the target design. Key design elements:
- **Font:** DM Sans (Google Fonts)
- **Theme system:** Dark/Light with comprehensive token set (bgApp, bgPanel, bgSidebar, bgInput, border variants, text1-5, accent, success, warning, danger, shadow, glow)
- **Layout:** Top bar (44px) → Excel-style tab bar (38px) → Collapsible sidebar (190px) + Main content
- **Components:** Pill-style badges (border-radius: 20px), KPI cards with icons, gradient progress bars, SVG icon system
- **Features:** Command Palette (⌘K), Notification Panel, theme toggle in topbar, inline table search/sort
- **Colors:** Blue accent (#2563eb), clean semantic colors from Tailwind palette

---

## RULES — READ CAREFULLY

### DO preserve from v1:
1. **Every form field** — Direct Insurance form, Inward Reinsurance form (foreign + domestic), Policy form, Claims, Entities, MGA, Slips — ALL fields must exist
2. **All Supabase queries** — `services/db.ts`, `services/auth.ts`, `services/claimsService.ts`, `services/agendaService.ts`, `services/permissionService.ts`, `services/userService.ts`, `services/cbuService.ts`, `services/excel.ts`
3. **Search functionality** — the existing search with `searchParser.ts`, inline filters, date filters
4. **All routes** — every page in v1 must exist in v2 with the same URL paths
5. **Auth flow** — Login, session timeout, protected routes, admin routes
6. **RBAC** — Roles, permissions, authority limits, PermissionGate
7. **Environment switcher** — Production/Staging toggle
8. **Types** — `types.ts` as-is (all interfaces, enums)
9. **All pages:** Dashboard, DirectInsuranceList, PolicyForm, InwardReinsuranceDashboard, InwardReinsuranceList, InwardReinsuranceForm, MGADashboard, Analytics, FinancialStatements, RiskAccumulation, IBNREstimation, RegulatoryReporting, ClaimsList, ClaimDetail, SlipsDashboard, SlipForm, EntityManager, EntityForm, Agenda, ClauseManager, PolicyWording, Settings, AdminConsole, Login

### DO change (visual reskin):
1. **Layout.tsx** → Redesign to match v15: topbar + tab bar + collapsible sidebar
2. **All Tailwind classes** → Replace with new design system matching v15 theme tokens
3. **Component styling** → Pill badges, rounded cards with shadows, gradient bars, better spacing
4. **Add Command Palette** (⌘K) — quick navigation and search
5. **Add Notification Panel** — activity feed dropdown
6. **Add Theme Toggle** — dark/light mode switcher in topbar
7. **Add Theme Context** — ThemeProvider wrapping the app, all components use theme tokens
8. **Icons** — keep lucide-react but apply new sizing/coloring from v15 design
9. **Login page** — redesign to match new theme
10. **AdminConsole** — apply new tab bar style, card design

### DO NOT:
- Remove any form fields
- Change Supabase table names or column names
- Change URL routes
- Remove any existing feature
- Change business logic or calculations
- Modify types.ts interfaces (you can extend, not modify)

---

## PROJECT STRUCTURE (target after migration)

You are restructuring the existing repo into this layout. Move files as needed — the `src/` directory is new (v1 has files at root level). You can either:
- **Option A:** Add a `src/` directory and move files gradually (cleaner)
- **Option B:** Keep the current flat structure and add new files alongside (faster, less risk)

Choose Option B (keep flat structure) unless you have a good reason to restructure. The priority is visual reskin, not folder reorganization.

### New files to CREATE:

```
mosaic-erp-v2/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── vercel.json          # (keep for compatibility)
├── favicon.svg
├── public/
│   ├── mig-logo-black.svg
│   └── mig-logo-white.svg
├── src/
│   ├── index.tsx
│   ├── App.tsx
│   ├── types.ts                    # COPY from v1 as-is
│   ├── theme/
│   │   ├── ThemeContext.tsx         # NEW — dark/light theme provider
│   │   ├── tokens.ts               # NEW — theme token definitions from v15
│   │   └── useTheme.ts             # NEW — hook for accessing theme
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx         # NEW — top bar + tab bar + sidebar + content
│   │   │   ├── TopBar.tsx           # NEW — logo, search trigger, notifications, theme, user
│   │   │   ├── TabBar.tsx           # NEW — Excel-style tabs
│   │   │   ├── Sidebar.tsx          # NEW — collapsible context sidebar
│   │   │   └── CommandPalette.tsx   # NEW — ⌘K quick nav
│   │   ├── ui/                      # NEW — reusable design system
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Badge.tsx            # StatusBadge, StageBadge
│   │   │   ├── Card.tsx
│   │   │   ├── KpiCard.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx            # Reusable table with sort/search
│   │   │   ├── SectionCard.tsx
│   │   │   └── Field.tsx
│   │   ├── notifications/
│   │   │   └── NotificationPanel.tsx
│   │   ├── AssignTaskModal.tsx      # MIGRATE from v1
│   │   ├── ConfirmDialog.tsx        # MIGRATE from v1 (restyle)
│   │   ├── DetailModal.tsx          # MIGRATE from v1 (restyle)
│   │   ├── MasterDetailModal.tsx    # MIGRATE from v1 (restyle)
│   │   ├── EntityDetailModal.tsx    # MIGRATE
│   │   ├── EntitySearchInput.tsx    # MIGRATE
│   │   ├── EntityFormContent.tsx    # MIGRATE
│   │   ├── FormModal.tsx            # MIGRATE (restyle)
│   │   ├── DirectInsuranceFormContent.tsx  # MIGRATE — ALL FIELDS
│   │   ├── InwardReinsuranceFormContent.tsx # MIGRATE — ALL FIELDS
│   │   ├── PolicyFormContent.tsx    # MIGRATE — ALL FIELDS
│   │   ├── MGAFormContent.tsx       # MIGRATE — ALL FIELDS
│   │   ├── SlipFormContent.tsx      # MIGRATE — ALL FIELDS
│   │   ├── NewRequestForm.tsx       # MIGRATE — ALL FIELDS
│   │   ├── RegisterClaimModal.tsx   # MIGRATE
│   │   ├── RoleEditModal.tsx        # MIGRATE
│   │   ├── DepartmentEditModal.tsx  # MIGRATE
│   │   ├── SICCodePicker.tsx        # MIGRATE
│   │   ├── SegmentedControl.tsx     # MIGRATE (restyle)
│   │   ├── SessionTimeoutWarning.tsx # MIGRATE
│   │   ├── TaskDetailModal.tsx      # MIGRATE
│   │   ├── EnvironmentBadge.tsx     # MIGRATE
│   │   ├── EnvironmentSwitcher.tsx  # MIGRATE
│   │   ├── MosaicLogo.tsx           # MIGRATE
│   │   ├── PermissionGate.tsx       # COPY as-is
│   │   ├── DatePickerInput.tsx      # COPY as-is
│   │   ├── CompactDateFilter.tsx    # COPY as-is
│   │   └── CustomDateInput.tsx      # COPY as-is
│   ├── pages/                       # ALL pages MIGRATED with new styling
│   │   ├── Dashboard.tsx
│   │   ├── DirectInsuranceList.tsx
│   │   ├── PolicyForm.tsx
│   │   ├── InwardReinsuranceDashboard.tsx
│   │   ├── InwardReinsuranceList.tsx
│   │   ├── InwardReinsuranceForm.tsx
│   │   ├── MGADashboard.tsx
│   │   ├── Analytics.tsx
│   │   ├── FinancialStatements.tsx
│   │   ├── RiskAccumulation.tsx
│   │   ├── IBNREstimation.tsx
│   │   ├── RegulatoryReporting.tsx
│   │   ├── ClaimsList.tsx
│   │   ├── ClaimDetail.tsx
│   │   ├── SlipsDashboard.tsx
│   │   ├── SlipForm.tsx
│   │   ├── EntityManager.tsx
│   │   ├── EntityForm.tsx
│   │   ├── Agenda.tsx
│   │   ├── ClauseManager.tsx
│   │   ├── PolicyWording.tsx
│   │   ├── Settings.tsx
│   │   ├── AdminConsole.tsx
│   │   └── Login.tsx
│   ├── context/
│   │   ├── AuthContext.tsx           # COPY from v1
│   │   ├── PermissionContext.tsx     # COPY from v1
│   │   ├── ToastContext.tsx          # MIGRATE (restyle toasts)
│   │   └── PageHeaderContext.tsx     # REMOVE — replaced by new AppShell
│   ├── services/                    # ALL services COPY as-is
│   │   ├── supabase.ts
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   ├── claimsService.ts
│   │   ├── agendaService.ts
│   │   ├── permissionService.ts
│   │   ├── userService.ts
│   │   ├── cbuService.ts
│   │   ├── excel.ts
│   │   ├── excelExport.ts
│   │   └── geminiService.ts
│   ├── hooks/                       # ALL hooks COPY as-is
│   │   ├── useAgenda.ts
│   │   ├── useAnalytics.ts
│   │   ├── useClaims.ts
│   │   ├── useExchangeRate.ts
│   │   ├── usePermissions.ts
│   │   ├── useSessionTimeout.ts
│   │   └── useUsers.ts
│   ├── utils/                       # ALL utils COPY as-is
│   │   ├── searchParser.ts
│   │   ├── dateUtils.ts
│   │   ├── validation.ts
│   │   ├── bordereauParser.ts
│   │   └── logger.ts
│   └── data/
│       └── sicCodes.ts              # COPY as-is
├── functions/
│   └── api/
│       └── cbu-rates.ts             # COPY as-is
└── sql/                             # Move SQL files here for reference
    ├── supabase_schema.sql
    └── ... (all migration files)
```

---

## THEME SYSTEM — Implementation Guide

### tokens.ts
```typescript
export const THEMES = {
  dark: {
    bgApp: "#06090f",
    bgPanel: "#0c1118",
    bgSidebar: "#080c12",
    bgInput: "#0a0e16",
    bgInputDis: "#0a0d12",
    bgRowAlt: "#0e1520",
    bgCard: "#0d1219",
    bgHover: "#121c2a",
    bgActive: "#162640",
    border: "#172030",
    borderL: "#1c2840",
    borderS: "#0d1520",
    text1: "#d0dced",
    text2: "#8ba3c7",
    text3: "#5a7a9c",
    text4: "#3a5878",
    text5: "#253a52",
    accent: "#2563eb",
    accentHover: "#3b82f6",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    shadow: "0 1px 3px rgba(0,0,0,0.4)",
    shadowLg: "0 8px 32px rgba(0,0,0,0.5)",
  },
  light: {
    bgApp: "#f1f5f9",
    bgPanel: "#ffffff",
    bgSidebar: "#f8fafc",
    bgInput: "#ffffff",
    bgInputDis: "#f1f5f9",
    bgRowAlt: "#f8fafc",
    bgCard: "#f8fafc",
    bgHover: "#e2e8f0",
    bgActive: "#dbeafe",
    border: "#e2e8f0",
    borderL: "#cbd5e1",
    borderS: "#f1f5f9",
    text1: "#0f172a",
    text2: "#334155",
    text3: "#64748b",
    text4: "#94a3b8",
    text5: "#cbd5e1",
    accent: "#2563eb",
    accentHover: "#1d4ed8",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
    shadow: "0 1px 3px rgba(0,0,0,0.08)",
    shadowLg: "0 8px 32px rgba(0,0,0,0.12)",
  },
} as const;
```

### How to apply theme in components:
Every component that was using Tailwind `bg-gray-50`, `text-slate-300`, etc. should instead use the theme tokens via CSS custom properties or the useTheme hook. The v15 mockup shows the pattern: `const theme = useTheme(); const t = THEMES[theme];` then use `t.bgPanel`, `t.text1`, etc.

**Approach:** Use CSS custom properties set at the root level, so Tailwind classes can be replaced with `style={{ background: 'var(--bg-panel)', color: 'var(--text-1)' }}` or a thin CSS-in-JS layer. Alternatively, use a utility like `cn()` that maps theme tokens to CSS classes.

---

## LAYOUT ARCHITECTURE — from v15 mockup

The new layout replaces v1's `Layout.tsx`:

```
┌─────────────────────────────────────────────────┐
│ TopBar: ☰ [M] Mosaic ERP [BLUEPRINT] ... 🔍⌘K 🔔 🌙 [M] │  44px
├─────────────────────────────────────────────────┤
│ TabBar: Dashboard │ Policy Admin │ Inward RI │ Claims │ ... │ ⚙ Admin │  38px
├────────┬────────────────────────────────────────┤
│Sidebar │                                        │
│190px   │  Main Content (scrollable)             │
│context │                                        │
│  items │                                        │
│        │                                        │
└────────┴────────────────────────────────────────┘
```

- TopBar: hamburger toggle, logo, app name, "BLUEPRINT" badge, search trigger (opens Command Palette), notification bell, theme toggle (sun/moon), user avatar
- TabBar: Excel-style tabs — active tab has colored top border and "lifts" into content area. Tabs map to main navigation groups.
- Sidebar: collapsible (190px ↔ 0px with smooth transition), shows context-sensitive actions per active tab
- Command Palette: overlay with search, triggered by ⌘K or clicking search

### Tab → Route mapping:
| Tab | Routes |
|-----|--------|
| Dashboard | `/` |
| Policy Admin | `/direct-insurance`, `/policy/*`, `/new`, `/edit/*` |
| Inward RI | `/inward-reinsurance/*` |
| Claims | `/claims/*` |
| Financial Lines | (future) |
| Billing | (future) |
| Finance | `/financial-statements`, `/risk-accumulation`, `/ibnr/*`, `/regulatory` |
| Admin | `/admin` |

---

## PACKAGE.JSON

```json
{
  "name": "mosaic-erp-v2",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.3",
    "lucide-react": "^0.292.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.20.0",
    "recharts": "^3.7.0",
    "react-datepicker": "^7.6.0",
    "exceljs": "^4.4.0",
    "xlsx": "^0.18.5",
    "dompurify": "^3.3.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/dompurify": "^3.0.5",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.1"
  }
}
```

Note: Removed `@google/genai` and `@tanstack/react-query` from v1 — add back only if needed.

---

## IMPLEMENTATION ORDER

Execute in this order. You are modifying existing files — always verify `npm run build` succeeds after each phase.

### Phase 1: Theme system + Layout (modify existing)
1. Create `theme/ThemeContext.tsx`, `theme/tokens.ts`, `theme/useTheme.ts`
2. Create `components/ui/` — Button, Input, Select, Badge, Card, KpiCard, SectionCard, Field (new reusable components matching v15 design)
3. Create `components/layout/CommandPalette.tsx`, `components/notifications/NotificationPanel.tsx`
4. **Rewrite `components/Layout.tsx`** — replace sidebar-based layout with new TopBar + TabBar + Sidebar from v15
5. Wrap App in ThemeProvider
6. Import DM Sans font in `index.html`
7. Verify: `npm run build` succeeds, app loads with new layout shell

### Phase 2: Core pages (restyle existing)
8. Restyle `pages/Login.tsx` — new theme design
9. Restyle `pages/Dashboard.tsx` — use new KpiCard, Card components, theme tokens
10. Restyle `pages/DirectInsuranceList.tsx` — preserve all search, filters, kebab menu logic
11. Restyle `pages/PolicyForm.tsx` + `components/PolicyFormContent.tsx` — ALL fields preserved, new visual style
12. Restyle `components/NewRequestForm.tsx` + `components/DirectInsuranceFormContent.tsx` — ALL fields preserved

### Phase 3: Inward Reinsurance (restyle existing)
13. Restyle `pages/InwardReinsuranceDashboard.tsx`
14. Restyle `pages/InwardReinsuranceList.tsx`
15. Restyle `pages/InwardReinsuranceForm.tsx` + `components/InwardReinsuranceFormContent.tsx` — ALL fields

### Phase 4: Supporting pages (restyle existing)
16. Restyle `pages/ClaimsList.tsx`, `pages/ClaimDetail.tsx`, `components/RegisterClaimModal.tsx`
17. Restyle `pages/SlipsDashboard.tsx`, `pages/SlipForm.tsx`, `components/SlipFormContent.tsx`
18. Restyle `pages/EntityManager.tsx`, `pages/EntityForm.tsx`, `components/EntityFormContent.tsx`
19. Restyle `pages/Agenda.tsx`, `components/AssignTaskModal.tsx`, `components/TaskDetailModal.tsx`
20. Restyle `pages/MGADashboard.tsx`, `components/MGAFormContent.tsx`
21. Restyle `pages/Analytics.tsx`

### Phase 5: Finance & Admin (restyle existing)
22. Restyle `pages/FinancialStatements.tsx`, `pages/RiskAccumulation.tsx`, `pages/IBNREstimation.tsx`, `pages/RegulatoryReporting.tsx`
23. Restyle `pages/AdminConsole.tsx` — with new tab bar style from v15
24. Restyle `pages/Settings.tsx`
25. Restyle `pages/ClauseManager.tsx`, `pages/PolicyWording.tsx`

### Phase 6: Modals & shared components (restyle existing)
26. Restyle `components/DetailModal.tsx`, `components/MasterDetailModal.tsx`, `components/EntityDetailModal.tsx`
27. Restyle `components/ConfirmDialog.tsx`, `components/FormModal.tsx`
28. Restyle `components/EnvironmentSwitcher.tsx`, `components/EnvironmentBadge.tsx`
29. Restyle `context/ToastContext.tsx` toasts to match new design
30. Restyle `components/SegmentedControl.tsx`, `components/SICCodePicker.tsx`

### Phase 7: Polish & deploy
31. Test all routes, forms, modals
32. Verify Supabase connection works (production + staging)
33. Verify build: `npm run build` succeeds with zero errors
34. Commit and push — Cloudflare Pages auto-deploys

---

## DESIGN PRINCIPLES from v15 mockup

1. **No alternating row backgrounds** — rows separated by borderBottom only; hover shows `bgHover`, selected shows `bgActive`
2. **Pill badges** — `border-radius: 20px` for all status/stage badges
3. **Cards have shadows** — use `shadow` token for depth
4. **Gradient progress bars** — `linear-gradient(90deg, color, color88)`
5. **Monospace for IDs** — policy numbers, contract numbers use `fontFamily: "'JetBrains Mono', monospace"` or similar
6. **Tabular numbers** — `fontVariantNumeric: "tabular-nums"` for all financial figures
7. **No emoji icons** — use Lucide React icons everywhere
8. **10px/11px for labels** — field labels are small, uppercase with letter-spacing
9. **DM Sans font** — import from Google Fonts in index.html
10. **Rounded corners** — `borderRadius: 10px` for cards, `7px` for inputs, `20px` for badges
11. **Color system** — accent blue (#2563eb), success green (#10b981), warning amber (#f59e0b), danger red (#ef4444)

---

## CRITICAL: Environment Variables

The `vite.config.ts` must expose these env vars (same as v1):
```typescript
define: {
  'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || ''),
  'process.env.SUPABASE_KEY': JSON.stringify(env.SUPABASE_KEY || ''),
  'process.env.SUPABASE_STAGING_URL': JSON.stringify(env.SUPABASE_STAGING_URL || ''),
  'process.env.SUPABASE_STAGING_KEY': JSON.stringify(env.SUPABASE_STAGING_KEY || ''),
}
```

---

## WHAT SUCCESS LOOKS LIKE

When done, `npm run build` produces a dist/ folder that:
- Deploys to Cloudflare Pages
- Connects to same Supabase database as v1
- Has identical functionality to v1
- Looks like the v15 mockup (dark/light theme, tab bar navigation, command palette)
- All form fields preserved
- All search/filter functionality preserved
- All RBAC/auth preserved

---

## REFERENCE FILES

- **All v1 source code** is already in this repo — this is your source of truth for all business logic
- **`mosaic-erp-v15.jsx`** in repo root — this is your source of truth for all visual design
- **This file (`CLAUDE_CODE_PROMPT.md`)** — your implementation guide
