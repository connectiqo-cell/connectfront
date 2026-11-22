import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 40;
const BRAND = 'Connectiqo';
const BRAND_SITE = 'app.connectiqo.com';
const AMOUNT_RIGHT = PAGE_W - MARGIN;

const INK = [0.09, 0.09, 0.13];
const MUTED = [0.42, 0.42, 0.50];
const LINE = [0.88, 0.88, 0.92];
const ACCENT = [0.35, 0.18, 0.78];
const ACCENT_SOFT = [0.94, 0.91, 0.99];
const HEADER_TOP = [0.18, 0.08, 0.42];
const HEADER_BOT = [0.35, 0.18, 0.78];
const TOTAL_BG = [0.12, 0.10, 0.22];
const WHITE = [1, 1, 1];
const STATUS_OK = [0.06, 0.55, 0.38];

// PDF text is WinAnsi/ASCII only — non-Latin names and the ₹ glyph are
// dropped, so amounts read "Rs." Swap in an embedded TTF subset if that matters.
function esc(value) {
  const ascii = String(value == null ? '' : value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/[^\x20-\x7e]/g, '')
    .trim();
  return (ascii || '-').replace(/([\()])/g, '\\$1');
}

export function money(amount) {
  const n = Number(amount || 0);
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Rough Helvetica advance width so we can right-align amounts. */
function textWidth(text, size, bold) {
  const avg = bold ? 0.55 : 0.50;
  return String(text).length * size * avg;
}

function ops(items) {
  return items
    .map(it => {
      if (it.rect) {
        const [r, g, b] = it.color || LINE;
        return `${r} ${g} ${b} rg ${it.x} ${PAGE_H - it.y - it.h} ${it.w} ${it.h} re f`;
      }
      if (it.rule) {
        const [r, g, b] = it.color || LINE;
        return `${it.width || 0.7} w ${r} ${g} ${b} RG ${it.x} ${PAGE_H - it.y} m ${it.x2} ${PAGE_H - it.y} l S`;
      }
      const [r, g, b] = it.color || INK;
      const font = it.bold ? 'F2' : 'F1';
      const size = it.size || 10;
      let x = it.x;
      if (it.align === 'right') {
        x = it.x - textWidth(it.text, size, it.bold);
      }
      return `BT /${font} ${size} Tf ${r} ${g} ${b} rg ${x} ${PAGE_H - it.y} Td (${esc(it.text)}) Tj ET`;
    })
    .join('\n');
}

function assemble(content) {
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PAGE_W} ${PAGE_H}]` +
      '/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const startxref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF\n`;
  return pdf;
}

/**
 * Build a single-page A4 receipt PDF as an ASCII string.
 * @param {{number:string, date:string, status:string, billedToLabel?:string,
 *   billedTo:string, counterpartyLabel?:string, counterparty?:string,
 *   lines:{label:string, amount:number}[], total:number, totalLabel?:string,
 *   reference?:{label:string, value:string}[], note?:string}} receipt
 */
