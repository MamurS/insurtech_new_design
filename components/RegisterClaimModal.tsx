
import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertTriangle, CheckCircle, Search, ChevronDown, Info } from 'lucide-react';
import { useCreateClaim, usePoliciesDropdown } from '../hooks/useClaims';
import { determineLiability } from '../services/claimsService';
import { ClaimLiabilityType } from '../types';
import { formatDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { DatePickerInput, parseDate, toISODateString } from './DatePickerInput';
import { EntitySearchInput } from './EntitySearchInput';
import { formatSICDisplay } from '../data/sicCodes';
import { ContextBar } from './ContextBar';
import { useTheme } from '../theme/useTheme';

interface RegisterClaimModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const generateClaimNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `CLM-${year}-${random}`;
};

const RegisterClaimModal: React.FC<RegisterClaimModalProps> = ({ isOpen, onClose }) => {
    // Fetch policies for dropdown
    const { data: policies, isLoading: policiesLoading } = usePoliciesDropdown();
    const createClaimMutation = useCreateClaim();
    const toast = useToast();
    const { t } = useTheme();

    // Form state
    const [selectedPolicyId, setSelectedPolicyId] = useState('');
    const [claimNumber, setClaimNumber] = useState(generateClaimNumber());

    // Date States (as Date objects)
    const [lossDate, setLossDate] = useState<Date | null>(null);
    const [reportDate, setReportDate] = useState<Date | null>(new Date());

    const [description, setDescription] = useState('');
    const [causeOfLoss, setCauseOfLoss] = useState('');
    const [claimantName, setClaimantName] = useState('');
    const [locationCountry, setLocationCountry] = useState('');
    const [initialReserve, setInitialReserve] = useState<number | ''>('');

    // Searchable Dropdown State
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Calculated liability
    const [liabilityType, setLiabilityType] = useState<ClaimLiabilityType | null>(null);
    const [liabilityReason, setLiabilityReason] = useState('');

    // Get selected policy details
    const selectedPolicy = policies?.find(p => p.id === selectedPolicyId);

    // Filter policies for dropdown
    const filteredPolicies = policies?.filter(policy => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            policy.policyNumber.toLowerCase().includes(term) ||
            policy.insuredName.toLowerCase().includes(term)
        );
    }) || [];

    // Auto-calculate liability when policy and loss date change
    useEffect(() => {
        const lossDateStr = toISODateString(lossDate);
        const reportDateStr = toISODateString(reportDate);

        if (selectedPolicy && lossDateStr && reportDateStr) {
            const result = determineLiability(
                {
                    inceptionDate: selectedPolicy.inceptionDate,
                    expiryDate: selectedPolicy.expiryDate
                } as any,
                lossDateStr,
                reportDateStr
            );
            setLiabilityType(result.type);
            setLiabilityReason(result.reason);
        } else {
            setLiabilityType(null);
            setLiabilityReason('');
        }
    }, [selectedPolicyId, lossDate, reportDate, selectedPolicy]);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedPolicyId('');
            setSearchTerm('');
            setIsDropdownOpen(false);
            setClaimNumber(generateClaimNumber());
            setLossDate(null);
            setReportDate(new Date());
            setDescription('');
            setCauseOfLoss('');
            setClaimantName('');
            setLocationCountry('');
            setInitialReserve('');
            setLiabilityType(null);
            setLiabilityReason('');
        }
    }, [isOpen]);

    const handleSelectPolicy = (policy: any) => {
        setSelectedPolicyId(policy.id);
        setSearchTerm(`${policy.policyNumber} - ${policy.insuredName}`);
        setIsDropdownOpen(false);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        if (selectedPolicyId) {
            setSelectedPolicyId(''); // Clear selection if user types
            setLiabilityType(null);
        }
        setIsDropdownOpen(true);
    };

    const handleSubmit = async () => {
        const lossDateStr = toISODateString(lossDate);
        const reportDateStr = toISODateString(reportDate);

        if (!selectedPolicyId || !lossDateStr || !reportDateStr || !description || !liabilityType || !claimNumber) {
            toast.error('Please fill in all required fields (Policy, Claim No, Loss Date, Report Date, Description).');
            return;
        }

        createClaimMutation.mutate({
            policyId: selectedPolicyId,
            claimNumber,
            lossDate: lossDateStr,
            reportDate: reportDateStr,
            description,
            claimantName,
            locationCountry,
            liabilityType,
            status: 'OPEN',
            initialReserve: liabilityType === 'ACTIVE' && initialReserve ? Number(initialReserve) : undefined,
            currency: selectedPolicy?.currency,
            ourSharePercentage: selectedPolicy?.ourShare
        }, {
            onSuccess: () => {
                onClose();
            },
            onError: (error) => {
                toast.error('Error creating claim: ' + error.message);
            }
        });
    };

    // Determine if the form is valid for enabling the button
    const isFormValid = !!selectedPolicyId && !!claimNumber && !!lossDate && !!reportDate && !!description && !!liabilityType;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200" style={{ background: t.bgPanel, boxShadow: t.shadowLg }}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 sticky top-0 z-20" style={{ borderBottom: '1px solid ' + t.border, background: t.bgPanel }}>
                    <h2 className="text-xl font-bold" style={{ color: t.text1 }}>Register New Claim</h2>
                    <button onClick={onClose} className="p-2 rounded-lg" style={{ color: t.text4 }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Context Bar */}
                <ContextBar
                    status="NEW"
                    breadcrumbs={[
                        { label: 'Claims Center' },
                        { label: 'Register New Claim' }
                    ]}
                />

                {/* Form */}
                <div className="p-6 space-y-6">
                    {/* Policy Selection (Searchable Dropdown) */}
                    <div>
                        <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>
                            Policy <span style={{ color: t.danger }}>*</span>
                        </label>
                        {policiesLoading ? (
                            <div className="flex items-center gap-2 text-sm" style={{ color: t.text4 }}>
                                <Loader2 size={16} className="animate-spin" /> Loading policies...
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Click outside overlay */}
                                {isDropdownOpen && (
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setIsDropdownOpen(false)}
                                    />
                                )}

                                <div className="relative z-20">
                                    <input
                                        type="text"
                                        className="w-full p-2.5 pr-8 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        style={{
                                            background: t.bgPanel,
                                            borderWidth: '1px',
                                            borderStyle: 'solid',
                                            borderColor: !selectedPolicyId && searchTerm ? t.warning : t.border,
                                            ...((!selectedPolicyId && searchTerm) ? { boxShadow: '0 0 0 1px ' + t.warning + '60' } : {})
                                        }}
                                        placeholder="Type to search by policy number or insured name..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        onFocus={() => setIsDropdownOpen(true)}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: t.text4 }}>
                                        {isDropdownOpen ? <Search size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {/* Dropdown List */}
                                {isDropdownOpen && (
                                    <div className="absolute z-30 w-full mt-1 rounded-lg max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100" style={{ background: t.bgPanel, border: '1px solid ' + t.border, boxShadow: t.shadowLg }}>
                                        {filteredPolicies.length === 0 ? (
                                            <div className="p-3 text-sm text-center" style={{ color: t.text4 }}>No policies found matching "{searchTerm}"</div>
                                        ) : (
                                            filteredPolicies.map(policy => (
                                                <div
                                                    key={policy.id}
                                                    className="p-3 cursor-pointer last:border-0 transition-colors"
                                                    style={{ borderBottom: '1px solid ' + t.border }}
                                                    onClick={() => handleSelectPolicy(policy)}
                                                >
                                                    <div className="font-medium text-sm flex justify-between" style={{ color: t.text1 }}>
                                                        <span>{policy.policyNumber}</span>
                                                        <span className="font-normal text-xs" style={{ color: t.text4 }}>{policy.currency}</span>
                                                    </div>
                                                    <div className="text-xs" style={{ color: t.text4 }}>{policy.insuredName}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Selected Policy Details Display */}
                        {selectedPolicy ? (
                            <div className="mt-2 text-xs p-2 rounded flex flex-wrap gap-x-4 gap-y-1" style={{ color: t.text4, background: t.bgCard, border: '1px solid ' + t.border }}>
                                <span><span className="font-bold">Period:</span> {formatDate(selectedPolicy.inceptionDate)} to {formatDate(selectedPolicy.expiryDate)}</span>
                                <span><span className="font-bold">Currency:</span> {selectedPolicy.currency}</span>
                                <span><span className="font-bold">Our Share:</span> {selectedPolicy.ourShare}%</span>
                            </div>
                        ) : searchTerm && !isDropdownOpen && (
                            <div className="mt-1 text-xs flex items-center gap-1" style={{ color: t.warning }}>
                                <AlertTriangle size={12}/> Policy not selected. Please select from the dropdown.
                            </div>
                        )}
                    </div>

                    {/* Claim Number */}
                    <div>
                        <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>
                            Claim Number <span style={{ color: t.danger }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                            style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: t.border }}
                            value={claimNumber}
                            onChange={(e) => setClaimNumber(e.target.value)}
                        />
                    </div>

                    {/* Dates Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <DatePickerInput
                            label="Loss Date"
                            required
                            value={lossDate}
                            onChange={setLossDate}
                            placeholder="Date of loss"
                        />
                        <DatePickerInput
                            label="Report Date"
                            required
                            value={reportDate}
                            onChange={setReportDate}
                            placeholder="Date reported"
                        />
                    </div>

                    {/* Liability Type Display */}
                    {liabilityType ? (
                        <div className="p-4 rounded-lg flex items-start gap-3" style={
                            liabilityType === 'ACTIVE'
                                ? { background: t.accent + '18', border: '1px solid ' + t.accent + '40' }
                                : { background: t.warningBg, border: '1px solid ' + t.warning + '40' }
                        }>
                            {liabilityType === 'ACTIVE' ? (
                                <CheckCircle className="flex-shrink-0" size={20} style={{ color: t.accent }} />
                            ) : (
                                <AlertTriangle className="flex-shrink-0" size={20} style={{ color: t.warning }} />
                            )}
                            <div>
                                <div className="font-bold text-sm" style={{ color: liabilityType === 'ACTIVE' ? t.accent : t.warning }}>
                                    {liabilityType === 'ACTIVE' ? 'Active Liability' : 'Informational Only'}
                                </div>
                                <div className="text-xs" style={{ color: liabilityType === 'ACTIVE' ? t.accent : t.warning }}>{liabilityReason}</div>
                            </div>
                        </div>
                    ) : selectedPolicyId && lossDate ? (
                        <div className="p-3 rounded text-xs italic flex items-center gap-2" style={{ background: t.bgCard, color: t.text4 }}>
                            <Loader2 size={12} className="animate-spin"/> Calculating liability...
                        </div>
                    ) : null}

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>
                            Description <span style={{ color: t.danger }}>*</span>
                        </label>
                        <textarea
                            className="w-full p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: t.border }}
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the loss event..."
                        />
                    </div>

                    {/* Cause of Loss */}
                    <div>
                        <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>Cause of Loss</label>
                        <select
                            className="w-full p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            style={{ background: t.bgPanel, borderWidth: '1px', borderStyle: 'solid', borderColor: t.border }}
                            value={causeOfLoss}
                            onChange={(e) => setCauseOfLoss(e.target.value)}
                        >
                            <option value="">Select cause...</option>
                            <option value="Fire">Fire</option>
                            <option value="Water Damage">Water Damage</option>
                            <option value="Theft">Theft</option>
                            <option value="Collision">Collision</option>
                            <option value="Natural Disaster">Natural Disaster</option>
                            <option value="Machinery Breakdown">Machinery Breakdown</option>
                            <option value="Liability">Liability</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    {/* Claimant and Location Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <EntitySearchInput
                                label="Claimant Name"
                                value={claimantName}
                                onChange={(name) => setClaimantName(name)}
                                onEntitySelect={(entity) => {
                                  setClaimantName(entity.fullName);
                                  if (entity.country) setLocationCountry(entity.country);
                                }}
                                placeholder="If different from insured (search legal entities)"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>Location / Country</label>
                            <input
                                type="text"
                                className="w-full p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: t.border }}
                                value={locationCountry}
                                onChange={(e) => setLocationCountry(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Initial Reserve - Only for ACTIVE claims */}
                    {liabilityType === 'ACTIVE' && (
                        <div className="p-4 rounded-lg" style={{ background: t.bgCard, border: '1px solid ' + t.border }}>
                            <label className="block text-sm font-bold mb-1" style={{ color: t.text2 }}>
                                Initial Reserve (100% Gross)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    className="w-full p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                    style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: t.border }}
                                    value={initialReserve}
                                    onChange={(e) => setInitialReserve(e.target.value ? Number(e.target.value) : '')}
                                    placeholder="0.00"
                                />
                                {selectedPolicy && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: t.text4 }}>
                                        {selectedPolicy.currency}
                                    </div>
                                )}
                            </div>
                            {initialReserve && selectedPolicy && (
                                <div className="mt-2 text-xs font-medium" style={{ color: t.accent }}>
                                    Net Reserve (Our share {selectedPolicy.ourShare}%): {(Number(initialReserve) * selectedPolicy.ourShare / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} {selectedPolicy.currency}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6" style={{ borderTop: '1px solid ' + t.border, background: t.bgCard }}>
                    <div className="text-xs flex items-center gap-1" style={{ color: t.text4 }}>
                        {!isFormValid && <><Info size={14}/> Complete marked fields to enable registration.</>}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            style={{ color: t.text3 }}
                            disabled={createClaimMutation.isPending}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={createClaimMutation.isPending || !isFormValid}
                            className="px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                            style={
                                isFormValid
                                    ? { background: t.danger, color: '#fff', boxShadow: t.shadow }
                                    : { background: t.bgHover, color: t.text4, cursor: 'not-allowed' }
                            }
                        >
                            {createClaimMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                            Register Claim
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RegisterClaimModal;
