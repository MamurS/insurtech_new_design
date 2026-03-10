# MOSAIC ERP v2 — Phase 5: Design System Standardization + UI Fixes

## GOAL

Every visual element in the app must follow ONE consistent design system. No exceptions. Every page, every form, every modal, every table, every button must look like they belong to the same application. Reference `mosaic-erp-v15.jsx` for the visual direction.

---

## PART 1: DESIGN SYSTEM STANDARDS

### Typography — ALL sizes increased for readability

| Element | Font Size | Weight | Color | Letter Spacing |
|---------|-----------|--------|-------|----------------|
| Page title | 24px | 700 | text1 | -0.3px |
| Section title / Card title | 15px | 600 | text1 | 0 |
| Table header | 12px | 600 | text3 | 0.5px, uppercase |
| Table cell (primary) | 13px | 500 | text1 | 0 |
| Table cell (secondary) | 13px | 400 | text2 | 0 |
| Table cell (code/ID) | 12px | 500 | accent | monospace |
| Form label | 12px | 500 | text2 | 0.3px |
| Form input value | 13px | 400 | text1 | 0 |
| Form input placeholder | 13px | 400 | text4 | 0 |
| Button (primary) | 13px | 600 | white | 0 |
| Button (secondary/ghost) | 13px | 500 | text2 | 0 |
| Badge / Tag | 11px | 600 | semantic | 0 |
| Sidebar nav item | 13px | 400 (500 if active) | text2 (accent if active) | 0 |
| Sidebar group label | 10px | 700 | text4 | 1.2px, uppercase |
| Tab label | 13px | 400 (600 if active) | text3 (text1 if active) | 0 |
| KPI card value | 26px | 700 | text1 | 0 |
| KPI card label | 12px | 500 | text3 | 0.5px |
| KPI card delta | 12px | 600 | semantic | 0 |
| Tooltip / hint | 11px | 400 | text4 | 0 |
| Breadcrumb | 12px | 400 | text3, last: text1 | 0 |

**Font family:** `'DM Sans', system-ui, sans-serif` everywhere. Monospace for IDs/codes: `'JetBrains Mono', 'Fira Code', monospace`.

**CRITICAL:** No text smaller than 11px anywhere in the app. Default readable size is 13px.

### Colors — Semantic System

| Token | Dark Theme | Light Theme | Usage |
|-------|-----------|-------------|-------|
| text1 | #d0dced | #0f172a | Primary text, headings, values |
| text2 | #93adc8 | #334155 | Secondary text, labels, descriptions |
| text3 | #6889a8 | #64748b | Tertiary text, table headers |
| text4 | #45647f | #94a3b8 | Muted text, placeholders, hints |
| text5 | #2d4a62 | #cbd5e1 | Disabled, decorative |
| bgApp | #06090f | #f1f5f9 | Page background |
| bgPanel | #0c1118 | #ffffff | Cards, panels, tables |
| bgSidebar | #080c12 | #f8fafc | Sidebar, tab bar background |
| bgInput | #0a0e16 | #ffffff | Input fields |
| bgHover | #152233 | #e2e8f0 | Hover state on rows, buttons |
| bgActive | #1a3050 | #dbeafe | Selected/active state |
| border | #1a2538 | #e2e8f0 | Standard borders |
| borderL | #223348 | #cbd5e1 | Stronger borders (inputs, cards) |
| accent | #2563eb | #2563eb | Primary actions, links, active tabs |
| accentHover | #3b82f6 | #1d4ed8 | Hover on accent elements |
| success | #10b981 | #059669 | Active, bound, live status |
| warning | #f59e0b | #d97706 | Pending, renewal, in-dev status |
| danger | #ef4444 | #dc2626 | Lapsed, errors, delete actions |

**CRITICAL:** text2 in dark theme changed to `#93adc8` (brighter than before). text3 changed to `#6889a8`. This fixes readability.

### Spacing System

| Token | Value | Usage |
|-------|-------|-------|
| page-padding | 28px | Main content area padding |
| card-padding | 22px | Inside cards and panels |
| card-gap | 16px | Between cards |
| section-gap | 24px | Between major sections |
| input-padding | 10px 14px | Inside input fields |
| cell-padding | 14px 20px | Table row padding |
| header-padding | 12px 20px | Table header padding |

