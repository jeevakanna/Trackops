/**
 * Format numbers using Indian Rupee format (e.g. ₹1,25,000)
 */
export function formatINR(val: number, options?: { showDecimal?: boolean }): string {
  const num = Number(val) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const parts = absNum.toFixed(options?.showDecimal ? 2 : 0).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian currency comma grouping: last 3 digits, then groups of 2
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    const formattedOthers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    integerPart = formattedOthers + ',' + lastThree;
  }

  const prefix = isNegative ? '-₹' : '₹';
  return options?.showDecimal && decimalPart
    ? `${prefix}${integerPart}.${decimalPart}`
    : `${prefix}${integerPart}`;
}

/**
 * Format numbers using "Rs." prefix for PDF and plain text compatibility
 */
export function formatRs(val: number, options?: { showDecimal?: boolean }): string {
  const inr = formatINR(val, options);
  return inr.replace('₹', 'Rs. ');
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export function formatTimeOnly(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '';
  }
}
