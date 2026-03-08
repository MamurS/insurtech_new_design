
export enum Currency {
  UZS = 'UZS',
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  RUB = 'RUB',
  CNY = 'CNY',
  JPY = 'JPY',
  CHF = 'CHF',
  KZT = 'KZT',
  TRY = 'TRY',
  AED = 'AED',
  CAD = 'CAD',
  AUD = 'AUD',
  KRW = 'KRW',
  INR = 'INR'
}

export enum PolicyStatus {
  DRAFT = 'Draft',
  PENDING = 'Pending Confirmation',
  ACTIVE = 'Active',
  NTU = 'Not Taken Up',
  EXPIRED = 'Expired',
  CANCELLED = 'Cancelled',
  EARLY_TERMINATION = 'Early Termination',
}

export enum PaymentStatus {
  PENDING = 'Pending',
  PAID = 'Paid',
  OVERDUE = 'Overdue',
  PARTIAL = 'Partial',
}

export type Channel = 'Direct' | 'Inward';
export type IntermediaryType = 'Direct' | 'Broker' | 'Agent' | 'MGA';
export type UserRole = 'Super Admin' | 'Admin' | 'Underwriter' | 'Viewer' | string;

export interface UserPermissions {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canBind: boolean;
  canCancel: boolean;
  canManageUsers: boolean;
}

export const DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  'Super Admin': { canView: true, canCreate: true, canEdit: true, canDelete: true, canBind: true, canCancel: true, canManageUsers: true },
  'Admin': { canView: true, canCreate: true, canEdit: true, canDelete: true, canBind: true, canCancel: true, canManageUsers: true },
  'Underwriter': { canView: true, canCreate: true, canEdit: true, canDelete: false, canBind: true, canCancel: true, canManageUsers: false },
  'Viewer': { canView: true, canCreate: false, canEdit: false, canDelete: false, canBind: false, canCancel: false, canManageUsers: false }
};

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  lastLogin?: string;
  permissions: UserPermissions;
  roleId?: string; // Link to dynamic role
}

// --- RBAC TYPES ---

export interface Role {
    id: string;
    name: string;
    description?: string;
    department?: string;
    level: number;
    isSystemRole: boolean;
    isActive: boolean;
}

export interface Permission {
    id: string;
    code: string;
    name: string;
    description?: string;
    module: string;
    action: string;
}

export interface AuthorityLimit {
    id: string;
    roleId: string;
    limitType: string; // 'policy_lol', 'claim_payment'
    currency: string;
    maxAmount: number;
    requiresApprovalAbove: boolean;
    canApproveOthers: boolean;
    description?: string;
}

export interface RBACPermissions {
    permissions: string[]; // Array of permission codes
    authorityLimits: {
        policyLol?: number;
        claimPayment?: number;
    };
    canApprove: boolean;
}

// --- AGENDA & USER MANAGEMENT TYPES ---

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type EntityType = 'POLICY' | 'SLIP' | 'CLAIM' | 'ENTITY' | 'INSURER' | 'OTHER';

export interface Department {
    id: string;
    name: string;
    code?: string;
    description?: string;
    headOfDepartment?: string;
    maxStaff?: number;
    currentStaffCount?: number;
    parentDepartmentId?: string;
    isActive: boolean;
}

export interface Profile {
    id: string;
    email: string;
    fullName: string;
    role: UserRole; // Legacy string role
    roleId?: string; // New RBAC role ID
    department?: string;
    departmentId?: string;
    phone?: string;
    avatarUrl?: string;
    isActive: boolean;
    createdAt: string;
    customLolLimit?: number;
    customClaimLimit?: number;
    canOverrideLimits?: boolean;
    updatedAt?: string;
    deactivatedAt?: string;
}

export interface AgendaTask {
    id: string;
    title: string;
    description?: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueDate?: string;
    
    assignedTo?: string;
    assignedToName?: string;
    assignedBy?: string;
    assignedByName?: string;
    assignedAt?: string;
    