### Border Radius

| Element | Radius |
|---------|--------|
| Card / Panel | 10px |
| Input / Select | 8px |
| Button | 8px |
| Badge / Tag | 20px (pill) |
| Avatar | 8px (square-ish) |
| Modal | 12px |
| Tab (active) | 6px 6px 0 0 |

### Shadows

| Level | Dark | Light |
|-------|------|-------|
| sm | 0 1px 3px rgba(0,0,0,0.4) | 0 1px 3px rgba(0,0,0,0.08) |
| md | 0 4px 16px rgba(0,0,0,0.4) | 0 4px 16px rgba(0,0,0,0.1) |
| lg | 0 8px 32px rgba(0,0,0,0.5) | 0 8px 32px rgba(0,0,0,0.12) |

### Standard Button Styles

```
PRIMARY:    bg=accent, color=white, hover=accentHover, radius=8, padding=10px 18px, font=13px/600
GHOST:      bg=transparent, border=1px solid border, color=text2, hover=bgHover, radius=8, padding=10px 18px
DANGER:     bg=danger+18 (semi-transparent), color=danger, hover=danger+25, radius=8
SUCCESS:    bg=success+18, color=success, radius=8
SMALL:      padding=6px 12px, font=12px
```

Every button in the app must use one of these 4 variants. No custom one-off button styles.

### Standard Input Styles

```
NORMAL:     bg=bgInput, border=1px solid border, color=text1, radius=8, padding=10px 14px, font=13px
            focus: borderColor=accent
            placeholder: color=text4
DISABLED:   bg=bgInputDis, color=text4
SELECT:     same as input + dropdown arrow
```

Every input, select, textarea in the app must use this exact style.

### Standard Badge Styles

```
STATUS (pill):  bg=${color}15, color=${color}, radius=20px, padding=4px 12px, font=11px/600
                with 6px dot on left
                
Active:    color=success
Pending:   color=warning  
Renewal:   color=accent
Lapsed:    color=danger
Expired:   color=text3

STAGE (pill):   bg=${color}12, color=${color}, radius=20px, padding=4px 12px, font=11px/600

TYPE (pill):    bg=${color}12, color=${color}, radius=20px, padding=4px 10px, font=10px/600
                DIRECT=accent, IN-FOREIGN=purple(#8b5cf6), IN-DOMESTIC=success
```

### Standard Card Style

```
background: bgPanel
border: 1px solid border
borderRadius: 10px
boxShadow: shadow.sm
padding: 22px
```

### Standard SectionCard (for forms)

```
Container:   bg=bgPanel, border=1px solid border, radius=10px, marginBottom=16px
Header:      padding=16px 22px, borderBottom=1px solid border, borderLeft=3px solid ${accentColor}
             Icon (18px) + Title (15px/600/text1) + Subtitle (12px/text4)
Body:        padding=22px
```

### Standard Table Style

```
Container:   bg=bgPanel, border=1px solid border, radius=10px, overflow=hidden, shadow=sm
Header row:  padding=12px 20px, borderBottom=1px solid border, bg=transparent
             text: 12px/600/text3/uppercase/letterSpacing=0.5px
Data row:    padding=14px 20px, borderBottom=1px solid borderS
             hover: bg=bgHover
             selected: bg=bgActive
             NO alternating row colors
```

### Standard Modal Style (when modals are needed)

```
Overlay:     bg=rgba(0,0,0,0.5), backdropFilter=blur(4px)
Container:   bg=bgPanel, border=1px solid borderL, radius=12px, shadow=lg
             maxWidth=700px (medium), 900px (large), 500px (small)
Header:      padding=20px 24px, borderBottom=1px solid border
             Title: 18px/700/text1
             Close button: top-right ×
Body:        padding=24px, overflowY=auto, maxHeight=70vh
Footer:      padding=16px 24px, borderTop=1px solid border, display=flex, justify=flex-end, gap=10px
```

---

## PART 2: UI BEHAVIOR FIXES

