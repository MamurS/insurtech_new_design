
# InsurTech Policy Manager - Technical Documentation

## 1. Project Overview
**InsurTech Policy Manager** is a comprehensive, browser-based Single Page Application (SPA) designed for the insurance industry. It facilitates the end-to-end lifecycle management of insurance policies, inward/outward reinsurance slips, claims handling, and legal entity management. The system features a robust Role-Based Access Control (RBAC) system, audit logging, and AI-assisted clause generation.

## 2. Technology Stack

### Frontend Core
*   **Framework:** [React 18](https://react.dev/) (Functional Components, Hooks)
*   **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict typing)
*   **Build Tool:** [Vite](https://vitejs.dev/) (Fast HMR and bundling)
*   **Routing:** [React Router DOM v6+](https://reactrouter.com/)

### State Management & Data Fetching
*   **Server State:** [@tanstack/react-query](https://tanstack.com/query/latest) (Caching, synchronization, background updates)
*   **Global State:** React Context API (`AuthContext`, `PermissionContext`)

### UI & Styling
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) (Utility-first CSS)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Components:** Custom-built components (Modals, Dropdowns, Date Pickers) using standard HTML5/CSS3.

### Backend & Database (BaaS)
*   **Platform:** [Supabase](https://supabase.com/)
*   **Database:** PostgreSQL
*   **Authentication:** Supabase Auth (Email/Password)
*   **Storage:** Supabase Storage (Document uploads)
*   **Security:** Row Level Security (RLS) policies enforced at the database level.
*   **Business Logic:** PostgreSQL Functions (RPCs) and Triggers.

### Integrations & Utilities
*   **Artificial Intelligence:** [Google Gemini API](https://ai.google.dev/) (`@google/genai`) for generating insurance clauses.
*   **Excel Export:** [ExcelJS](https://github.com/exceljs/exceljs) for generating .xlsx reports.
*   **Date Handling:** Native `Date` object with custom utility wrappers (`dateUtils.ts`).

---

## 3. Architecture Overview

The application follows a **Client-Server architecture** where the React frontend communicates directly with the Supabase Postgres database via the `@supabase/supabase-js` client.

### Data Flow
1.  **Authentication:** User logs in via Supabase Auth. Session token is stored in local storage/cookies.
2.  **Authorization:** 
    *   **Frontend:** `PermissionContext` loads roles and permissions to toggle UI elements.
    *   **Database:** RLS policies use the auth `uid()` to restrict SQL execution based on the user's role/ID.
3.  **API Calls:** `React Query` hooks wrap Supabase calls to fetch data, providing loading states and caching.
4.  **Offline Capability:** The system includes a fallback "Local Mode" (using `localStorage`) for development or demonstration purposes when database credentials are missing.

---

## 4. Key Modules

### A. Policy Management
*   **Direct & Inward:** distinct workflows for Direct Insurance and Inward Reinsurance.
*   **Financials:** Handles multi-currency logic (Policy Currency -> National Currency), exchange rates, and premium calculations (Gross, Net, Commission, Tax).
*   **Document Generation:** HTML-based rendering of Policy Schedules and Slips with print-to-PDF functionality.

### B. Outward Reinsurance (Slips)
*   **Panel Management:** Support for multi-market placement (multiple reinsurers with specific shares).
*   **Slips Registry:** Tracks outward slips, limits of liability, and status.

### C. Claims Center
*   **Liability Logic:** Distinguishes between `ACTIVE` (Actionable) and `INFORMATIONAL` (Record-keeping) claims based on coverage basis (Occurrence vs. Claims Made).
*   **Transaction Ledger:** Immutable financial ledger for Reserves, Payments, Fees, and Recoveries.
*   **Burn Cost Analysis:** Aggregates financials for reporting.

### D. Agenda & Tasks
*   **Task Management:** Assign tasks to users, set priorities and due dates.
*   **Integration:** Tasks can be linked directly to Policies, Slips, or Claims.
*   **Activity Log:** Audit trail of critical actions performed within the system.

### E. Admin Console
*   **RBAC:** Dynamic creation of Roles and Permissions.
*   **User Management:** Create users, assign roles, departments, and authority limits.
*   **Recycle Bin:** Soft-delete and restore functionality for core entities.
*   **Configuration:** Manage Exchange Rates and Policy Templates.

---

## 5. Database Schema (High Level)

*   **`profiles`**: Extends auth.users with app-specific data (Role, Department, Phone).
*   **`policies`**: Core insurance records (JSONB used for installments/claims metadata).
*   **`slips`**: Outward reinsurance placements.
*   **`claims`**: Header table for claims.
*   **`claim_transactions`**: Financial movement ledger for claims.
*   **`legal_entities`**: CRM table for Insureds, Brokers, and Reinsurers.
*   **`agenda_tasks`**: Workflow tasks.
*   **`roles` / `permissions` / `role_permissions`**: RBAC structure.
*   **`authority_limits`**: Financial approval limits per role.

---

## 6. Setup & Installation

1.  **Clone the repository**
2.  **Install Dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Configuration:**
    Create a `.env` file in the root:
    ```env
    API_KEY="your_google_gemini_key"
    SUPABASE_URL="your_supabase_project_url"
    SUPABASE_KEY="your_supabase_anon_key"
    ```
4.  **Database Setup:**
    Run the following SQL migration scripts in your Supabase SQL Editor (in order):
    - `supabase_schema.sql` - Base schema
    - `supabase_migration.sql` - Initial migration
    - `supabase_departments_migration.sql` - Departments module
    - `supabase_claims_migration.sql` - Claims module
    - `supabase_agenda_migration.sql` - Agenda/Tasks module
    - `supabase_inward_reinsurance_migration.sql` - Inward Reinsurance module

    **Note:** If you see an error like "Could not find the table 'public.inward_reinsurance' in the schema cache", you need to run the corresponding migration script in Supabase.

5.  **Run Development Server:**
    ```bash
    npm run dev
    ```
6.  **Build for Production:**
    ```bash
    npm run build
    ```

## 7. Security

*   **Authentication:** Handled securely via Supabase Auth (JWT).
*   **Authorization:** 
    *   **RLS:** Database rows are protected so users can only access data they are permitted to see.
    *   **Context:** Frontend UI elements are hidden/disabled based on permission codes (e.g., `policy.create`, `claims.pay`).
*   **Audit:** Critical actions are logged to `entity_logs` and `activity_log`.
