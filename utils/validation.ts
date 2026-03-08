import { z } from 'zod';

// Policy validation schema
export const PolicySchema = z.object({
  policyNumber: z.string().min(1, 'Policy number is required').max(50),
  insuredName: z.string().min(1, 'Insured name is required').max(200),
  grossPremium: z.number().min(0, 'Premium must be positive'),
  netPremium: z.number().min(0),
  sumInsured: z.number().min(0),
  inceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  status: z.enum(['Draft', 'Active', 'Cancelled', 'Expired']),
});

// Claim validation schema
export const ClaimSchema = z.object({
  claimNumber: z.string().min(1).max(50),
  policyId: z.string().uuid(),
  lossDate: z.string(),
  reportDate: z.string(),
  description: z.string().max(2000),
  initialReserve: z.number().min(0),
});

// User input sanitization
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
};

// Validate and throw on error
export const validatePolicy = (data: unknown) => {
  return PolicySchema.safeParse(data);
};

export const validateClaim = (data: unknown) => {
  return ClaimSchema.safeParse(data);
};

// Password validation
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
}

export const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push('At least 12 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('One uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('One lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('One number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('One special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