### FIX 1: Detail Panel — Side Panel, NOT Modal

**Current (wrong):** Clicking a row opens a modal popup.

**Required:** Clicking a row opens an inline side panel (360px) to the right of the table. The table shrinks to make room.

```
Grid: gridTemplateColumns: selected ? "1fr 360px" : "1fr"
```

- Panel has: header with title + close ×, scrollable body with key fields, action buttons at bottom
- Clicking same row again or × closes panel
- Selected row shows `bgActive` background
- Apply to: Dashboard portfolio, DirectInsuranceList, InwardReinsuranceList, ClaimsList, SlipsDashboard, EntityManager
- Keep DetailModal/MasterDetailModal for "View Full Detail" button inside the side panel (double-click or dedicated button)

### FIX 2: New Request Form — Full Page, NOT Modal

**Current (wrong):** Form opens as modal popup.

**Required:** Form is a full page with progress sidebar.

```
Layout: gridTemplateColumns: "1fr 280px"
Height: calc(100vh - 82px)  // minus topbar + tabbar
```

Left side: scrollable form with SectionCard sections
Right side: fixed sidebar with:
- Circular SVG progress ring (percentage)  
- Checklist of required fields with ✓/○ status
- Each item shows completion state

Type selector at top: 3 card-buttons (Direct / Inward Foreign / Inward Domestic)
Bottom: Cancel + Save Draft + Submit buttons

Navigate to form page (not modal). URL should be `/new` or similar route.

ALL existing form fields must be preserved — only the layout/container changes.

### FIX 3: Color Contrast — ALL text must be readable

Apply the updated color values from the table above. Specifically:
- Dark theme `text2` → `#93adc8` (was too dark)
- Dark theme `text3` → `#6889a8` (was too dark)
- Dark theme `bgHover` → `#152233` (needs to be visible)

Test every page in both themes. Every piece of text must be comfortably readable.

### FIX 4: Layout Must Match Mockup

**Top Bar (44px):**
- Left: Hamburger, Logo gradient [M], "Mosaic ERP" (14px/700), "BLUEPRINT" badge
- Right: Search box (⌘K), Bell icon (red dot), Sun/Moon toggle, User avatar

**Tab Bar (38px):**
- Tabs with icons + labels (13px)
- Active: top border=accent, bg=bgApp, bottom border removed (merges with content)
- Inactive: transparent, text3
- Admin: right-aligned, grey top border

**Sidebar (190px):**
- Collapsible with smooth 0.2s transition
- Group label: 10px uppercase
- Nav items: icon + label (13px), hover=bgHover
- Accent items: blue left border, accent color text

---

## PART 3: STANDARDIZATION CHECKLIST

Go through EVERY file and ensure:

- [ ] All buttons use one of 4 standard variants (primary/ghost/danger/success)
- [ ] All inputs use standard input style (same padding, radius, font size)
- [ ] All badges use standard pill style
- [ ] All cards use standard card style (radius=10, shadow, border)
- [ ] All tables use standard table style (no alternating rows, standard header)
- [ ] All modals use standard modal style (overlay, radius=12, standard header/footer)
- [ ] All page titles are 24px/700
- [ ] All section titles are 15px/600
- [ ] No text smaller than 11px
- [ ] No hardcoded colors — everything through theme tokens
- [ ] Font family is DM Sans everywhere
- [ ] All form labels are 12px/500/text2
- [ ] All form inputs are 13px with 10px 14px padding
- [ ] Spacing is consistent (28px page padding, 22px card padding, 16px gaps)

---

## EXECUTION ORDER

1. **First:** Create/update the shared UI components (Button, Input, Badge, Card, Table, SectionCard, Modal, Field) with EXACT specs above. Every page will import these.
2. **Second:** Update theme tokens (increase text2/text3 brightness, update bgHover)
3. **Third:** Fix Layout — side panel behavior on list pages
4. **Fourth:** Fix New Request — full page with progress sidebar
5. **Fifth:** Go page by page and replace all inline styles / custom components with the standard shared components
6. **Sixth:** Test both themes on every page — verify readability
7. **Seventh:** `npm run build` — zero errors
8. Commit and push
