# PHASE 7: Component Standardization — USE Shared UI Components

## PROBLEM
The shared UI components in `components/ui/` (Button, Input, Card, KpiCard, Modal, Field, Table, SectionCard, Select) exist but are NOT imported or used by any page. Every page uses inline `<button>`, `<input>`, `<select>` with duplicated styles. This creates ~3000 lines of duplicated style code.

## TASK
Replace ALL inline `<button>`, `<input>`, `<select>` elements with the shared components from `components/ui/`.

## RULES

### Replace `<button>` → `Button`
```tsx
// BEFORE (inline):
<button
  onClick={handleClick}
  style={{ background: t.accent, color: '#fff', padding: '10px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
>
  Save
</button>

// AFTER (shared component):
import Button from '../components/ui/Button';
<Button onClick={handleClick}>Save</Button>

// Ghost variant:
<Button variant="ghost" onClick={handleCancel}>Cancel</Button>

// Danger variant:
<Button variant="danger" onClick={handleDelete}>Delete</Button>

// With icon:
<Button icon={<Plus size={14} />} onClick={handleNew}>New Policy</Button>

// Small:
<Button size="sm" onClick={handleAction}>Action</Button>
```

### Replace `<input>` → `Input`
```tsx
// BEFORE:
<input
  type="text"
  value={search}
  onChange={e => setSearch(e.target.value)}
  placeholder="Search..."
  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: t.bgInput, border: `1px solid ${t.border}`, color: t.text1, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
/>

// AFTER:
import Input from '../components/ui/Input';
<Input value={search} onChange={setSearch} placeholder="Search..." />

// For native onChange (event-based):
<Input value={val} onNativeChange={e => handleChange(e)} />
```

### Replace `<select>` → `Select`
```tsx
// BEFORE:
<select value={filter} onChange={e => setFilter(e.target.value)} style={{...}}>
  <option value="">All</option>
  <option value="active">Active</option>
</select>

// AFTER:
import Select from '../components/ui/Select';
<Select value={filter} onChange={setFilter} options={[
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
]} />
```

### Replace card divs → `Card`
```tsx
// BEFORE:
<div style={{ background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 22, boxShadow: t.shadow }}>

// AFTER:
import { Card } from '../components/ui/Card';
<Card>...</Card>
// or with padding override:
<Card style={{ padding: 16 }}>...</Card>
```

### Replace KPI cards → `KpiCard`
```tsx
import KpiCard from '../components/ui/KpiCard';
<KpiCard label="Total GWP" value="$295,300" delta="+12.4%" up icon={<BarChart3 size={16} />} color={t.accent} />
```

### Replace form sections → `SectionCard`
```tsx
import SectionCard from '../components/ui/SectionCard';
<SectionCard title="Insured Party" subtitle="Details" icon={<Building2 size={18} />} color={t.accent}>
  {/* form fields */}
</SectionCard>
```

### Replace form labels → `Field`
```tsx
import Field from '../components/ui/Field';
<Field label="Insured Name" required>
  <Input value={name} onChange={setName} />
</Field>
```

## ADDITIONAL FIXES

### Fix borderRadius: 7 → 8
All `borderRadius: 7` should be `borderRadius: 8`. There are 11 instances.

### Fix fontSize: 10 → 11
All `fontSize: 10` should be `fontSize: 11` (minimum). There are 8 instances.

### Fix MGADashboard — remove FormModal popup
Replace `FormModal` with `navigate()` to a dedicated edit page, or use inline editing with SidePanel.

### Fix Dashboard — replace MasterDetailModal 
Replace `MasterDetailModal` usage with the existing `SidePanel` component (already imported in Dashboard).

## EXECUTION ORDER

Process ONE file at a time. After each file: verify `npm run build` succeeds.

### Priority order (biggest files first):
1. `pages/AdminConsole.tsx` (59 buttons)
2. `pages/MGADashboard.tsx` (19 buttons + FormModal fix)
3. `pages/Dashboard.tsx` (11 buttons + MasterDetailModal fix)
4. `pages/SlipForm.tsx` (17 buttons)
5. `pages/PolicyForm.tsx` (12 buttons + 33 inputs)
6. `pages/InwardReinsuranceList.tsx` (13 buttons)
7. `pages/DirectInsuranceList.tsx` (10 buttons)
8. `pages/InwardReinsuranceDashboard.tsx` (7 buttons)
9. `pages/ClaimDetail.tsx` (10 buttons)
10. `pages/ClaimsList.tsx` (7 buttons)
11. `pages/SlipsDashboard.tsx` (11 buttons)
12. `pages/RegulatoryReporting.tsx` (6 buttons)
13. `pages/EntityManager.tsx` (6 buttons)
14. `pages/Analytics.tsx` (4 buttons)
15. `pages/IBNREstimation.tsx` (4 buttons)
16. `pages/ClauseManager.tsx` (5 buttons)
17. `pages/Login.tsx` (5 buttons)
18. `pages/InwardReinsuranceForm.tsx` (18 inputs)
19. `pages/EntityForm.tsx` (14 inputs)
20. `pages/Settings.tsx` (5 inputs)
21. `components/DetailModal.tsx` (23 buttons)
22. `components/MasterDetailModal.tsx` (buttons)
23. `components/SlipFormContent.tsx` (16 buttons)
24. `components/PolicyFormContent.tsx` (12 buttons)
25. `components/NewRequestForm.tsx` (11 buttons)
26. `components/RegisterClaimModal.tsx`
27. `components/RoleEditModal.tsx`
28. `components/EntityDetailModal.tsx`
29. `components/TaskDetailModal.tsx`
30. `components/EnvironmentSwitcher.tsx`
31. `components/SICCodePicker.tsx`
32. `components/Layout.tsx` (5 buttons)

### IMPORTANT
- Do NOT change any business logic, event handlers, state management, or data flow
- Only change the JSX element (`<button>` → `<Button>`) and remove the now-unnecessary inline styles
- Keep any custom styles that are unique (e.g., position: absolute) as `style` prop overrides
- Some buttons are filter/tab toggles with active state — keep the active state logic, pass as `style` override
- `npm run build` must succeed after every file change
