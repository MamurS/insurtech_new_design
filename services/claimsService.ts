
import { Claim, ClaimLiabilityType, ClaimTransaction, Policy, ClaimFilters } from '../types';
import { supabase } from './supabase';

interface ClaimsResponse {
    data: Claim[];
    count: number | null;
}

// --- LIABILITY LOGIC (Pure Function) ---
export const determineLiability = (
    policy: Policy,
    lossDate: string,
    reportDate: string,
    coverageBasis: 'occurrence' | 'claims_made' = 'occurrence',
    retroactiveDate?: string
): { type: ClaimLiabilityType; reason: string } => {

    const inception = new Date(policy.inceptionDate).getTime();
    const expiry = new Date(policy.expiryDate).getTime();
    const loss = new Date(lossDate).getTime();
    const report = new Date(reportDate).getTime();

    if (isNaN(loss)) return { type: 'INFORMATIONAL', reason: 'Invalid Loss Date' };

    if (coverageBasis === 'occurrence') {
        if (loss >= inception && loss <= expiry) {
            return { type: 'ACTIVE', reason: 'Loss occurred within policy period' };
        }
        return { type: 'INFORMATIONAL', reason: `Loss date outside period (${policy.inceptionDate} to ${policy.expiryDate})` };
    }

    if (coverageBasis === 'claims_made') {
        if (report < inception || report > expiry) {
            return { type: 'INFORMATIONAL', reason: 'Reported outside policy period' };
        }
        if (retroactiveDate) {
            const retro = new Date(retroactiveDate).getTime();
            if (loss < retro) {
                return { type: 'INFORMATIONAL', reason: 'Loss occurred before retroactive date' };
            }
        }
        return { type: 'ACTIVE', reason: 'Claims-made criteria met' };
    }

    return { type: 'INFORMATIONAL', reason: 'Default fallback' };
};

// --- DATA ACCESS ---

