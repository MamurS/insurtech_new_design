# Tailwind CSS Migration: CDN → Proper Vite Build

## Background

Currently the app loads Tailwind CSS from an external CDN in `index.html`:
```html
<script src="https://cdn.tailwindcss.com"></script>
```

And React/other libraries are loaded via an `importmap` from `esm.sh`.

This works but has downsides:
- Loads ~3MB of CSS instead of ~10-50KB (only used classes)
- Requires internet on first load
- Cannot use custom Tailwind config (colors, fonts, etc.)
- Not a true production build pipeline

## What This Migration Does

Moves from "load everything from the internet at runtime" to "bundle everything at build time via Vite." After migration:

- Cloudflare runs `npm run build` → Vite bundles everything
- Only CSS classes actually used in the code are included
- All libraries (React, Supabase, etc.) are bundled into optimized JS files
- No external CDN dependencies at runtime

## Prerequisites

- Node.js installed on your PC (https://nodejs.org — LTS version)
- Access to the GitHub repo
- Cloudflare Pages project connected to the repo

## Migration Steps

> ⚠️ Do this as a single focused task. Do not do it partially. Test locally before pushing.

### Step 1 — Install dependencies locally (one time setup on your PC)

```bash
cd path/to/InsurTech-main
npm install
npm install -D tailwindcss postcss autoprefixer
```

### Step 2 — Initialize Tailwind config

```bash
npx tailwindcss init -p
```

This creates two files: `tailwind.config.js` and `postcss.config.js`

### Step 3 — Configure `tailwind.config.js`

Replace contents with:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Step 4 — Create `src/index.css` (or `index.css` in root)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Step 5 — Update `index.tsx` to import the CSS

Add at the top:
```typescript
import './index.css';
```

### Step 6 — Update `index.html`

Remove these lines:
```html
<!-- DELETE THIS -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- DELETE THE ENTIRE importmap block -->
<script type="importmap">...</script>
```

Keep the `<style>` block with your custom CSS (scrollbars, blur effects, fonts etc.) — that stays.

### Step 7 — Update `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
})
```

### Step 8 — Configure Cloudflare Pages build settings

In Cloudflare dashboard → Pages → your project → Settings → Build:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (or wherever `package.json` is) |

### Step 9 — Test locally before pushing

```bash
npm run dev      # Should work exactly as before
npm run build    # Should complete without errors
npm run preview  # Preview the production build locally
```

### Step 10 — Push to GitHub

Cloudflare will automatically pick up the changes and run the build.

## Rollback Plan

If anything breaks, revert `index.html` to restore the CDN script tag and importmap. The old setup will work immediately.

## Notes

- This migration should be done with Claude Code for assistance
- The `react-datepicker` CSS import in `index.html` should be moved to `index.tsx` as: `import 'react-datepicker/dist/react-datepicker.css'`
- After migration, `package.json` dependencies (React, Supabase, etc.) will be bundled by Vite — the importmap becomes unnecessary