    entityType?: EntityType;
    entityId?: string;
    policyNumber?: string;
    insuredName?: string;
    brokerName?: string;
    
    completedAt?: string;
    completedBy?: string;
    completionNotes?: string;
    
    createdAt: string;
    isOverdue?: boolean;
}

export interface TaskAttachment {
    id: string;
    taskId: string;
    fileName: string;
    fileType?: string;
    fileSize?: number;
    fileUrl: string; // Public or signed URL
    filePath?: string; // Internal storage path
    uploadedBy?: string;
    uploadedAt: string;
}

export interface ActivityLogEntry {
    id: string;
    userId: string;
    userName: string;
    action: string;
    actionDescription: string;
    entityType: string;
    entityId: string;
    entityReference?: string;
    createdAt: string;
    oldValues?: any;
    newValues?: any;
}

// --- EXISTING TYPES ---

export interface Installment {
  id: string;
  dueDate: string;
  dueAmount: number;
  paidDate?: string;
  paidAmount?: number;
  notes?: string;
}

export interface ClaimDeprecated { 
  id: string;
  dateOfLoss: string;
  description: string;
  reserveAmount: number;
  paidAmount: number;
  status: 'Open' | 'Closed';
}

export interface Clause {
  id: string;
  title: string;
  content: string;
  isStandard: boolean;
  category: 'General' | 'Exclusion' | 'Condition' | 'Warranty';
  isDeleted?: boolean;
}

export interface PolicyTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  isDeleted?: boolean;
}

export interface PolicyReinsurer {
  id: string;
  name: string;
  share: number;
  commission: number;
}

export interface ExchangeRate {
  id?: string;
  currency: Currency;
  rate: number;
  date: string;
  // Optional fields for CBU data
  nominal?: number;
  diff?: string;
  ccyNameEn?: string;
  rawRate?: number;
}

export interface ReinsuranceSlip {
  id: string;
  slipNumber: string;
  date: string;
  insuredName: string;
  brokerReinsurer: string;
  reinsurers?: PolicyReinsurer[];
  currency?: Currency | string;
  limitOfLiability?: number;
  status?: PolicyStatus; 
  isDeleted?: boolean;
}

export interface TerminationDetails {
  terminationDate: string;
  initiator: 'Broker' | 'Cedant' | 'Us' | 'Other';
  reason: string;
}

export interface EntityLog {
  id: string;
  entityId: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changes: string;
  timestamp: string;
}

export interface LegalEntity {
  id: string;
  fullName: string;
  shortName: string;
  type: 'Insured' | 'Reinsurer' | 'Broker' | 'Agent' | 'MGA' | 'Other';
  regCodeType: 'INN' | 'Company No' | 'Tax ID' | 'Other';
  regCodeValue: string;
  country: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  shareholders?: string;
  lineOfBusiness?: string;
  directorName?: string;
  bankName?: string;
  bankAccount?: string;
  bankMFO?: string;
  bankAddress?: string;
  sicCode?: string;
  sicSection?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- CLAIMS MODULE TYPES ---

export type ClaimLiabilityType = 'INFORMATIONAL' | 'ACTIVE';
export type ClaimStatus = 'OPEN' | 'CLOSED' | 'REOPENED' | 'RESERVED' | 'DENIED';
export type ClaimTransactionType = 'RESERVE_SET' | 'RESERVE_ADJUST' | 'PAYMENT' | 'LEGAL_FEE' | 'ADJUSTER_FEE' | 'RECOVERY' | 'IMPORT_BALANCE';

export interface ClaimTransaction {
    id: string;
    claimId: string;
    transactionType: ClaimTransactionType;
    transactionDate: string;
    amount100pct: number;
    currency: string;
    exchangeRate: number;
    ourSharePercentage: number;
    amountOurShare: number;
    payee?: string;
    notes?: string;
    createdBy?: string;
    createdAt?: string;
}

export interface Claim {
    id: string;
    policyId: string;
    claimNumber: string;
    liabilityType: ClaimLiabilityType;
    status: ClaimStatus;
    
