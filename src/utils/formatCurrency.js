export const formatCurrency = (amount, currency = '₹') => {
  if (amount === null || amount === undefined) return `${currency}0`;

  const numAmount = parseFloat(amount);
  const formatted = numAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return `${currency}${formatted}`;
};

export const formatPrice = (amount, currency = '₹') => {
  if (amount === null || amount === undefined) return `${currency}0/session`;
  return `${formatCurrency(amount, currency)}/session`;
};

export const parseAmount = (amountString) => {
  return parseFloat(amountString.replace(/[^\d.-]/g, ''));
};
