
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { DB } from '../services/db';
import { Policy, Clause, ReinsuranceSlip, PolicyTemplate } from '../types';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { Printer, ArrowLeft, Settings2, FileText } from 'lucide-react';
import { useTheme } from '../theme/useTheme';

const DEFAULT_TEMPLATE: PolicyTemplate = {
  id: 'default_sys',
  name: 'System Default Template',
  description: 'Fallback template',
  content: `
    <div style="font-family: serif; color: #1a202c;">
        <h1 style="text-align: center; text-transform: uppercase; font-size: 24px; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px;">Policy Schedule</h1>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="font-weight: bold; padding: 12px 0; width: 30%; color: #4a5568;">Policy Number</td>
                <td style="padding: 12px 0; font-family: monospace; font-size: 16px;">{{policyNumber}}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="font-weight: bold; padding: 12px 0; color: #4a5568;">Insured Name</td>
                <td style="padding: 12px 0; font-weight: bold;">{{insuredName}}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="font-weight: bold; padding: 12px 0; color: #4a5568;">Address</td>
                <td style="padding: 12px 0;">{{insuredAddress}}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="font-weight: bold; padding: 12px 0; color: #4a5568;">Period of Insurance</td>
                <td style="padding: 12px 0;">From {{inceptionDate}} to {{expiryDate}}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="font-weight: bold; padding: 12px 0; color: #4a5568;">Business / Interest</td>
                <td style="padding: 12px 0;">{{industry}}</td>
            </tr>
        </table>

        <div style="background-color: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 16px; text-transform: uppercase; color: #2d3748;">Coverage Details</h3>
            <p style="margin: 5px 0;"><strong>Class of Insurance:</strong> {{classOfInsurance}}</p>
            <p style="margin: 5px 0;"><strong>Territory:</strong> {{territory}}</p>
            <p style="margin: 5px 0;"><strong>Sum Insured:</strong> {{sumInsured}}</p>
             <p style="margin: 5px 0;"><strong>Deductible:</strong> {{deductible}}</p>
        </div>

        <div style="margin-bottom: 40px;">
             <table style="width: 100%; border-collapse: collapse;">
                <tr style="background-color: #ebf8ff;">
                    <td style="padding: 15px; font-weight: bold; color: #2c5282;">Total Gross Premium</td>
                    <td style="padding: 15px; font-weight: bold; text-align: right; color: #2c5282;">{{grossPremium}}</td>
                </tr>
            </table>
        </div>

        <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #cbd5e0;">
            <p style="margin-bottom: 40px;">Signed for and on behalf of <strong>Policy Manager</strong></p>
            <div style="width: 200px; border-bottom: 1px solid #000; margin-bottom: 10px;"></div>
            <p style="font-size: 12px; color: #718096;">Authorized Signatory<br/>Date: {{issueDate}}</p>
        </div>
    </div>
  `
};

