import { jsPDF } from 'jspdf';
import type { Invoice, Payment, Settings } from './data';
import { fmtDate, fmtQty, invNo, money, rctNo } from './format';
import { lineTotal, partnerStd } from './calc';

type RGB = [number, number, number];
const GREEN: RGB = [28, 170, 98];
const BRIGHT: RGB = [34, 201, 116];
const DARK: RGB = [13, 15, 13];
const INK: RGB = [28, 32, 28];
const MUTED: RGB = [112, 120, 112];
const LINE: RGB = [222, 228, 222];
const TINT: RGB = [244, 248, 245];

const W = 612;
const H = 792;
const M = 44;
const R = W - M;

class Pen {
  y = 0;
  constructor(public doc: jsPDF, public s: Settings) {}

  t(str: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'right' | 'center'; spacing?: number } = {}) {
    const d = this.doc;
    d.setFont('helvetica', o.bold ? 'bold' : 'normal');
    d.setFontSize(o.size ?? 10);
    d.setTextColor(...(o.color ?? INK));
    d.text(str, x, y, { align: o.align ?? 'left', charSpace: o.spacing ?? 0 } as any);
  }

  wrap(str: string, width: number, size = 10, bold = false): string[] {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    return this.doc.splitTextToSize(str || '', width) as string[];
  }

  rect(x: number, y: number, w: number, h: number, fill: RGB) {
    this.doc.setFillColor(...fill);
    this.doc.rect(x, y, w, h, 'F');
  }

  hline(y: number, color: RGB = LINE, x1 = M, x2 = R, w = 0.7) {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(w);
    this.doc.line(x1, y, x2, y);
  }

  header(title: string, number: string) {
    this.rect(0, 0, W, 100, DARK);
    this.rect(0, 100, W, 4, BRIGHT);
    this.t('ABS', M, 58, { size: 34, bold: true, color: BRIGHT, spacing: 1 });
    this.t('HAULING & LOGISTICS', M, 78, { size: 11, bold: true, color: [231, 255, 240], spacing: 1.5 });
    this.t(title, R, 52, { size: 24, bold: true, color: [255, 255, 255], align: 'right', spacing: 2 });
    this.t(number, R, 74, { size: 12, bold: true, color: BRIGHT, align: 'right' });
    this.y = 132;
  }

  footer() {
    const n = this.doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      this.doc.setPage(p);
      this.hline(H - 52, LINE);
      const bits = [this.s.business_name, this.s.phone, this.s.email, this.s.website].filter(Boolean).join('   |   ');
      this.t(bits, W / 2, H - 36, { size: 8, color: MUTED, align: 'center' });
      if (this.s.tagline) this.t(this.s.tagline, W / 2, H - 24, { size: 8, bold: true, color: GREEN, align: 'center' });
      if (n > 1) this.t(`Page ${p} of ${n}`, R, H - 24, { size: 8, color: MUTED, align: 'right' });
    }
  }

  ensure(h: number) {
    if (this.y + h > H - 70) {
      this.doc.addPage();
      this.y = M + 10;
    }
  }

  label(str: string, x: number, y: number) {
    this.t(str.toUpperCase(), x, y, { size: 7.5, bold: true, color: MUTED, spacing: 1 });
  }

  block(label: string, x: number, lines: string[], boldFirst = true) {
    let y = this.y;
    this.label(label, x, y);
    y += 15;
    lines.filter(Boolean).forEach((ln, i) => {
      for (const part of this.wrap(ln, 190, 10, boldFirst && i === 0)) {
        this.t(part, x, y, { bold: boldFirst && i === 0, size: 10 });
        y += 13;
      }
    });
    return y;
  }
}

function fromBlock(s: Settings) {
  return [s.business_name, s.owner_name, s.phone, s.email, s.address];
}
function toBlock(i: Invoice) {
  return [i.customer_name, i.customer_contact, i.customer_address, i.customer_email, i.customer_phone];
}

