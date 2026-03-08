
// Centralized Date Formatting Utility

export const getStoredDateFormat = (): string => {
  try {
    const settings = localStorage.getItem('insurtech_app_settings');
    return settings ? JSON.parse(settings).dateFormat : 'dd.mm.yyyy';
  } catch (e) {
    return 'dd.mm.yyyy';
  }
};

export const getDateFormatSeparator = (format: string): string => {
  if (format.includes('/')) return '/';
  if (format.includes('-')) return '-';
  return '.';
};

export const maskDateInput = (rawValue: string): string => {
  if (!rawValue) return '';
  const format = getStoredDateFormat();
  const separator = getDateFormatSeparator(format);
  
  // 1. Keep only numbers
  const digits = rawValue.replace(/\D/g, '');
  
  // 2. Reconstruct with separators (Assuming 2-2-4 format like dd.mm.yyyy or mm.dd.yyyy)
  // If the user deleted characters (rawValue length < what we expect), we might handle differently, 
  // but for simple forward typing, this rebuilds the string.
  
  let result = '';
  
  if (digits.length > 0) {
      result += digits.substring(0, 2);
  }
  if (digits.length >= 2) {
      result += separator;
  }
  if (digits.length > 2) {
      result += digits.substring(2, 4);
  }
  if (digits.length >= 4) {
      result += separator;
  }
  if (digits.length > 4) {
      result += digits.substring(4, 8);
  }
  
  return result;
};

export const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const format = getStoredDateFormat();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  switch (format) {
    case 'dd/mm/yyyy': return `${day}/${month}/${year}`;
    case 'mm/dd/yyyy': return `${month}/${day}/${year}`;
    case 'dd.mm.yyyy': return `${day}.${month}.${year}`;
    case 'mm.dd.yyyy': return `${month}.${day}.${year}`;
    case 'dd-mm-yyyy': return `${day}-${month}-${year}`;
    case 'mm-dd-yyyy': return `${month}-${day}-${year}`;
    default: return `${day}.${month}.${year}`; // Default fallback
  }
};

export const formatDateTime = (dateStr: string | undefined | null): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const datePart = formatDate(dateStr);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  
  return `${datePart} ${hours}:${mins}`;
};

export const parseDateInput = (input: string): string | null => {
  if (!input) return null;
  const format = getStoredDateFormat();
  const separator = getDateFormatSeparator(format);

  const inputParts = input.split(separator);
  const formatParts = format.split(separator); 

  if (inputParts.length !== 3) return null;

  let day, month, year;

  // Map parts based on format string
  formatParts.forEach((part, index) => {
    if (part.includes('d')) day = inputParts[index];
    if (part.includes('m')) month = inputParts[index];
    if (part.includes('y')) year = inputParts[index];
  });

  if (!day || !month || !year) return null;
  
  // Basic validation ensuring complete numbers
  if (year.length < 4) return null;

  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;

  // Validate real calendar existence (e.g. prevent 31.02.2023)
  const dateObj = new Date(y, m - 1, d);
  if (dateObj.getFullYear() !== y || dateObj.getMonth() + 1 !== m || dateObj.getDate() !== d) {
      return null;
  }

  // Return ISO yyyy-mm-dd
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};