    lossDate?: string;
    reportDate: string;
    closedDate?: string;
    
    description?: string;
    claimantName?: string;
    locationCountry?: string;
    
    // Type 1 Fields (Legacy/Import)
    importedTotalIncurred?: number;
    importedTotalPaid?: number;
    
    // Joined Fields (Strictly typed now)
    policyNumber: string;
    insuredName: string;
    policyCurrency?: string;
    policyContext?: Partial<Policy>; // For detail view context

    // Computed Fields (from RPC)
    totalIncurred100?: number;
    totalIncurredOurShare?: number;
    totalPaidOurShare?: number;
    outstandingOurShare?: number;
    
    transactions?: ClaimTransaction[];
}

export interface ClaimFilters {
    liabilityType: 'ALL' | ClaimLiabilityType;
    status: 'ALL' | ClaimStatus;
    searchTerm: string;
    page: number;
    pageSize: number;
}

// --- INWARD REINSURANCE TYPES ---

export type InwardReinsuranceOrigin = 'FOREIGN' | 'DOMESTIC';
export type InwardReinsuranceType = 'FAC' | 'TREATY';
export type InwardReinsuranceStructure = 'PROPORTIONAL' | 'NON_PROPORTIONAL';
export type InwardReinsuranceStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface InwardReinsurance {
  id: string;
  contractNumber: string;
  origin: InwardReinsuranceOrigin;
  type: InwardReinsuranceType;
  structure: InwardReinsuranceStructure;
  status: InwardReinsuranceStatus;

  // Cedant/Source Info
  cedantName: string;
  cedantEntityId?: string;
  cedantCountry?: string;
  brokerName?: string;
  brokerEntityId?: string;

  // Contract Period
  inceptionDate: string;
  expiryDate: string;
  uwYear?: number;

  // Coverage Details
  typeOfCover: string;
  classOfCover: string;
  industry?: string;
  territory?: string;
  originalInsuredName?: string;
  riskDescription?: string;

  // Financial Terms
  currency: Currency;
  limitOfLiability: number;
  deductible?: number;
  retention?: number;
  ourShare: number; // Percentage

  // Premium
  grossPremium: number;
  commissionPercent?: number;
  netPremium?: number;
  minimumPremium?: number;
  depositPremium?: number;
  adjustablePremium?: boolean;

  // Treaty-specific (for TREATY type)
  treatyName?: string;
  treatyNumber?: string;
  layerNumber?: number;
  excessPoint?: number;

  // Non-Proportional specific
  aggregateLimit?: number;
  aggregateDeductible?: number;
  reinstatements?: number;
  reinstatementPremium?: number;

  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  isDeleted?: boolean;
}

export interface InwardReinsurancePreset {
  id: string;
  category: 'TYPE_OF_COVER' | 'CLASS_OF_COVER' | 'INDUSTRY';
  value: string;
  description?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt: string;
}

// --- MGA / BINDING AUTHORITY TYPES ---

export interface BindingAgreement {
  id: string;
  agreementNumber: string;
  agreementType: 'BINDING_AUTHORITY' | 'LINESLIP' | 'TREATY';
  mgaName: string;
  mgaEntityId?: string;
  brokerName?: string;
  brokerEntityId?: string;
  underwriter?: string;
  status: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'CANCELLED';
  inceptionDate?: string;
  expiryDate?: string;
  currency: string;
  territoryScope?: string;
  classOfBusiness?: string;
  epi: number;
  ourShare: number;
  commissionPercent: number;
  maxLimitPerRisk?: number;
  aggregateLimit?: number;
  depositPremium: number;
  minimumPremium: number;
  claimsAuthorityLimit: number;
  riskParameters?: any;
  notes?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BordereauxEntry {
  id: string;
  agreementId: string;
  bordereauType: 'PREMIUM' | 'CLAIMS' | 'ADJUSTMENT';
  periodFrom?: string;
  periodTo?: string;
  submissionDate?: string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'ACCEPTED' | 'DISPUTED' | 'REJECTED';
  totalGwp: number;
  totalPolicies: number;
  totalClaimsPaid: number;
  totalClaimsReserved: number;
  fileName?: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  isDeleted?: boolean;
  createdAt?: string;
}

export interface Policy {
  id: string;
  channel: Channel;
  intermediaryType: IntermediaryType;
  intermediaryName?: string;
  policyNumber: string;
  secondaryPolicyNumber?: string;
  slipNumber?: string;
  agreementNumber?: string;
  bordereauNo?: string;
  invoiceIssued?: boolean;
  coverNote?: string;
  dateOfSlip?: string;
  accountingDate?: string;
  inceptionDate: string;
  expiryDate: string;
  issueDate: string;
  reinsuranceInceptionDate?: string;
  reinsuranceExpiryDate?: string;
  paymentDate?: string;
  warrantyPeriod?: number;
  activationDate?: string;
  insuredName: string;
  insuredAddress?: string;
  borrower?: string;
  cedantName?: string;
  retrocedent?: string;
  performer?: string;
  industry: string;
  territory: string;
  city?: string;
  jurisdiction: string;
  classOfInsurance: string;
  typeOfInsurance?: string;
  riskCode?: string;
  insuredRisk?: string;
  currency: Currency;
  sumInsured: number;
  sumInsuredNational?: number;
  limitForeignCurrency?: number;
  limitNationalCurrency?: number;
  excessForeignCurrency?: number;
  prioritySum?: number;
  premiumRate?: number;
  grossPremium: number;
  premiumNationalCurrency?: number;
  exchangeRate: number; 
  equivalentUSD?: number;
  ourShare: number;
  hasOutwardReinsurance?: boolean;
  reinsurers?: PolicyReinsurer[];
  reinsurerName?: string; 
  cededShare?: number;
  cededPremiumForeign?: number;
  reinsuranceCommission?: number;
  netReinsurancePremium?: number;
  sumReinsuredForeign?: number;
  sumReinsuredNational?: number;
  receivedPremiumForeign?: number;
  receivedPremiumNational?: number;
  numberOfSlips?: number;
  treatyPlacement?: string;
  treatyPremium?: number;
  aicCommission?: number;
  aicRetention?: number;
  aicPremium?: number;
  maxRetentionPerRisk?: number;
  reinsurerRating?: string;
  netPremium: number;
  commissionPercent: number;
  taxPercent?: number;
  deductible?: string;
  conditions?: string;
  status: PolicyStatus;
  paymentStatus: PaymentStatus;
  installments: Installment[];
  claims: ClaimDeprecated[];
  selectedClauseIds: string[];
  isDeleted?: boolean;
  signedDocument?: {
    fileName: string;
    uploadDate: string;
    url?: string; 
  };
  terminationDetails?: TerminationDetails;
  // Direct Insurance - Insured details
  insuredCountry?: string;
  insuredINN?: string;           // Uzbekistan Tax ID
  insuredLegalAddress?: string;  // Uzbekistan Legal Address
  insuredBankDetails?: string;   // Uzbekistan Bank Details

