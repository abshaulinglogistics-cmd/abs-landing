// Pure invoice math, shared by the server, the PDFs and the browser editor.
// All money is integer cents.

export type CalcItem = { qty: number; rate_cents: number; kind: string; std_cents?: number };
export type Discount = { type: string; value: number }; // percent: 10 = 10%. flat: value in cents.

export type Totals = {
  lines: number[];
  standard: number; // subtotal had every partner line been billed at the standard price
  partnerSavings: number; // standard - subtotal
  subtotal: number;
  discountable: number;
  discount: number;
  tax: number;
  total: number;
};

export function lineTotal(i: { qty: number; rate_cents: number }) {
  return Math.round((Number(i.qty) || 0) * (Number(i.rate_cents) || 0));
}

// The standard price for a line, when it was billed below it at the Preferred Partner rate.
export function partnerStd(i: { rate_cents: number; std_cents?: number }) {
  const std = Math.round(Number(i.std_cents) || 0);
  return std > (Number(i.rate_cents) || 0) ? std : 0;
}

// Discounts apply to service lines. Disposal/dump fees are passed through at cost
// (as stated in the proposal), so they are never discounted.
export function totals(items: CalcItem[], d: Discount, taxPct: number): Totals {
  const lines = items.map(lineTotal);
  const subtotal = lines.reduce((a, b) => a + b, 0);
  const standard = items.reduce((a, it, i) => {
    const std = partnerStd(it);
    return a + (std ? lineTotal({ qty: it.qty, rate_cents: std }) : lines[i]);
  }, 0);
  const partnerSavings = Math.max(0, standard - subtotal);
  const discountable = items.reduce((a, it, i) => a + (it.kind === 'disposal' ? 0 : lines[i]), 0);
  let discount = 0;
  if (d.type === 'percent') discount = Math.round((discountable * (Number(d.value) || 0)) / 100);
  else if (d.type === 'flat') discount = Math.min(Math.round(Number(d.value) || 0), discountable);
  discount = Math.max(0, Math.min(discount, discountable));
  const taxable = subtotal - discount;
  const tax = Math.round((taxable * (Number(taxPct) || 0)) / 100);
  return { lines, standard, partnerSavings, subtotal, discountable, discount, tax, total: taxable + tax };
}
