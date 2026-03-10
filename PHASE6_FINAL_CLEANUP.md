# MOSAIC ERP v2 — Phase 6: Final Cleanup & Full Standardization

## PROBLEM

Many pages and components still use old Tailwind utility classes (bg-slate-*, text-gray-*, etc.) instead of theme tokens. Some pages still open forms as modal popups instead of navigating to full pages. This must all be fixed for complete design consistency.

---

## TASK 1: Remove ALL old Tailwind classes from these files

Every `bg-slate-*`, `bg-gray-*`, `text-slate-*`, `text-gray-*`, `bg-white`, `bg-blue-*`, `border-gray-*`, `rounded-*`, `shadow-*`, `hover:bg-*` Tailwind class must be replaced with inline styles using theme tokens (`t.bgPanel`, `t.text1`, `t.border`, etc.).

### Pages to fix (sorted by severity):
1. `pages/MGADashboard.tsx` — 118 old classes
2. `pages/AdminConsole.tsx` — 41 old classes  
3. `pages/ClaimDetail.tsx` — 36 old classes
4. `pages/SlipForm.tsx` — 33 old classes
5. `pages/PolicyWording.tsx` — 31 old classes

### Components to fix (sorted by severity):
1. `components/DetailModal.tsx` — 94 old classes
2. `components/MasterDetailModal.tsx` — 83 old classes
3. `components/EntityDetailModal.tsx` — 41 old classes
4. `components/SlipFormContent.tsx` — 29 old classes
5. `components/RegisterClaimModal.tsx` — 29 old classes
6. `components/RoleEditModal.tsx` — 27 old classes
7. `components/SICCodePicker.tsx` — 18 old classes
8. `components/EnvironmentSwitcher.tsx` — 17 old classes
9. `components/DepartmentEditModal.tsx` — 11 old classes
10. `components/ConfirmDialog.tsx` — 10 old classes
11. `components/EntitySearchInput.tsx` — 9 old classes
12. `components/CustomDateInput.tsx` — 9 old classes
13. `components/SegmentedControl.tsx` — 8 old classes
14. `components/ContextBar.tsx` — 7 old classes
15. `components/SessionTimeoutWarning.tsx` — 6 old classes

### How to convert:
```
OLD: className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
NEW: style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 22, boxShadow: t.shadow }}

OLD: className="text-gray-600 text-sm"
NEW: style={{ color: t.text3, fontSize: 13 }}

OLD: className="bg-blue-600 text-white px-4 py-2 rounded-lg"
NEW: style={{ background: t.accent, color: '#fff', padding: '10px 18px', borderRadius: 8 }}
```

Each file must import `useTheme` and `THEMES`:
```typescript
import { useTheme } from '../theme/useTheme';
// Then inside component:
const { t } = useTheme();
```

---

## TASK 2: Replace remaining FormModal popups with navigate()

### DirectInsuranceList.tsx
- Remove `showFormModal` state and `<FormModal>` component
- Edit button: change from `setShowFormModal(true)` to `navigate('/edit/${id}')`
- The edit page already exists at route `/edit/:id` → `PolicyForm.tsx`

### SlipsDashboard.tsx
- Remove `<FormModal>` usage
- Navigate to `/slips/edit/${id}` or `/slips/new` instead

### MGADashboard.tsx
- Remove `<FormModal>` usage
- Navigate to MGA edit page or create inline editing with SidePanel

---

## TASK 3: Replace MasterDetailModal in Dashboard

### Dashboard.tsx
- Currently uses `<MasterDetailModal>` for viewing record details
- Replace with the `SidePanel` component (same as DirectInsuranceList uses)
- Grid layout: `gridTemplateColumns: selectedId ? '1fr 360px' : '1fr'`
- Side panel shows: key fields, status badge, action buttons (Edit, View Full)
- "View Full" button can open a route (navigate) or the existing DetailModal if needed for backward compat

---

## TASK 4: Verify all shared UI components are used

Every page should use these standardized components from `components/ui/`:
- `Button` (not custom `<button>` with inline styles)
- `Input` (not custom `<input>` with className)
- `Badge` / `StatusBadge` / `StageBadge`
- `Card` for panels
- `SectionCard` for form sections
- `Modal` for any remaining popups
- `SidePanel` for detail views on list pages
- `Table` for data tables
- `Field` for form field wrappers
- `KpiCard` for metrics

---

## TASK 5: Font size standardization

Ensure these exact sizes everywhere:
- Page titles: 24px, weight 700
- Section titles: 15px, weight 600
- Table headers: 12px, weight 600, uppercase
- Table cells: 13px
- Form labels: 12px, weight 500
- Form inputs: 13px, padding 10px 14px
- Buttons: 13px, weight 600
- Badges: 11px, weight 600
- Sidebar items: 13px
- No text smaller than 11px anywhere

---

## EXECUTION ORDER

1. Fix all 5 pages (MGADashboard first — most work)
2. Fix all 15 components (DetailModal first — most work)  
3. Replace FormModal with navigate() in 3 pages
4. Replace MasterDetailModal with SidePanel in Dashboard
5. Verify font sizes across all pages
6. `npm run build` — zero errors
7. Commit and push

## IMPORTANT
- Do NOT remove any business logic, form fields, or functionality
- Only change visual styling and component wrappers
- Test that `npm run build` succeeds after each major change