  // Additional Excel Portfolio Fields
  accountingCode?: string;        // 1C Code
  referenceLink?: string;         // Reference Link to slip document
  exchangeRateUSD?: number;       // Exchange Rate in USD (cross-rate)
  insuranceDays?: number;         // Insurance Period - Number of Days
  reinsuranceDays?: number;       // Reinsurance Period - Number of Days
  reinsuranceType?: string;       // '%' (Proportional) or 'XL' (Non-Proportional)
  fullPremiumForeign?: number;    // Premium in FC 100% (before MIG share)
  fullPremiumNational?: number;   // Premium in NC 100%
  grossPremiumNational?: number;  // Gross Reins Premium NC
  commissionNational?: number;    // Commission amount in national currency
  netPremiumNational?: number;    // Net Reins Premium NC
  premiumPaymentDate?: string;    // Scheduled payment date
  receivedPremiumCurrency?: string; // Currency of received premium
  receivedPremiumExchangeRate?: number; // Exchange rate at time of receipt
  actualPaymentDate?: string;     // When payment was actually received
  risksCount?: number;            // Number of individual risks
  retroSumReinsured?: number;     // Retrocession sum reinsured
  retroPremium?: number;          // Retrocession premium
}

// =============================================
// PORTFOLIO UNIFIED VIEW TYPES
// =============================================

export type PortfolioSource = 'direct' | 'inward-foreign' | 'inward-domestic';

export type PortfolioStatus = 'Active' | 'Expired' | 'Pending' | 'Cancelled' | 'Deleted';

export interface PortfolioRow {
  // Common identifiers
  id: string;
  source: PortfolioSource;
  referenceNumber: string; // policyNumber, contractNumber, or slipNumber
  secondaryRef?: string;   // secondaryPolicyNumber
  slipNumber?: string;
  agreementNumber?: string;
  bordereauNo?: string;
  accountingCode?: string; // 1C Code
  referenceLink?: string;  // Link to slip document

