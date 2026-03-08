
# InsurTech Policy Manager - User Manual

**Version:** 1.1  
**Last Updated:** May 2025

---

## Table of Contents

1.  [Introduction](#1-introduction)
2.  [Getting Started](#2-getting-started)
    *   [Login](#login)
    *   [Navigation](#navigation)
3.  [Dashboard](#3-dashboard)
4.  [Policy Management](#4-policy-management)
    *   [Creating a Policy](#creating-a-policy)
    *   [Financials & Currency](#financials--currency)
    *   [Reinsurance (Outward)](#reinsurance-outward)
    *   [Policy Lifecycle (Activation, Cancellation)](#policy-lifecycle)
    *   [Document Generation](#document-generation)
5.  [Reinsurance Slips](#5-reinsurance-slips)
6.  [Claims Center](#6-claims-center)
    *   [Registering a Claim](#registering-a-claim)
    *   [Liability Types](#liability-types)
    *   [Financial Ledger](#financial-ledger)
7.  [Entity Management](#7-entity-management)
8.  [Clause Library](#8-clause-library)
9.  [Agenda & Tasks](#9-agenda--tasks)
10. [Admin Console](#10-admin-console)

---

## 1. Introduction

The **InsurTech Policy Manager** is a centralized platform designed to streamline insurance operations. It handles the entire lifecycle of insurance policies (Direct and Inward Reinsurance), manages outward reinsurance placements, tracks claims with financial precision, and maintains a registry of legal entities.

## 2. Getting Started

### Login
Access the system using your corporate email and password.
*   **System Access**: Restricted to authorized personnel.
*   **Security**: All sessions are encrypted.
*   **Note**: If you are a new user, contact your Administrator to create an account.

### Navigation
The sidebar on the left provides access to all major modules:
*   **Dashboard**: Your home screen with policy overviews.
*   **My Agenda**: Your assigned tasks and to-dos.
*   **Reinsurance Slips**: Outward slip registry.
*   **Claims Center**: Loss notification and claims management.
*   **Legal Entities**: CRM for clients, brokers, and markets.
*   **Clause Library**: Database of standard wordings.
*   **Admin Console**: (Restricted) System configuration.

---

## 3. Dashboard

The Dashboard provides a unified view of all Direct Insurance and Inward Reinsurance business.

*   **View Modes**: Toggle between `Compact` (high-level status) and `Extended` (detailed financial columns) using the buttons in the search bar.
*   **Filtering**: Use the tabs to filter by status: `All`, `Active`, `Pending`, `Cancelled`.
*   **Search**: Real-time search across Policy Number, Insured Name, Broker, or Class of Business.
*   **Export**: Click "Export Excel" to download the current view as a formatted `.xlsx` report.

---

## 4. Policy Management

### Creating a Policy
Click **New Policy** on the dashboard. The form is divided into logical sections:

1.  **Channel & Source**: Select `Direct` (we are the insurer) or `Inward` (we are the reinsurer). Select the Intermediary (Broker, Agent) if applicable.
2.  **Risk Details**: Enter the Insured Name (searchable), Territory, Industry, and Class of Business.
3.  **Dates**: Define Inception, Expiry, and Payment Due dates.

### Financials & Currency
The system supports multi-currency entry.
*   **Policy Currency**: Select the currency of the contract (e.g., USD, EUR).
*   **Exchange Rate**: Fetch the latest rate or enter manually to convert to National Currency (UZS).
*   **Dual Input**: You can edit values in either the Original Currency or National Currency; the system auto-calculates the other based on the exchange rate.

### Reinsurance (Outward)
If the risk is reinsured out:
1.  Check the **Applicable?** box in the "Outward Reinsurance" section.
2.  Click **Add Market** to add reinsurers to the panel.
3.  Enter the **Share %** and **Commission %** for each reinsurer.
4.  The system calculates `Ceded Premium` and `Net Payable` automatically.

### Policy Lifecycle
Policies move through specific statuses:
*   **Draft/Pending**: The initial state.
*   **Bind & Activate**: Once signed, upload the signed PDF and click "Activate". This locks the inception date.
*   **NTU (Not Taken Up)**: Use this if the client declines the quote before inception.
*   **Cancellation**: For terminating an active policy mid-term.
*   **Early Termination**: A specific workflow to record the initiator and reason for ending a policy early.

### Document Generation
Click the **File Icon** (Wording) on any policy row.
*   **Templates**: Select a template (e.g., Policy Schedule, Cover Note).
*   **Clauses**: The system automatically appends clauses linked to the policy.
*   **Print/PDF**: Use the "Print / Save PDF" button to generate the final document.

---

## 5. Reinsurance Slips

Use this module to generate and track internal slip numbers for Outward Reinsurance.
*   **Registry**: Automatically assigns sequential slip numbers (e.g., `RE/2025/001`).
*   **Panel Support**: Record multiple markets participating in a single slip.
*   **Limit of Liability**: Track the specific limit placed via the slip.

---

## 6. Claims Center

### Registering a Claim
1.  Click **Register Claim**.
2.  **Search Policy**: Find the linked policy by number or insured name.
3.  **Details**: Enter Loss Date, Report Date, and Description.

### Liability Types
The system automatically suggests a liability type based on the policy period and coverage basis:
*   **ACTIVE**: The loss is covered. You can set reserves and make payments.
*   **INFORMATIONAL**: The loss is outside the period or below deductible. No payments allowed; used for record-keeping only.

### Financial Ledger
For `ACTIVE` claims, use the **Financial Ledger**:
*   **Reserve Set**: Establish the initial estimate of the loss.
*   **Payment**: Record indemnity payments to the insured.
*   **Fees**: Record Legal or Adjuster fees.
*   **Recovery**: Record subrogation or salvage recoveries.
*   *Note*: All transactions update the "Outstanding" balance in real-time.

---

## 7. Entity Management

A central database for all companies and people.
*   **Types**: Insured, Reinsurer, Broker, Agent, MGA.
*   **Validation**: Tracks Tax IDs (INN), Directors, and Bank Details.
*   **Audit**: Tracks history of changes to entity data.

---

## 8. Clause Library

Manage the standard texts used in policies.
*   **Categories**: General, Exclusion, Condition, Warranty.
*   **AI Drafting**: Use the **"AI Drafting Assistant"** to generate legal text using Google Gemini. Type a prompt like *"Exclude damage caused by cyber attacks"* and click Draft.

---

## 9. Agenda & Tasks

Track work items for yourself or assign them to colleagues.
*   **Creation**: Create tasks manually or link them directly from a Policy, Claim, or Slip.
*   **Attachments**: Upload PDFs, Images, or Word docs to tasks.
*   **Status**: Tasks move from `Pending` -> `In Progress` -> `Completed`.
*   **Overdue**: Tasks past their due date are highlighted in red.

---

## 10. Admin Console

*Restricted to Super Admin and Admin roles.*

*   **Dashboard**: System-wide statistics.
*   **Roles & Permissions (RBAC)**: 
    *   Create dynamic roles (e.g., "Senior Underwriter").
    *   Assign granular permissions (e.g., `claims.pay`).
    *   Set **Authority Limits** (e.g., Max Claim Payment = $50,000).
*   **User Management**: Add new users, reset passwords, assign Departments.
*   **Departments**: Define the organization structure, assign department heads, and set staff capacities.
*   **Database Browser**: Raw view of database tables for troubleshooting.
*   **Recycle Bin**: Restore accidentally deleted Policies, Slips, or Clauses.
*   **FX Rates**: Manage the central exchange rates used for currency conversion.