// Line items table. Returns nothing, advances pen.y.
function itemsTable(p: Pen, inv: Invoice) {
  const cols = { desc: M + 10, qty: 372, rate: 470, amt: R - 8 };
  p.rect(M, p.y, R - M, 24, DARK);
  p.t('DESCRIPTION', cols.desc, p.y + 15.5, { size: 8, bold: true, color: [255, 255, 255], spacing: 1 });
  p.t('QTY', cols.qty, p.y + 15.5, { size: 8, bold: true, color: [255, 255, 255], align: 'right', spacing: 1 });
  p.t('RATE', cols.rate, p.y + 15.5, { size: 8, bold: true, color: [255, 255, 255], align: 'right', spacing: 1 });
  p.t('AMOUNT', cols.amt, p.y + 15.5, { size: 8, bold: true, color: [255, 255, 255], align: 'right', spacing: 1 });
  p.y += 24;
  inv.items.forEach((it, idx) => {
    const lines = p.wrap(it.description, 270, 10, true);
    const std = partnerStd(it);
    const h = Math.max(std ? 38 : 26, lines.length * 13 + 12);
    p.ensure(h);
    if (idx % 2 === 1) p.rect(M, p.y, R - M, h, TINT);
    let ty = p.y + 17;
    for (const ln of lines) {
      p.t(ln, cols.desc, ty, { bold: true });
      ty += 13;
    }
    const mid = p.y + 17;
    p.t(`${fmtQty(it.qty)}${it.unit ? ' ' + it.unit : ''}`, cols.qty, mid, { align: 'right' });
    p.t(money(it.rate_cents), cols.rate, mid, { align: 'right' });
    if (std) {
      // Standard price, struck through, under the partner rate
      const s = money(std);
      p.t(s, cols.rate, mid + 12, { align: 'right', size: 8, color: MUTED });
      p.doc.setFontSize(8);
      const w = p.doc.getTextWidth(s);
      p.hline(mid + 9.2, MUTED, cols.rate - w, cols.rate, 0.6);
      p.t(`Save ${money(lineTotal({ qty: it.qty, rate_cents: std }) - lineTotal(it))}`, cols.amt, mid + 12, { align: 'right', size: 8, color: GREEN, bold: true });
    }
    p.t(money(lineTotal(it)), cols.amt, mid, { align: 'right', bold: true });
    p.y += h;
    p.hline(p.y, LINE);
  });
  p.y += 6;
}

function totalsBlock(p: Pen, inv: Invoice, opts: { showPaid: boolean; paidThrough?: number }) {
  const x1 = 330;
  const row = (label: string, val: string, o: { bold?: boolean; color?: RGB } = {}) => {
    p.ensure(18);
    p.t(label, x1, p.y + 12, { color: o.color ?? MUTED, bold: o.bold, size: 10 });
    p.t(val, R - 8, p.y + 12, { align: 'right', bold: o.bold, color: o.color ?? INK, size: 10 });
    p.y += 18;
  };
  p.y += 4;
  if (inv.t.partnerSavings > 0) {
    row('Standard price', money(inv.t.standard));
    row('Preferred Partner savings', '- ' + money(inv.t.partnerSavings), { color: GREEN, bold: true });
  }
  row('Subtotal', money(inv.t.subtotal));
  if (inv.t.discount > 0) {
    const label =
      inv.discount_label?.trim() || (inv.discount_type === 'percent' ? `Discount (${fmtQty(inv.discount_value)}%)` : 'Discount');
    const shown = inv.discount_label?.trim() && inv.discount_type === 'percent' ? `${label} (${fmtQty(inv.discount_value)}%)` : label;
    row(shown, '- ' + money(inv.t.discount), { color: GREEN, bold: true });
  }
  if (inv.t.tax > 0) row(`Tax (${fmtQty(inv.tax_pct)}%)`, money(inv.t.tax));
  p.hline(p.y + 2, LINE, x1, R);
  p.y += 8;
  p.ensure(30);
  p.t('Total', x1, p.y + 14, { bold: true, size: 12 });
  p.t(money(inv.t.total), R - 8, p.y + 14, { bold: true, size: 12, align: 'right' });
  p.y += 24;
  if (opts.showPaid) {
    const paid = opts.paidThrough ?? inv.paid;
    row(opts.paidThrough !== undefined ? 'Paid to date' : 'Payments received', '- ' + money(paid), { color: GREEN });
    const bal = inv.t.total - paid;
    p.ensure(40);
    p.rect(x1 - 10, p.y, R - x1 + 10, 34, bal <= 0 ? GREEN : DARK);
    p.t(bal <= 0 ? 'PAID IN FULL' : 'BALANCE DUE', x1, p.y + 21.5, { bold: true, size: 10, color: [255, 255, 255], spacing: 1 });
    p.t(money(Math.max(0, bal)), R - 8, p.y + 22, { bold: true, size: 15, color: [255, 255, 255], align: 'right' });
    p.y += 44;
  }
}

function textBlock(p: Pen, title: string, body: string) {
  if (!body?.trim()) return;
  const lines = p.wrap(body, R - M, 9.5);
  p.ensure(24 + lines.length * 12);
  p.label(title, M, p.y + 8);
  p.y += 22;
  for (const ln of lines) {
    p.t(ln, M, p.y, { size: 9.5 });
    p.y += 12;
  }
  p.y += 8;
}

function stamp(p: Pen, text: string) {
  p.doc.setPage(1);
  p.doc.saveGraphicsState();
  p.doc.setGState(new (p.doc as any).GState({ opacity: 0.16 }));
  p.doc.setFont('helvetica', 'bold');
  p.doc.setFontSize(96);
  p.doc.setTextColor(...GREEN);
  p.doc.text(text, 330, 470, { angle: 24, align: 'center' } as any);
  p.doc.restoreGraphicsState();
}