  // Parties
  insuredName: string;
  insuredAddress?: string;
  cedantName?: string;
  brokerName?: string;
  borrower?: string;
  retrocedent?: string;
  performer?: string;

  // Classification
  classOfBusiness: string;
  typeOfInsurance?: string;
  riskCode?: string;
  insuredRisk?: string;
  industry?: string;
  territory?: string;
  city?: string;

  // Financial - Amounts
  currency: Currency | string;
  exchangeRate?: number;
  exchangeRateUSD?: number;
  equivalentUSD?: number;
  sumInsured?: number;
  sumInsuredNational?: number;
  limit?: number;
  limitNational?: number;
  excess?: number;
  prioritySum?: number;
  grossPremium: number;
  grossPremiumNational?: number;
  premiumNational?: number;
  netPremium?: number;
  netPremiumNational?: number;
  fullPremiumForeign?: number;
  fullPremiumNational?: number;
  ourShare: number;

  // Premium rates and percentages
  premiumRate?: number;
  commissionPercent?: number;
  commissionNational?: number;
  taxPercent?: number;

  // Reinsurance details
  reinsuranceType?: string;
  sumReinsuredForeign?: number;
  sumReinsuredNational?: number;
  hasOutwardReinsurance?: boolean;
  reinsurerName?: string;
  cededShare?: number;
  cededPremium?: number;
  reinsuranceCommission?: number;
  netReinsurancePremium?: number;

  // Treaty & AIC
  treatyPlacement?: string;
  treatyPremium?: number;
  aicCommission?: number;
  aicRetention?: number;
  aicPremium?: number;

  // Retrocession
  risksCount?: number;
  retroSumReinsured?: number;
  retroPremium?: number;

  // Dates
  inceptionDate: string;
  expiryDate: string;
  insuranceDays?: number;
  reinsuranceInceptionDate?: string;
  reinsuranceExpiryDate?: string;
  reinsuranceDays?: number;
  dateOfSlip?: string;
  accountingDate?: string;
  warrantyPeriod?: number;

  // Payment tracking
  premiumPaymentDate?: string;
  actualPaymentDate?: string;
  receivedPremiumForeign?: number;
  receivedPremiumCurrency?: string;
  receivedPremiumExchangeRate?: number;
  receivedPremiumNational?: number;
  numberOfSlips?: number;

  // Status
  status: string;
  normalizedStatus: PortfolioStatus;
  isDeleted?: boolean;

  // Type info (for Inward Reinsurance)
  contractType?: 'FAC' | 'TREATY';
  structure?: 'PROPORTIONAL' | 'NON_PROPORTIONAL';

  // Original data reference for detail view
  originalData: Policy | InwardReinsurance | ReinsuranceSlip;

  // Consolidation metadata
  installmentCount?: number;
  installments?: any[];
}
