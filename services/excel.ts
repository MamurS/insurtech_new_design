
import ExcelJS from 'exceljs';
import { Policy, ReinsuranceSlip, PortfolioRow } from '../types';
import { getStoredDateFormat } from '../utils/dateUtils';

// Colors based on Tailwind classes used in Dashboard
const COLORS = {
  headerGray: 'FFEEEFEF', // gray-200
  blue: 'FFEFF6FF', // blue-50
  green: 'FFF0FDF4', // green-50
  amber: 'FFFFFBEB', // amber-50
  purple: 'FFFAF5FF', // purple-50
  white: 'FFFFFFFF',
  border: 'FFD1D5DB' // gray-300
};

const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.border } },
  left: { style: 'thin', color: { argb: COLORS.border } },
  bottom: { style: 'thin', color: { argb: COLORS.border } },
  right: { style: 'thin', color: { argb: COLORS.border } }
};

interface ColumnDef {
  header: string;
  key: string;
  width: number;
  fill?: string;
  format?: string;
  align?: 'left' | 'center' | 'right';
}

const saveWorkbook = async (workbook: ExcelJS.Workbook, fileName: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

// Helper to map app settings to Excel format strings
const getExcelDateFormat = () => {
    // App uses 'mm.dd.yyyy' (lowercase), Excel tends to want 'mm.dd.yyyy' or 'dd/mm/yyyy' standard patterns.
    // Luckily ExcelJS supports these standard pattern strings directly.
    return getStoredDateFormat(); 
};

export const ExcelService = {
  exportSlips: async (slips: ReinsuranceSlip[]) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reinsurance Slips');
    const dateFormat = getExcelDateFormat();

    const columns: ColumnDef[] = [
      { header: 'Slip Number', key: 'slipNumber', width: 25 },
      { header: 'Date', key: 'date', width: 15, align: 'center', format: dateFormat },
      { header: 'Insured', key: 'insuredName', width: 30 },
      { header: 'Broker / Reinsurer', key: 'brokerReinsurer', width: 30 },
    ];

    setupSheet(sheet, columns);

    slips.forEach(slip => {
      const row = sheet.addRow(slip);
      styleRow(row, columns);
    });

    await saveWorkbook(workbook, 'Reinsurance_Slips_Registry.xlsx');
  },

  exportPolicies: async (policies: Policy[]) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Policy_Register`);
    const dateFormat = getExcelDateFormat();

    const columns: ColumnDef[] = [
        // Identifiers
        { header: 'Channel', key: 'channel', width: 15, fill: COLORS.headerGray },
        { header: 'Ref No', key: 'policyNumber', width: 20 },
        { header: 'Secondary Ref', key: 'secondaryPolicyNumber', width: 20 },
        { header: 'Agreement No', key: 'agreementNumber', width: 20 },
        { header: 'Bordereau No', key: 'bordereauNo', width: 15 },
        { header: 'Status', key: 'status', width: 15 },

        // Dates
        { header: 'Inception', key: 'inceptionDate', width: 15, align: 'center', format: dateFormat },
        { header: 'Expiry', key: 'expiryDate', width: 15, align: 'center', format: dateFormat },
        { header: 'Date of Slip', key: 'dateOfSlip', width: 15, align: 'center', format: dateFormat },
        { header: 'Accounting Date', key: 'accountingDate', width: 15, align: 'center', format: dateFormat },
        { header: 'Payment Date', key: 'paymentDate', width: 15, align: 'center', format: dateFormat },
        { header: 'Warranty (Days)', key: 'warrantyPeriod', width: 10 },

        // Parties
        { header: 'Insured Name', key: 'insuredName', width: 30 },
        { header: 'Insured Address', key: 'insuredAddress', width: 30 },
        { header: 'Cedant', key: 'cedantName', width: 25 },
        { header: 'Intermediary Type', key: 'intermediaryType', width: 15 },
        { header: 'Intermediary Name', key: 'intermediaryName', width: 25 },
        { header: 'Borrower', key: 'borrower', width: 20 },
        { header: 'Retrocedent', key: 'retrocedent', width: 20 },
        { header: 'Performer', key: 'performer', width: 20 },
        
        // Risk
        { header: 'Class', key: 'classOfInsurance', width: 15 },
        { header: 'Risk Code', key: 'riskCode', width: 10 },
        { header: 'Territory', key: 'territory', width: 15 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'Insured Risk', key: 'insuredRisk', width: 30 },
        
        // Financials
        { header: 'Currency', key: 'currency', width: 8, align: 'center' },
        { header: 'Sum Insured', key: 'sumInsured', width: 20, fill: COLORS.blue, format: '#,##0.00' },
        { header: 'Sum Insured (Nat)', key: 'sumInsuredNational', width: 20, fill: COLORS.blue, format: '#,##0.00' },
        { header: 'Gross Premium', key: 'grossPremium', width: 20, fill: COLORS.green, format: '#,##0.00' },
        { header: 'Premium (Nat)', key: 'premiumNationalCurrency', width: 20, fill: COLORS.green, format: '#,##0.00' },
        { header: 'Exchange Rate', key: 'exchangeRate', width: 12, format: '0.00' },
        { header: 'Equivalent USD', key: 'equivalentUSD', width: 18, format: '#,##0.00' },
        
        // Limits
        { header: 'Limit (FC)', key: 'limitForeignCurrency', width: 18, format: '#,##0.00' },
        { header: 'Excess (FC)', key: 'excessForeignCurrency', width: 18, format: '#,##0.00' },
        
        // Our Share
        { header: 'Our Share %', key: 'ourShare', width: 12, format: '0.00' },
        { header: 'Net Premium', key: 'netPremium', width: 18, format: '#,##0.00' },
        { header: 'Commission %', key: 'commissionPercent', width: 12, format: '0.00' },
        
        // Outward Details
        { header: 'Reinsured Out?', key: 'hasOutwardReinsurance', width: 12 },
        { header: 'Reinsurer', key: 'reinsurerName', width: 25, fill: COLORS.amber },
        { header: 'Ceded Share %', key: 'cededShare', width: 12, fill: COLORS.amber, format: '0.00' },
        { header: 'Ceded Prem (FC)', key: 'cededPremiumForeign', width: 18, fill: COLORS.amber, format: '#,##0.00' },
        { header: 'Reins Comm %', key: 'reinsuranceCommission', width: 12, fill: COLORS.amber, format: '0.00' },
        { header: 'Net Payable', key: 'netReinsurancePremium', width: 18, fill: COLORS.amber, format: '#,##0.00' },
        
        // Treaty / Inward
        { header: 'Treaty Placement', key: 'treatyPlacement', width: 20 },
        { header: 'Treaty Prem', key: 'treatyPremium', width: 18, format: '#,##0.00' },
        { header: 'AIC Commission', key: 'aicCommission', width: 18, format: '#,##0.00' },
      ];

    setupSheet(sheet, columns);

    policies.forEach(policy => {
        const rowData: any = { ...policy };
        // Pre-process for better display
        if (rowData.hasOutwardReinsurance) {
            rowData.hasOutwardReinsurance = 'Yes';
        } else {
            rowData.hasOutwardReinsurance = 'No';
            rowData.cededShare = 0;
            rowData.reinsurerName = '-';
            rowData.cededPremiumForeign = 0;
        }

        const row = sheet.addRow(rowData);
        styleRow(row, columns);
    });

    await saveWorkbook(workbook, `InsurTech_Full_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  },

  exportPortfolio: async (rows: PortfolioRow[]) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Portfolio_Register`);
    const dateFormat = getExcelDateFormat();

    const columns: ColumnDef[] = [
        // Identity / References
        { header: 'Source', key: 'source', width: 15, fill: COLORS.headerGray },
        { header: 'Ref No', key: 'referenceNumber', width: 20 },
        { header: 'Secondary Ref', key: 'secondaryRef', width: 18 },
        { header: 'Slip No', key: 'slipNumber', width: 18 },
        { header: 'Agreement No', key: 'agreementNumber', width: 18 },
        { header: '1C Code', key: 'accountingCode', width: 12 },

        // Parties
        { header: 'Insured Name', key: 'insuredName', width: 30 },
        { header: 'Cedant', key: 'cedantName', width: 25 },
        { header: 'Broker', key: 'brokerName', width: 25 },
        { header: 'Borrower', key: 'borrower', width: 20 },
        { header: 'Retrocedent', key: 'retrocedent', width: 20 },
        { header: 'Performer', key: 'performer', width: 20 },

        // Classification
        { header: 'Class', key: 'classOfBusiness', width: 25 },
        { header: 'Type of Insurance', key: 'typeOfInsurance', width: 20 },
        { header: 'Risk Code', key: 'riskCode', width: 12 },
        { header: 'Insured Risk', key: 'insuredRisk', width: 30 },
        { header: 'Industry', key: 'industry', width: 20 },
        { header: 'Territory', key: 'territory', width: 20 },
        { header: 'City', key: 'city', width: 15 },

        // Financial - Currency & Exchange
        { header: 'Currency', key: 'currency', width: 10, align: 'center' },
        { header: 'Exchange Rate', key: 'exchangeRate', width: 12, align: 'right', format: '0.0000' },
        { header: 'Ex Rate USD', key: 'exchangeRateUSD', width: 12, align: 'right', format: '0.0000' },
        { header: 'Equiv USD', key: 'equivalentUSD', width: 15, align: 'right', format: '#,##0.00' },

        // Financial - Sums
        { header: 'Sum Insured', key: 'sumInsured', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Sum Insured NC', key: 'sumInsuredNational', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Limit FC', key: 'limit', width: 18, fill: COLORS.blue, align: 'right', format: '#,##0.00' },
        { header: 'Limit NC', key: 'limitNational', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Excess FC', key: 'excess', width: 15, align: 'right', format: '#,##0.00' },
        { header: 'Priority Sum', key: 'prioritySum', width: 15, align: 'right', format: '#,##0.00' },

        // Financial - Premium
        { header: 'Premium Rate %', key: 'premiumRate', width: 12, align: 'right', format: '0.00' },
        { header: 'Gross Prem FC', key: 'grossPremium', width: 18, fill: COLORS.green, align: 'right', format: '#,##0.00' },
        { header: 'Gross Prem NC', key: 'grossPremiumNational', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Premium NC', key: 'premiumNational', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Full Prem FC 100%', key: 'fullPremiumForeign', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Full Prem NC 100%', key: 'fullPremiumNational', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Net Prem FC', key: 'netPremium', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Net Prem NC', key: 'netPremiumNational', width: 18, align: 'right', format: '#,##0.00' },

        // Rates
        { header: 'Our Share %', key: 'ourShare', width: 12, align: 'right', format: '0.00' },
        { header: 'Commission %', key: 'commissionPercent', width: 12, align: 'right', format: '0.00' },
        { header: 'Commission NC', key: 'commissionNational', width: 15, align: 'right', format: '#,##0.00' },
        { header: 'Tax %', key: 'taxPercent', width: 10, align: 'right', format: '0.00' },

        // Reinsurance
        { header: 'Reins Type', key: 'reinsuranceType', width: 12 },
        { header: 'Sum Reins FC', key: 'sumReinsuredForeign', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Sum Reins NC', key: 'sumReinsuredNational', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Reinsurer', key: 'reinsurerName', width: 25, fill: COLORS.amber },
        { header: 'Ceded %', key: 'cededShare', width: 10, fill: COLORS.amber, align: 'right', format: '0.00' },
        { header: 'Ceded Premium', key: 'cededPremium', width: 18, fill: COLORS.amber, align: 'right', format: '#,##0.00' },
        { header: 'Reins Commission', key: 'reinsuranceCommission', width: 18, fill: COLORS.amber, align: 'right', format: '#,##0.00' },
        { header: 'Net Reins Prem', key: 'netReinsurancePremium', width: 18, fill: COLORS.amber, align: 'right', format: '#,##0.00' },

        // Treaty & AIC
        { header: 'Treaty Placement %', key: 'treatyPlacement', width: 15, align: 'right', format: '0.00' },
        { header: 'Treaty Premium', key: 'treatyPremium', width: 15, align: 'right', format: '#,##0.00' },
        { header: 'AIC Commission', key: 'aicCommission', width: 15, align: 'right', format: '#,##0.00' },
        { header: 'AIC Retention %', key: 'aicRetention', width: 15, align: 'right', format: '0.00' },
        { header: 'AIC Premium', key: 'aicPremium', width: 15, align: 'right', format: '#,##0.00' },

        // Retrocession
        { header: 'Risks Count', key: 'risksCount', width: 12, align: 'right' },
        { header: 'Retro Sum Reins', key: 'retroSumReinsured', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Retro Premium', key: 'retroPremium', width: 18, align: 'right', format: '#,##0.00' },

        // Dates
        { header: 'Inception', key: 'inceptionDate', width: 15, format: dateFormat },
        { header: 'Expiry', key: 'expiryDate', width: 15, format: dateFormat },
        { header: 'Insurance Days', key: 'insuranceDays', width: 12, align: 'right' },
        { header: 'Reins Inception', key: 'reinsuranceInceptionDate', width: 15, format: dateFormat },
        { header: 'Reins Expiry', key: 'reinsuranceExpiryDate', width: 15, format: dateFormat },
        { header: 'Reins Days', key: 'reinsuranceDays', width: 12, align: 'right' },
        { header: 'Slip Date', key: 'dateOfSlip', width: 15, format: dateFormat },
        { header: 'Accounting Date', key: 'accountingDate', width: 15, format: dateFormat },
        { header: 'Warranty Period', key: 'warrantyPeriod', width: 12 },

        // Payment Tracking
        { header: 'Prem Payment Date', key: 'premiumPaymentDate', width: 15, format: dateFormat },
        { header: 'Actual Payment Date', key: 'actualPaymentDate', width: 15, format: dateFormat },
        { header: 'Rcvd Prem FC', key: 'receivedPremiumForeign', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'Rcvd Prem Currency', key: 'receivedPremiumCurrency', width: 15, align: 'center' },
        { header: 'Rcvd Ex Rate', key: 'receivedPremiumExchangeRate', width: 12, align: 'right', format: '0.0000' },
        { header: 'Rcvd Prem NC', key: 'receivedPremiumNational', width: 18, align: 'right', format: '#,##0.00' },
        { header: 'No. Slips', key: 'numberOfSlips', width: 10, align: 'right' },

        // Status / Contract Info
        { header: 'Status', key: 'normalizedStatus', width: 12 },
        { header: 'Type', key: 'contractType', width: 12 },
        { header: 'Structure', key: 'structure', width: 18 },
    ];

    setupSheet(sheet, columns);

    rows.forEach(row => {
        const rowData: any = {
          // Identity / References
          source: row.source === 'direct' ? 'Direct' :
                  row.source === 'inward-foreign' ? 'Inward Foreign' :
                  row.source === 'inward-domestic' ? 'Inward Domestic' : 'Slip',
          referenceNumber: row.referenceNumber,
          secondaryRef: row.secondaryRef || '',
          slipNumber: row.slipNumber || '',
          agreementNumber: row.agreementNumber || '',
          accountingCode: row.accountingCode || '',

          // Parties
          insuredName: row.insuredName,
          cedantName: row.cedantName || '',
          brokerName: row.brokerName || '',
          borrower: row.borrower || '',
          retrocedent: row.retrocedent || '',
          performer: row.performer || '',

          // Classification
          classOfBusiness: row.classOfBusiness,
          typeOfInsurance: row.typeOfInsurance || '',
          riskCode: row.riskCode || '',
          insuredRisk: row.insuredRisk || '',
          industry: row.industry || '',
          territory: row.territory || '',
          city: row.city || '',

          // Financial - Currency & Exchange
          currency: row.currency,
          exchangeRate: row.exchangeRate || 0,
          exchangeRateUSD: row.exchangeRateUSD || 0,
          equivalentUSD: row.equivalentUSD || 0,

          // Financial - Sums
          sumInsured: row.sumInsured || 0,
          sumInsuredNational: row.sumInsuredNational || 0,
          limit: row.limit || 0,
          limitNational: row.limitNational || 0,
          excess: row.excess || 0,
          prioritySum: row.prioritySum || 0,

          // Financial - Premium
          premiumRate: row.premiumRate || 0,
          grossPremium: row.grossPremium || 0,
          grossPremiumNational: row.grossPremiumNational || 0,
          premiumNational: row.premiumNational || 0,
          fullPremiumForeign: row.fullPremiumForeign || 0,
          fullPremiumNational: row.fullPremiumNational || 0,
          netPremium: row.netPremium || 0,
          netPremiumNational: row.netPremiumNational || 0,

          // Rates
          ourShare: row.ourShare || 0,
          commissionPercent: row.commissionPercent || 0,
          commissionNational: row.commissionNational || 0,
          taxPercent: row.taxPercent || 0,

          // Reinsurance
          reinsuranceType: row.reinsuranceType || '',
          sumReinsuredForeign: row.sumReinsuredForeign || 0,
          sumReinsuredNational: row.sumReinsuredNational || 0,
          reinsurerName: row.reinsurerName || '',
          cededShare: row.cededShare || 0,
          cededPremium: row.cededPremium || 0,
          reinsuranceCommission: row.reinsuranceCommission || 0,
          netReinsurancePremium: row.netReinsurancePremium || 0,

          // Treaty & AIC
          treatyPlacement: row.treatyPlacement || 0,
          treatyPremium: row.treatyPremium || 0,
          aicCommission: row.aicCommission || 0,
          aicRetention: row.aicRetention || 0,
          aicPremium: row.aicPremium || 0,

          // Retrocession
          risksCount: row.risksCount || 0,
          retroSumReinsured: row.retroSumReinsured || 0,
          retroPremium: row.retroPremium || 0,

          // Dates
          inceptionDate: row.inceptionDate,
          expiryDate: row.expiryDate,
          insuranceDays: row.insuranceDays || 0,
          reinsuranceInceptionDate: row.reinsuranceInceptionDate || '',
          reinsuranceExpiryDate: row.reinsuranceExpiryDate || '',
          reinsuranceDays: row.reinsuranceDays || 0,
          dateOfSlip: row.dateOfSlip || '',
          accountingDate: row.accountingDate || '',
          warrantyPeriod: row.warrantyPeriod || '',

          // Payment Tracking
          premiumPaymentDate: row.premiumPaymentDate || '',
          actualPaymentDate: row.actualPaymentDate || '',
          receivedPremiumForeign: row.receivedPremiumForeign || 0,
          receivedPremiumCurrency: row.receivedPremiumCurrency || '',
          receivedPremiumExchangeRate: row.receivedPremiumExchangeRate || 0,
          receivedPremiumNational: row.receivedPremiumNational || 0,
          numberOfSlips: row.numberOfSlips || 0,

          // Status / Contract Info
          normalizedStatus: row.isDeleted ? 'Deleted' : row.normalizedStatus,
          contractType: row.contractType || '',
          structure: row.structure || '',
        };

        const excelRow = sheet.addRow(rowData);
        styleRow(excelRow, columns);
    });

    await saveWorkbook(workbook, `InsurTech_Portfolio_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
};

function setupSheet(sheet: ExcelJS.Worksheet, columns: ColumnDef[]) {
  sheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width
  }));

  // Style Header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.height = 25;
  
  headerRow.eachCell((cell, colNumber) => {
    const colDef = columns[colNumber - 1];
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colDef.fill || COLORS.headerGray }
    };
    cell.border = BORDER_STYLE;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
}

function styleRow(row: ExcelJS.Row, columns: ColumnDef[]) {
  row.eachCell((cell, colNumber) => {
    const colDef = columns[colNumber - 1];
    cell.border = BORDER_STYLE;
    
    if (colDef.fill) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: colDef.fill } 
      };
    }

    if (colDef.format) {
      cell.numFmt = colDef.format;
    }
    
    if (colDef.align) {
        cell.alignment = { horizontal: colDef.align };
    }
  });
}