export const ClaimsService = {
    // Get all claims with filtering and pagination
    getAllClaims: async (filters: ClaimFilters): Promise<ClaimsResponse> => {
        if (!supabase) return { data: [], count: 0 };

        try {
            // 1. Fetch RAW data from RPC without filters
            const { data: rawData, error } = await supabase.rpc('get_claims_with_totals');
            
            if (error) {
                console.error("RPC Error:", error);
                throw error;
            }

            if (!rawData) {
                return { data: [], count: 0 };
            }

            console.log("RPC Raw Response:", rawData);

            // 2. Filter Client-Side
            let filtered = [...rawData];

            if (filters.liabilityType !== 'ALL') {
                filtered = filtered.filter((row: any) => row.liability_type === filters.liabilityType);
            }

            if (filters.status !== 'ALL') {
                filtered = filtered.filter((row: any) => row.status === filters.status);
            }

            if (filters.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                filtered = filtered.filter((row: any) => 
                    (row.claim_number && row.claim_number.toLowerCase().includes(term)) ||
                    (row.policy_number && row.policy_number.toLowerCase().includes(term)) ||
                    (row.insured_name && row.insured_name.toLowerCase().includes(term)) ||
                    (row.claimant_name && row.claimant_name.toLowerCase().includes(term))
                );
            }

            const totalCount = filtered.length;

            // 3. Sort (Default: Report Date Descending)
            filtered.sort((a: any, b: any) => 
                new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
            );

            // 4. Paginate Client-Side
            const from = (filters.page - 1) * filters.pageSize;
            const to = from + filters.pageSize;
            const paginated = filtered.slice(from, to);

            // 5. Map & Parse Numerics (Supabase returns NUMERIC as string)
            const mappedData: Claim[] = paginated.map((row: any) => ({
                id: row.id,
                policyId: row.policy_id,
                claimNumber: row.claim_number,
                liabilityType: row.liability_type,
                status: row.status,
                lossDate: row.loss_date,
                reportDate: row.report_date,
                description: row.description,
                claimantName: row.claimant_name,
                locationCountry: row.location_country,
                
                // RPC Fields
                policyNumber: row.policy_number || 'Unknown',
                insuredName: row.insured_name || 'Unknown',
                
                // Explicit parseFloat for strings coming from Postgres NUMERIC
                totalIncurred100: parseFloat(row.total_incurred_100) || 0,
                totalIncurredOurShare: parseFloat(row.total_incurred_our_share) || 0,
                totalPaidOurShare: parseFloat(row.total_paid_our_share) || 0,
                outstandingOurShare: parseFloat(row.outstanding_our_share) || 0,
            }));

            return { data: mappedData, count: totalCount };

        } catch (err) {
            console.error("getAllClaims critical error:", err);
            return { data: [], count: 0 };
        }
    },

    // Get Policies for Dropdown (Lightweight)
    getPoliciesForDropdown: async (): Promise<Array<{id: string, policyNumber: string, insuredName: string, inceptionDate: string, expiryDate: string, currency: string, ourShare: number}>> => {
        if (!supabase) return [];
        
        const { data, error } = await supabase
            .from('policies')
            .select('id, policyNumber, insuredName, inceptionDate, expiryDate, currency, ourShare')
            .or('isDeleted.is.null,isDeleted.eq.false')
            .order('policyNumber', { ascending: false });
        
        if (error) {
            console.error("Error fetching policies for dropdown", error);
            return [];
        }
        
        return data || [];
    },

    // Get Single Claim with Transactions
    getClaimById: async (id: string): Promise<Claim | null> => {
        if (!supabase) return null;
        
        const { data, error } = await supabase
            .from('claims')
            .select(`
                *,
                transactions:claim_transactions(*),
                policy:policies(*)
            `)
            .eq('id', id)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            policyId: data.policy_id,
            claimNumber: data.claim_number,
            liabilityType: data.liability_type,
            status: data.status,
            lossDate: data.loss_date,
            reportDate: data.report_date,
            description: data.description,
            claimantName: data.claimant_name,
            location_country: data.location_country,
            importedTotalIncurred: data.imported_total_incurred,
            importedTotalPaid: data.imported_total_paid,
            
            // Explicitly map joined fields
            policyNumber: data.policy?.policyNumber || 'Unknown',
            insuredName: data.policy?.insuredName || 'Unknown',
            
            // Attach full policy object for context
            policyContext: data.policy ? {
                policyNumber: data.policy.policyNumber,
                currency: data.policy.currency,
                insuredName: data.policy.insuredName,
                ourShare: data.policy.ourShare
            } : undefined,
            
            transactions: data.transactions?.map((t: any) => ({
                id: t.id,
                transactionType: t.transaction_type,
                transactionDate: t.transaction_date,
                amount100pct: t.amount_100pct,
                amountOurShare: t.amount_our_share,
                currency: t.currency,
                exchangeRate: t.exchange_rate,
                ourSharePercentage: t.our_share_percentage,
                notes: t.notes,
                payee: t.payee
            })).sort((a: any, b: any) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
        } as Claim;
    },

    createClaim: async (claim: Partial<Claim> & { initialReserve?: number; currency?: string; ourSharePercentage?: number }): Promise<string | null> => {
        if (!supabase) {
            throw new Error("Database connection required for Claims Module");
        }

        const payload = {
            policy_id: claim.policyId,
            claim_number: claim.claimNumber,
            liability_type: claim.liabilityType,
            status: 'OPEN',
            loss_date: claim.lossDate,
            report_date: claim.reportDate,
            description: claim.description,
            claimant_name: claim.claimantName,
            location_country: claim.locationCountry,
            imported_total_incurred: claim.importedTotalIncurred || 0,
            imported_total_paid: claim.importedTotalPaid || 0
        };

        const { data, error } = await supabase
            .from('claims')
            .insert(payload)
            .select('id')
            .single();

        if (error) throw error;
        
        const claimId = data.id;

        // If initial reserve provided and claim is ACTIVE, create RESERVE_SET transaction
        if (claim.initialReserve && claim.liabilityType === 'ACTIVE' && claimId) {
            const sharePercent = claim.ourSharePercentage || 100;
            const amountOurShare = claim.initialReserve * (sharePercent / 100);
            
            await supabase.from('claim_transactions').insert({
                claim_id: claimId,
                transaction_type: 'RESERVE_SET',
                amount_100pct: claim.initialReserve,
                our_share_percentage: sharePercent,
                amount_our_share: amountOurShare,
                transaction_date: new Date().toISOString(),
                currency: claim.currency || 'USD',
                notes: 'Initial reserve set at claim registration'
            });
        }

        return claimId;
    },

    addTransaction: async (txn: Partial<ClaimTransaction>) => {
        if (!supabase) return;
        
        // Calculate amountOurShare securely
        const amount100pct = txn.amount100pct || 0;
        const share = txn.ourSharePercentage || 100;
        const amountOurShare = amount100pct * (share / 100);

        const { error } = await supabase.from('claim_transactions').insert({
            claim_id: txn.claimId,
            transaction_type: txn.transactionType,
            amount_100pct: amount100pct,
            our_share_percentage: share,
            amount_our_share: amountOurShare, // Explicitly inserting calculated value
            transaction_date: txn.transactionDate || new Date().toISOString(),
            currency: txn.currency,
            notes: txn.notes,
            payee: txn.payee
        });

        if (error) throw error;
    }
};
