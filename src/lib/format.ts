const rupees = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

/** 1450 → "Rs 1,450" */
export function formatPrice(amount: number): string {
  return `Rs ${rupees.format(Math.round(amount))}`;
}