export function buildReceiptPdf(receipt) {
  const contentW = PAGE_W - MARGIN * 2;
  const status = String(receipt.status || 'Paid');
  const paid = /paid|success|completed|settled/i.test(status);
  const statusColor = paid ? STATUS_OK : ACCENT;

  const draw = [
    { rect: true, x: 0, y: 0, w: PAGE_W, h: 118, color: HEADER_TOP },
    { rect: true, x: 0, y: 96, w: PAGE_W, h: 22, color: HEADER_BOT },
    { text: BRAND, x: MARGIN, y: 42, size: 22, bold: true, color: WHITE },
    { text: 'Connect  -  Create  -  Collab', x: MARGIN, y: 62, size: 9, color: [0.78, 0.72, 0.96] },
    { text: BRAND_SITE, x: MARGIN, y: 78, size: 8.5, color: [0.72, 0.66, 0.92] },

    { text: 'RECEIPT', x: AMOUNT_RIGHT, y: 40, size: 18, bold: true, color: WHITE, align: 'right' },
    { text: `No. ${receipt.number}`, x: AMOUNT_RIGHT, y: 60, size: 9.5, color: [0.86, 0.82, 0.98], align: 'right' },
    { text: `Date  ${receipt.date}`, x: AMOUNT_RIGHT, y: 76, size: 9.5, color: [0.86, 0.82, 0.98], align: 'right' },

    { rect: true, x: MARGIN, y: 140, w: contentW, h: receipt.counterparty ? 96 : 78, color: ACCENT_SOFT },
  ];

  draw.push(
    { text: receipt.billedToLabel || 'Paid by', x: MARGIN + 16, y: 160, size: 8, bold: true, color: MUTED },
    { text: receipt.billedTo, x: MARGIN + 16, y: 178, size: 12, bold: true },
    { text: 'Status', x: PAGE_W - MARGIN - 120, y: 160, size: 8, bold: true, color: MUTED },
    { text: status, x: PAGE_W - MARGIN - 120, y: 178, size: 12, bold: true, color: statusColor },
  );

  if (receipt.counterparty) {
    draw.push(
      { text: receipt.counterpartyLabel || 'Counterparty', x: MARGIN + 16, y: 204, size: 8, bold: true, color: MUTED },
      { text: receipt.counterparty, x: MARGIN + 16, y: 222, size: 11, bold: true },
    );
  }

  let y = receipt.counterparty ? 268 : 248;

  draw.push(
    { rect: true, x: MARGIN, y, w: contentW, h: 28, color: ACCENT },
    { text: 'Description', x: MARGIN + 14, y: y + 18, size: 9, bold: true, color: WHITE },
    { text: 'Amount', x: AMOUNT_RIGHT - 14, y: y + 18, size: 9, bold: true, color: WHITE, align: 'right' },
  );
  y += 28;

  receipt.lines.forEach((line, i) => {
    const rowH = 30;
    if (i % 2 === 0) {
      draw.push({ rect: true, x: MARGIN, y, w: contentW, h: rowH, color: [0.97, 0.97, 0.99] });
    }
    draw.push(
      { text: line.label, x: MARGIN + 14, y: y + 19, size: 10 },
      { text: money(line.amount), x: AMOUNT_RIGHT - 14, y: y + 19, size: 10, align: 'right' },
    );
    y += rowH;
  });

  draw.push({ rule: true, x: MARGIN, x2: PAGE_W - MARGIN, y, color: LINE, width: 0.8 });
  y += 14;

  const totalLabel = receipt.totalLabel || 'Total';
  const totalText = money(receipt.total);
  draw.push(
    { rect: true, x: PAGE_W - MARGIN - 220, y, w: 220, h: 48, color: TOTAL_BG },
    { text: totalLabel, x: PAGE_W - MARGIN - 206, y: y + 18, size: 9, color: [0.78, 0.76, 0.88] },
    { text: totalText, x: AMOUNT_RIGHT - 14, y: y + 36, size: 14, bold: true, color: WHITE, align: 'right' },
  );
  y += 72;

  if ((receipt.reference || []).length) {
    draw.push({ text: 'Payment reference', x: MARGIN, y, size: 9, bold: true, color: MUTED });
    y += 18;
    receipt.reference.forEach(ref => {
      draw.push(
        { text: `${ref.label}:`, x: MARGIN, y, size: 9, bold: true, color: MUTED },
        { text: ref.value, x: MARGIN + 90, y, size: 9 },
      );
      y += 16;
    });
  }

  draw.push(
    { rect: true, x: 0, y: PAGE_H - 70, w: PAGE_W, h: 70, color: [0.97, 0.96, 0.99] },
    { rule: true, x: 0, x2: PAGE_W, y: PAGE_H - 70, color: [0.86, 0.82, 0.96], width: 1.2 },
    {
      text: receipt.note || 'Computer-generated receipt. Amounts are inclusive of applicable taxes.',
      x: MARGIN,
      y: PAGE_H - 42,
      size: 8,
      color: MUTED,
    },
    { text: `${BRAND}  |  ${BRAND_SITE}`, x: MARGIN, y: PAGE_H - 26, size: 8.5, bold: true, color: ACCENT },
    { text: 'Thank you for using Connectiqo', x: AMOUNT_RIGHT, y: PAGE_H - 26, size: 8.5, color: MUTED, align: 'right' },
  );

  return assemble(ops(draw));
}

function safeFileName(number) {
  return `receipt-${String(number).replace(/[^\w.-]/g, '-')}.pdf`;
}

/**
 * Write the receipt PDF into app cache.
 * @returns {Promise<string>} local file path (no file:// prefix)
 */
export async function writeReceiptPdf(receipt) {
  const pdf = buildReceiptPdf(receipt);
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeFileName(receipt.number)}`;
  await ReactNativeBlobUtil.fs.writeFile(path, pdf, 'utf8');
  return path;
}

/**
 * Open the system share sheet for this receipt PDF.
 * @returns {Promise<string>} local file path
 */
export async function shareReceipt(receipt) {
  const path = await writeReceiptPdf(receipt);
  await Share.open({
    url: `file://${path}`,
    type: 'application/pdf',
    filename: safeFileName(receipt.number).replace(/\.pdf$/, ''),
    title: `Receipt ${receipt.number}`,
    failOnCancel: false,
  });
  return path;
}

/**
 * Save the receipt PDF to device Downloads (Android) or Documents (iOS).
 * @returns {Promise<{path:string, locationLabel:string}>}
 */
export async function saveReceipt(receipt) {
  const cachePath = await writeReceiptPdf(receipt);
  const name = safeFileName(receipt.number);

  if (Platform.OS === 'android' && ReactNativeBlobUtil.MediaCollection?.copyToMediaStore) {
    const saved = await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
      { name, parentFolder: 'Connectiqo', mimeType: 'application/pdf' },
      'Download',
      cachePath,
    );
    return { path: saved || cachePath, locationLabel: 'Downloads' };
  }

  const dir =
    Platform.OS === 'android'
      ? ReactNativeBlobUtil.fs.dirs.DownloadDir
      : ReactNativeBlobUtil.fs.dirs.DocumentDir;
  const dest = `${dir}/${name}`;
  const exists = await ReactNativeBlobUtil.fs.exists(dest);
  if (exists) await ReactNativeBlobUtil.fs.unlink(dest);
  await ReactNativeBlobUtil.fs.cp(cachePath, dest);
  return {
    path: dest,
    locationLabel: Platform.OS === 'android' ? 'Downloads' : 'Files / On My iPhone',
  };
}