export function invoicePdf(inv: Invoice, s: Settings, jobLine?: string): ArrayBuffer {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const p = new Pen(doc, s);
  p.header('INVOICE', invNo(inv.number));

  const yTop = p.y;
  const a = p.block('From', M, fromBlock(s));
  p.y = yTop;
  const b = p.block('Bill to', 230, toBlock(inv));
  // meta, right column
  let my = yTop;
  p.label('Invoice details', 420, my);
  my += 15;
  const meta: [string, string][] = [
    ['Issued', fmtDate(inv.issue_date)],
    ['Due', inv.due_date === inv.issue_date ? 'On receipt' : fmtDate(inv.due_date)],
    ['Status', inv.state === 'void' ? 'Void' : inv.state === 'paid' ? 'Paid' : inv.state === 'overdue' ? 'Overdue' : inv.paid > 0 ? 'Partially paid' : 'Unpaid'],
  ];
  for (const [k, v] of meta) {
    p.t(k, 420, my, { color: MUTED, size: 10 });
    p.t(v, R, my, { align: 'right', bold: true, size: 10 });
    my += 14;
  }
  p.y = Math.max(a, b, my) + 10;
  if (jobLine) {
    p.rect(M, p.y, R - M, 24, TINT);
    p.t(`Job: ${jobLine}`, M + 10, p.y + 15.5, { size: 9.5 });
    p.y += 36;
  } else p.y += 8;

  itemsTable(p, inv);
  totalsBlock(p, inv, { showPaid: true });

  if (inv.payments.length) {
    p.ensure(40 + inv.payments.length * 14);
    p.label('Payments received', M, p.y + 8);
    p.y += 22;
    for (const pay of inv.payments) {
      p.t(fmtDate(pay.paid_date), M, p.y, { size: 9.5 });
      p.t(`${pay.method}${pay.reference ? ' - ' + pay.reference : ''}`, M + 100, p.y, { size: 9.5, color: MUTED });
      p.t(`Receipt ${rctNo(pay.receipt_no)}`, 330, p.y, { size: 9.5, color: MUTED });
      p.t(money(pay.amount_cents), R - 8, p.y, { size: 9.5, bold: true, align: 'right' });
      p.y += 14;
    }
    p.y += 10;
  }
  if (inv.balance > 0 && inv.state !== 'void') textBlock(p, 'How to pay', s.payment_instructions);
  textBlock(p, 'Notes', inv.notes);
  textBlock(p, '', s.invoice_footer);

  p.footer();
  if (inv.state === 'paid') stamp(p, 'PAID');
  if (inv.state === 'void') stamp(p, 'VOID');
  return doc.output('arraybuffer');
}

export function receiptPdf(inv: Invoice, pay: Payment, s: Settings): ArrayBuffer {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const p = new Pen(doc, s);
  p.header('RECEIPT', rctNo(pay.receipt_no));

  const yTop = p.y;
  const a = p.block('Received from', M, [inv.customer_name, inv.customer_contact, inv.customer_address, inv.customer_email]);
  p.y = yTop;
  const b = p.block('Received by', 250, [s.business_name, s.owner_name, s.phone, s.email]);
  let my = yTop;
  p.label('Payment', 430, my);
  my += 15;
  for (const [k, v] of [
    ['Date', fmtDate(pay.paid_date)],
    ['Method', pay.method],
    ['Applied to', invNo(inv.number)],
  ] as [string, string][]) {
    p.t(k, 430, my, { color: MUTED, size: 10 });
    p.t(v, R, my, { align: 'right', bold: true, size: 10 });
    my += 14;
  }
  if (pay.reference) {
    p.t('Reference', 430, my, { color: MUTED, size: 10 });
    p.t(pay.reference, R, my, { align: 'right', bold: true, size: 10 });
    my += 14;
  }
  p.y = Math.max(a, b, my) + 14;

  // Amount banner
  p.rect(M, p.y, R - M, 62, TINT);
  p.rect(M, p.y, 5, 62, BRIGHT);
  p.t('AMOUNT RECEIVED', M + 22, p.y + 24, { size: 9, bold: true, color: MUTED, spacing: 1.2 });
  p.t(money(pay.amount_cents), M + 22, p.y + 49, { size: 24, bold: true, color: GREEN });
  p.t(`${pay.method} on ${fmtDate(pay.paid_date)}`, R - 16, p.y + 36, { size: 10, align: 'right', color: MUTED });
  p.y += 86;

  // Breakdown of the invoice this payment applies to
  p.label(`Invoice ${invNo(inv.number)} breakdown`, M, p.y);
  p.y += 12;
  itemsTable(p, inv);

  // Running balance up to and including this payment
  const upTo = inv.payments.filter((x) => x.paid_date < pay.paid_date || (x.paid_date === pay.paid_date && x.id <= pay.id));
  const paidThrough = upTo.reduce((a2, x) => a2 + x.amount_cents, 0);
  totalsBlock(p, inv, { showPaid: true, paidThrough });

  if (pay.note) textBlock(p, 'Note', pay.note);
  textBlock(p, '', 'Thank you. Please keep this receipt for your records.');
  p.footer();
  if (inv.t.total - paidThrough <= 0) stamp(p, 'PAID');
  return doc.output('arraybuffer');
}
