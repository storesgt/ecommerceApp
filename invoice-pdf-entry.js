import { jsPDF } from 'jspdf';

const cleanText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[–—]/g, '-')
  .replace(/[’‘]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/[^\x20-\xFF]/g, '?');

const formatAmount = (value, currency) => `${currency} ${new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(Number(value) || 0)}`;

window.createInvoicePdf = ({ receipt, logoDataUrl }) => {
  const document = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const left = 18;
  const right = pageWidth - left;
  const contentWidth = right - left;
  const currency = cleanText(receipt.currency || 'USD');
  let y = 22;

  if (logoDataUrl) {
    try {
      document.addImage(logoDataUrl, 'PNG', left, y - 5, 38, 18, undefined, 'FAST');
      y += 20;
    } catch (error) {
      console.error('Invoice PDF logo could not be added:', error);
    }
  }

  document.setFont('helvetica', 'bold');
  document.setFontSize(22);
  document.text('INVOICE', left, y + 7);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text(cleanText(receipt.invoiceNumber), left, y + 14);
  document.text(`Issued ${cleanText(new Date(receipt.issuedAt).toLocaleString())}`, left, y + 20);
  y += 32;

  const drawRule = (atY, width = contentWidth) => {
    document.setDrawColor(210, 212, 205);
    document.setLineWidth(0.25);
    document.line(left, atY, left + width, atY);
  };
  const addPage = () => {
    document.addPage();
    y = 20;
  };
  const amountText = (value) => formatAmount(value, currency);
  const ensureRoom = (height) => {
    if (y + height > pageHeight - 18) addPage();
  };

  const drawTableHeader = (columns) => {
    document.setFont('helvetica', 'bold');
    document.setFontSize(8);
    document.setTextColor(104, 108, 100);
    columns.forEach(({ label, x, align }) => document.text(label, x, y, { align }));
    y += 5;
    drawRule(y);
    y += 5;
    document.setTextColor(32, 33, 29);
  };

  drawTableHeader([
    { label: 'DETAILS', x: left },
    { label: 'QTY', x: right - 28, align: 'right' },
    { label: 'AMOUNT', x: right, align: 'right' }
  ]);
  const detailWidth = contentWidth - 67;
  for (const item of receipt.items || []) {
    const lines = document.splitTextToSize(cleanText(item.name), detailWidth);
    const rowHeight = Math.max(6, lines.length * 4.5);
    ensureRoom(rowHeight + 4);
    document.setFont('helvetica', 'normal');
    document.setFontSize(9);
    document.text(lines, left, y);
    document.text(String(item.quantity), right - 28, y, { align: 'right' });
    document.text(amountText(Number(item.unitPrice) * Number(item.quantity)), right, y, { align: 'right' });
    y += rowHeight;
    drawRule(y);
    y += 4;
  }

  y += 5;
  ensureRoom(44);
  const summaryLeft = left + contentWidth * 0.42;
  const summaryWidth = right - summaryLeft;
  document.setFont('helvetica', 'bold');
  document.setFontSize(8);
  document.setTextColor(104, 108, 100);
  document.text('DETAILS', summaryLeft, y);
  document.text('AMOUNT', right, y, { align: 'right' });
  y += 5;
  drawRule(y, summaryWidth);
  y += 6;

  const financialRows = [
    { label: 'Subtotal', amount: Number(receipt.subtotal) },
    ...(Number(receipt.discount) > 0 ? [{ label: `Coupon discount${receipt.couponCode ? ` (${receipt.couponCode})` : ''}`, amount: -Number(receipt.discount) }] : []),
    { label: 'Delivery', amount: Number(receipt.shipping) },
    { label: 'Tax', amount: Number(receipt.tax) },
    ...(Number(receipt.serviceFee) > 0 ? [{ label: 'Payment provider service charge', amount: Number(receipt.serviceFee) }] : [])
  ];

  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  for (const row of financialRows) {
    const lines = document.splitTextToSize(cleanText(row.label), summaryWidth - 28);
    const rowHeight = Math.max(6, lines.length * 4.5);
    ensureRoom(rowHeight + 3);
    document.text(lines, summaryLeft, y);
    document.text(amountText(row.amount), right, y, { align: 'right' });
    y += rowHeight;
  }

  y += 2;
  drawRule(y, summaryWidth);
  y += 8;
  ensureRoom(12);
  document.setFont('helvetica', 'bold');
  document.setFontSize(12);
  document.text('TOTAL', summaryLeft, y);
  document.text(amountText(receipt.total), right, y, { align: 'right' });
  y += 9;

  if (Number(receipt.serviceFee) > 0) {
    const note = 'This service charge is collected by the payment provider for secure handling of funds. The company does not charge an external fee.';
    const lines = document.splitTextToSize(note, summaryWidth);
    ensureRoom(lines.length * 4 + 5);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7.5);
    document.setTextColor(104, 108, 100);
    document.text(lines, summaryLeft, y);
    y += lines.length * 4 + 5;
  }

  ensureRoom(12);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.setTextColor(104, 108, 100);
  document.text(`Payment: ${cleanText(receipt.payment?.provider || 'pending')} / ${cleanText(receipt.payment?.status || receipt.paymentStatus || 'PENDING')}`, left, y);
  return document.output('arraybuffer');
};
