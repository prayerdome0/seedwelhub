import { formatCurrency, formatDate } from '../utils/format';
import { APP_NAME } from '../utils/constants';
import { REAL_LOGO } from '../assets';

// ---------------------------------------------------------------------------
// PDF writer for the shared document model.
//
// jsPDF is loaded lazily (dynamic import) so the ~350KB library is only
// fetched the first time somebody actually downloads a document, instead of
// being carried by the initial bundle for every visitor.
//
// The layout intentionally mirrors DocumentView so the downloaded PDF is
// recognisably the same document the user just looked at on screen.
// ---------------------------------------------------------------------------

const MARGIN = 48;
const NAVY = [16, 31, 54];
const GREEN = [34, 165, 61];
const GREY = [107, 114, 128];
const LINE = [214, 219, 228];

// The logo is a bundled asset URL; fetch it once and cache the data URL so
// repeated downloads in the same session do not re-read the file.
let logoPromise = null;
function loadLogo() {
  if (!logoPromise) {
    logoPromise = fetch(REAL_LOGO)
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      )
      .catch(() => null);
  }
  return logoPromise;
}

function sanitizeFilename(value) {
  return String(value || 'document')
    .replace(/[^a-z0-9\-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export async function generateDocumentPdf(doc, { download = true } = {}) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const currency = doc.currency;

  let y = MARGIN;

  // Keeps every writer honest about page breaks — content is never clipped.
  const ensureSpace = (needed) => {
    if (y + needed > pageHeight - MARGIN - 40) {
      pdf.addPage();
      y = MARGIN;
    }
  };

  // ---- Header: logo + brand, document title ----
  const logo = await loadLogo();
  if (logo) {
    try {
      pdf.addImage(logo, 'PNG', MARGIN, y, 46, 46);
    } catch {
      /* a missing logo must never block the download */
    }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(...NAVY);
  pdf.text(APP_NAME, MARGIN + (logo ? 58 : 0), y + 20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...GREY);
  pdf.text('Buy. Sell. Manage. Grow.', MARGIN + (logo ? 58 : 0), y + 34);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(...NAVY);
  pdf.text(doc.title, pageWidth - MARGIN, y + 20, { align: 'right' });
  if (doc.statusLabel) {
    pdf.setFontSize(10);
    pdf.setTextColor(...GREEN);
    pdf.text(doc.statusLabel, pageWidth - MARGIN, y + 36, { align: 'right' });
  }

  y += 62;
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(2);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 22;

  // ---- Meta grid (two columns) ----
  pdf.setLineWidth(0.6);
  const metaColumnWidth = contentWidth / 2;
  doc.meta.forEach((entry, index) => {
    const column = index % 2;
    const x = MARGIN + column * metaColumnWidth;
    if (column === 0 && index > 0) y += 15;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...GREY);
    pdf.text(String(entry.label).toUpperCase(), x, y);
    pdf.setFont('helvetica', entry.strong ? 'bold' : 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(...NAVY);
    const value = entry.isDate ? formatDate(entry.value) : String(entry.value || '—');
    pdf.text(pdf.splitTextToSize(value, metaColumnWidth - 16)[0], x, y + 12);
  });
  y += 34;

  // ---- Parties ----
  ensureSpace(110);
  const partyWidth = contentWidth / 2 - 10;
  const drawParty = (heading, data, x) => {
    let py = y;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...GREEN);
    pdf.text(heading, x, py);
    py += 14;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...NAVY);
    pdf.text(pdf.splitTextToSize(data.name || '—', partyWidth), x, py);
    py += 14;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...GREY);
    [data.subtitle, data.email, data.phone, data.address, ...(data.extra || [])]
      .filter(Boolean)
      .forEach((line) => {
        const wrapped = pdf.splitTextToSize(String(line), partyWidth);
        pdf.text(wrapped, x, py);
        py += wrapped.length * 11;
      });
    return py;
  };
  const sellerBottom = drawParty('SELLER', doc.seller, MARGIN);
  const buyerBottom = drawParty(
    doc.type === 'quotation' ? 'PREPARED FOR' : 'BUYER',
    doc.customer,
    MARGIN + contentWidth / 2 + 10
  );
  y = Math.max(sellerBottom, buyerBottom) + 18;

  // ---- Items table ----
  if (doc.items && doc.items.length) {
    ensureSpace(70);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...GREEN);
    pdf.text('ITEMS', MARGIN, y);
    y += 12;

    const columns = [
      { key: 'name', label: 'Description', width: contentWidth * 0.46, align: 'left' },
      { key: 'quantity', label: 'Qty', width: contentWidth * 0.12, align: 'right' },
      { key: 'unitPrice', label: 'Unit price', width: contentWidth * 0.2, align: 'right' },
      { key: 'amount', label: 'Amount', width: contentWidth * 0.22, align: 'right' },
    ];

    const drawHeaderRow = () => {
      pdf.setDrawColor(...LINE);
      pdf.line(MARGIN, y, pageWidth - MARGIN, y);
      y += 13;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...NAVY);
      let x = MARGIN;
      columns.forEach((column) => {
        const tx = column.align === 'right' ? x + column.width : x;
        pdf.text(column.label, tx, y, { align: column.align });
        x += column.width;
      });
      y += 8;
      pdf.line(MARGIN, y, pageWidth - MARGIN, y);
      y += 14;
    };

    drawHeaderRow();

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...NAVY);
    doc.items.forEach((item) => {
      const nameLines = pdf.splitTextToSize(item.name, columns[0].width - 10);
      const rowHeight = Math.max(nameLines.length * 11, 14);
      if (y + rowHeight > pageHeight - MARGIN - 60) {
        pdf.addPage();
        y = MARGIN;
        drawHeaderRow();
      }
      let x = MARGIN;
      pdf.setFontSize(9.5);
      pdf.text(nameLines, x, y);
      x += columns[0].width;
      const values = [
        `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`,
        formatCurrency(item.unitPrice, currency),
        formatCurrency(item.amount, currency),
      ];
      values.forEach((value, index) => {
        const column = columns[index + 1];
        pdf.text(String(value), x + column.width, y, { align: 'right' });
        x += column.width;
      });
      y += rowHeight + 6;
    });

    pdf.setDrawColor(...LINE);
    pdf.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 18;
  }

  // ---- Totals ----
  if (doc.totals && doc.totals.length) {
    ensureSpace(doc.totals.length * 16 + 20);
    const totalsX = MARGIN + contentWidth * 0.5;
    const totalsWidth = contentWidth * 0.5;
    doc.totals.forEach((total) => {
      pdf.setFont('helvetica', total.strong ? 'bold' : 'normal');
      pdf.setFontSize(total.strong ? 11 : 10);
      pdf.setTextColor(...(total.strong ? NAVY : GREY));
      pdf.text(total.label, totalsX, y);
      pdf.setTextColor(...NAVY);
      pdf.text(formatCurrency(total.value, currency), totalsX + totalsWidth, y, { align: 'right' });
      y += total.strong ? 18 : 15;
    });
    y += 6;
  }

  // ---- Notes and terms ----
  const paragraph = (heading, body) => {
    if (!body) return;
    const lines = pdf.splitTextToSize(String(body), contentWidth);
    ensureSpace(lines.length * 11 + 30);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...GREEN);
    pdf.text(heading, MARGIN, y);
    y += 13;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(...NAVY);
    pdf.text(lines, MARGIN, y);
    y += lines.length * 11 + 12;
  };
  paragraph('NOTES', doc.notes);
  paragraph('TERMS & CONDITIONS', doc.terms);

  // ---- Footer on every page ----
  const pageCount = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    const footerY = pageHeight - MARGIN + 8;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.6);
    pdf.line(MARGIN, footerY - 20, pageWidth - MARGIN, footerY - 20);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...GREY);
    if (doc.footnote) pdf.text(doc.footnote, MARGIN, footerY - 8);
    if (doc.verificationCode) {
      pdf.text(`Verification: ${doc.verificationCode}`, MARGIN, footerY + 3);
    }
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, footerY + 3, { align: 'right' });
    pdf.setTextColor(...NAVY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(APP_NAME, pageWidth - MARGIN, footerY - 8, { align: 'right' });
  }

  const filename = `${sanitizeFilename(doc.number || doc.title)}.pdf`;
  if (download) {
    pdf.save(filename);
    return filename;
  }
  return pdf.output('blob');
}