const PolicyWording: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTheme();
  const [item, setItem] = useState<Policy | ReinsuranceSlip | null>(null);
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [attachedClauses, setAttachedClauses] = useState<Clause[]>([]);

  useEffect(() => {
    const load = async () => {
      if (id) {
        // 1. Fetch Item
        const p = await DB.getPolicy(id);
        if (p) {
          setItem(p);
          // If policy, fetch templates and clauses
          const t = await DB.getTemplates();

          if (t.length === 0) {
              setTemplates([DEFAULT_TEMPLATE]);
              setSelectedTemplateId(DEFAULT_TEMPLATE.id);
          } else {
              setTemplates(t);
              setSelectedTemplateId(t[0].id);
          }

          if (p.selectedClauseIds && p.selectedClauseIds.length > 0) {
              const allClauses = await DB.getClauses();
              const filtered = allClauses.filter(c => p.selectedClauseIds.includes(c.id));
              setAttachedClauses(filtered);
          }

        } else {
          // If not policy, try slips
          const s = await DB.getSlip(id);
          if (s) {
            setItem(s);
          }
        }
      }
    };
    load();
  }, [id]);

  const printDocument = () => window.print();

  if (!item) return <div className="p-8 text-center" style={{ color: t.text3 }}>Loading document...</div>;

  const formatMoney = (val: number | undefined, currency: string) => {
      if (val === undefined || val === null) return '-';
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(val);
  }

  // Type Guards
  const isPolicy = (i: any): i is Policy => 'channel' in i;

  // --- RENDERERS ---

  // 1. Dynamic Policy Renderer based on Template
  const renderDynamicPolicy = (policy: Policy) => {
    const template = templates.find(t => t.id === selectedTemplateId);

    if (!template) return <div className="p-8" style={{ color: t.danger }}>Please select a template to generate the wording.</div>;

    // Helper to replace placeholders
    let content = template.content;
    const replacements: Record<string, string> = {
        '{{policyNumber}}': policy.policyNumber,
        '{{insuredName}}': policy.insuredName,
        '{{insuredAddress}}': policy.insuredAddress || '',
        '{{inceptionDate}}': formatDate(policy.inceptionDate),
        '{{expiryDate}}': formatDate(policy.expiryDate),
        '{{industry}}': policy.industry,
        '{{classOfInsurance}}': policy.classOfInsurance,
        '{{territory}}': policy.territory,
        '{{sumInsured}}': formatMoney(policy.sumInsured, policy.currency),
        '{{grossPremium}}': formatMoney(policy.grossPremium, policy.currency),
        '{{currency}}': policy.currency,
        '{{deductible}}': policy.deductible || 'N/A',
        '{{issueDate}}': formatDate(policy.issueDate)
    };

    // Replace all known placeholders
    Object.keys(replacements).forEach(key => {
        content = content.replace(new RegExp(key, 'g'), replacements[key]);
    });

    return (
        <div className="max-w-[210mm] mx-auto p-[20mm] min-h-[297mm] print:shadow-none print:w-full relative overflow-hidden" style={{ background: t.bgPanel, boxShadow: t.shadow }}>
             {/* Header */}
            <div className="pb-4 mb-8 flex justify-between items-start relative z-10" style={{ borderBottom: `2px solid ${t.text1}` }}>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: t.text1 }}>
                        <FileText className="w-6 h-6" style={{ color: '#fff' }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-serif font-bold" style={{ color: t.text1 }}>Policy Manager</h1>
                        <p className="text-sm uppercase tracking-widest" style={{ color: t.text4 }}>{template.name}</p>
                    </div>
                </div>
            </div>

            {/* Dynamic Content */}
            <div
              className="policy-content relative z-10"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(content, {
                  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                                 'div', 'span', 'a', 'img'],
                  ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style', 'target'],
                  ALLOW_DATA_ATTR: false
                })
              }}
            />

            {/* Attached Clauses */}
            {attachedClauses.length > 0 && (
                <div className="mt-12 pt-8 break-before-page" style={{ borderTop: `2px solid ${t.border}` }}>
                    <h3 className="font-bold text-lg uppercase mb-6 text-center">Attached Clauses & Warranties</h3>
                    {attachedClauses.map((clause, idx) => (
                        <div key={clause.id} className="mb-6">
                            <h4 className="font-bold text-sm mb-2">{idx + 1}. {clause.title}</h4>
                            <p className="text-sm text-justify leading-relaxed whitespace-pre-wrap font-serif" style={{ color: t.text1 }}>{clause.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
  };

  const renderReinsuranceSlip = (policy: Policy) => (
    <div className="max-w-[210mm] mx-auto p-[20mm] min-h-[297mm] print:shadow-none print:w-full font-serif relative" style={{ background: t.bgPanel, boxShadow: t.shadow }}>
        <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: t.text1 }}>
                <FileText className="w-6 h-6" style={{ color: '#fff' }} />
            </div>
        </div>

        <div className="text-center mb-8 pb-4" style={{ borderBottom: `4px double ${t.text1}` }}>
            <h1 className="text-2xl font-bold uppercase tracking-widest">Reinsurance Slip</h1>
            <p className="text-sm uppercase mt-1" style={{ color: t.text2 }}>{policy.channel}</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 text-sm relative z-10">
            <div className="font-bold text-right" style={{ color: t.text2 }}>TYPE:</div>
            <div className="col-span-3 font-bold">{policy.classOfInsurance}</div>

            <div className="font-bold text-right" style={{ color: t.text2 }}>REINSURED:</div>
            <div className="col-span-3">{policy.channel === 'Inward' ? policy.cedantName : 'Policy Manager'}</div>

            <div className="font-bold text-right" style={{ color: t.text2 }}>ORIGINAL INSURED:</div>
            <div className="col-span-3">{policy.insuredName}</div>

            <div className="font-bold text-right" style={{ color: t.text2 }}>PERIOD:</div>
            <div className="col-span-3">{formatDate(policy.inceptionDate)} to {formatDate(policy.expiryDate)} (Both days inclusive)</div>

            <div className="font-bold text-right" style={{ color: t.text2 }}>INTEREST:</div>
            <div className="col-span-3 text-justify">{policy.classOfInsurance} - {policy.industry}. Situated at {policy.territory}.</div>

            <div className="font-bold text-right" style={{ color: t.text2 }}>SUM INSURED:</div>
            <div className="col-span-3 font-mono">{formatMoney(policy.sumInsured, policy.currency)} (100%)</div>

            <div className="font-bold text-right" style={{ color: t.text2 }}>CONDITIONS:</div>
            <div className="col-span-3">Subject to original policy terms and conditions. {policy.deductible ? `Deductible: ${policy.deductible}` : ''}</div>

            <div className="font-bold text-right" style={{ color: t.text2 }}>PREMIUM:</div>
            <div className="col-span-3 font-mono">{formatMoney(policy.grossPremium, policy.currency)} (100%)</div>

            <div className="font-bold text-right" style={{ color: t.text2 }}>DEDUCTIONS:</div>
            <div className="col-span-3">Commission: {policy.commissionPercent}%</div>

            <div className="font-bold text-right" style={{ color: t.text2 }}>NET DUE:</div>
            <div className="col-span-3 font-bold font-mono pt-1 inline-block" style={{ borderTop: `1px solid ${t.text5}` }}>{formatMoney(policy.netPremium, policy.currency)}</div>
        </div>

        <div className="mt-12 pt-4 relative z-10" style={{ borderTop: `1px solid ${t.border}` }}>
            <h3 className="font-bold text-sm mb-4">SECURITY / MARKET:</h3>
            <div className="p-4 rounded text-sm" style={{ border: `1px solid ${t.border}` }}>
                <div className="flex justify-between mb-2">
                    <span>{policy.channel === 'Inward' ? 'Policy Manager' : policy.reinsurerName}</span>
                    <span className="font-bold">{policy.ourShare}% Line</span>
                </div>
                <div className="text-xs" style={{ color: t.text4 }}>
                    Ref: {policy.slipNumber || policy.policyNumber}
                </div>
            </div>
        </div>
    </div>
  );

  const renderRegistrySlipNote = (slip: ReinsuranceSlip) => (
    <div className="max-w-[210mm] mx-auto p-[20mm] min-h-[297mm] print:shadow-none print:w-full font-sans relative" style={{ background: t.bgPanel, boxShadow: t.shadow }}>
         <div className="flex items-center gap-4 pb-6 mb-10" style={{ borderBottom: `1px solid ${t.border}` }}>
            <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: t.text1 }}>
                <FileText className="w-6 h-6" style={{ color: '#fff' }} />
            </div>
            <div>
                 <h1 className="text-xl font-bold" style={{ color: t.text1 }}>Policy Manager</h1>
                 <p className="text-sm" style={{ color: t.text4 }}>INTERNAL SLIP ALLOCATION NOTE</p>
            </div>
        </div>

        <div className="p-8 rounded-xl text-center mb-10" style={{ background: t.bgInput, border: `1px solid ${t.border}` }}>
            <p className="text-sm uppercase tracking-wide mb-2" style={{ color: t.text4 }}>Allocated Slip Number</p>
            <div className="text-4xl font-mono font-bold" style={{ color: t.text1 }}>{slip.slipNumber}</div>
        </div>

        <div className="space-y-4 text-sm max-w-lg mx-auto">
             <div className="flex justify-between pb-2" style={{ borderBottom: `1px solid ${t.borderL}` }}>
                 <span style={{ color: t.text4 }}>Date of Allocation</span>
                 <span className="font-bold">{formatDate(slip.date)}</span>
             </div>
             <div className="flex justify-between pb-2" style={{ borderBottom: `1px solid ${t.borderL}` }}>
                 <span style={{ color: t.text4 }}>Insured Name</span>
                 <span className="font-bold">{slip.insuredName}</span>
             </div>
             <div className="flex justify-between pb-2" style={{ borderBottom: `1px solid ${t.borderL}` }}>
                 <span style={{ color: t.text4 }}>Broker / Reinsurer</span>
                 <span className="font-bold">{slip.brokerReinsurer}</span>
             </div>
        </div>

        <div className="mt-20 text-center text-xs" style={{ color: t.text5 }}>
            <p>This document certifies the reservation of the above slip number in the system.</p>
            <p>Generated on {formatDateTime(new Date().toISOString())}</p>
        </div>
    </div>
  );

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      <div className="w-72 flex-shrink-0 flex flex-col gap-4 print:hidden">
         <button onClick={() => navigate(-1)} className="flex items-center gap-2" style={{ color: t.text2 }}><ArrowLeft size={16}/> Back</button>

         <div className="p-4 rounded-lg space-y-4" style={{ background: t.bgPanel, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
            <h3 className="font-bold flex items-center gap-2" style={{ color: t.text1 }}><Settings2 size={16}/> Configuration</h3>

            {isPolicy(item) && item.channel === 'Direct' && templates.length > 0 && (
                <div>
                    <label className="block text-xs font-bold uppercase mb-2" style={{ color: t.text3 }}>Select Template</label>
                    <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full p-2 rounded text-sm focus:ring-2 outline-none"
                        style={{ background: t.bgInput, border: `1px solid ${t.border}`, color: t.text1 }}
                    >
                        {templates.map(tmpl => <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>)}
                    </select>
                    <p className="text-xs mt-2" style={{ color: t.text4 }}>
                        Templates are managed in the Admin Console.
                    </p>
                </div>
            )}

            <div>
                <button onClick={printDocument} className="w-full py-3 rounded flex items-center justify-center gap-2 font-bold transition-colors" style={{ background: t.accent, boxShadow: t.shadow, color: '#fff' }}>
                    <Printer size={18}/> Print / Save PDF
                </button>
                <p className="text-xs mt-2 text-center" style={{ color: t.text4 }}>Use the "Save as PDF" option in the print dialog.</p>
            </div>
         </div>

         {isPolicy(item) && attachedClauses.length > 0 && (
             <div className="p-4 rounded-lg" style={{ background: `${t.accent}18`, border: `1px solid ${t.accent}30` }}>
                 <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: t.accent }}><FileText size={14}/> Attached Clauses</h4>
                 <ul className="list-disc pl-4 text-xs space-y-1" style={{ color: t.accent }}>
                     {attachedClauses.map(c => <li key={c.id}>{c.title}</li>)}
                 </ul>
             </div>
         )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 rounded-xl print:p-0 print:bg-white" style={{ background: t.bgApp, border: `1px solid ${t.border}` }}>
        {isPolicy(item)
            ? (item.channel === 'Direct'
                ? renderDynamicPolicy(item) // New dynamic render
                : renderReinsuranceSlip(item)) // Legacy render for reinsurance
            : renderRegistrySlipNote(item)
        }
      </div>
    </div>
  );
};

export default PolicyWording;
