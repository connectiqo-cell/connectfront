jest.mock('react-native-blob-util', () => ({ fs: { dirs: { CacheDir: '/tmp' } }, writeFile: jest.fn() }));
jest.mock('react-native-share', () => ({ open: jest.fn() }));

const { buildReceiptPdf, money } = require('../receipt');

const RECEIPT = {
  number: 'CIQ-ABC123',
  date: '21 Nov 2026',
  status: 'Paid',
  billedTo: 'Nishadh (निषाध)',
  counterparty: 'Mentor Name',
  lines: [
    { label: '1:1 mentoring session', amount: 1500 },
    { label: 'Less: platform fee (incl. taxes)', amount: -225 },
  ],
  total: 1275,
  totalLabel: 'Amount received',
  reference: [{ label: 'Payment ID', value: 'pay_Abc123 (test)' }],
};

test('money formats paise-safe INR with two decimals', () => {
  expect(money(1275)).toBe('Rs. 1,275.00');
  expect(money(0)).toBe('Rs. 0.00');
  expect(money(-225)).toBe('Rs. -225.00');
});

test('pdf xref offsets point at the real object headers', () => {
  const pdf = buildReceiptPdf(RECEIPT);

  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  expect(pdf.endsWith('%%EOF\n')).toBe(true);
  expect(/^[\x0a\x20-\x7e]*$/.test(pdf)).toBe(true);

  const startxref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  expect(pdf.slice(startxref, startxref + 4)).toBe('xref');

  const offsets = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]));
  expect(offsets).toHaveLength(6);
  offsets.forEach((offset, i) => {
    expect(pdf.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
  });

  const declared = Number(pdf.match(/<<\/Length (\d+)>>/)[1]);
  const stream = pdf.match(/stream\n([\s\S]*?)\nendstream/)[1];
  expect(stream).toHaveLength(declared);
});

test('content carries the receipt data and escapes pdf syntax', () => {
  const pdf = buildReceiptPdf(RECEIPT);

  expect(pdf).toContain('(RECEIPT)');
  expect(pdf).toContain('(No. CIQ-ABC123)');
  expect(pdf).toContain('(Rs. 1,275.00)');
  expect(pdf).toContain('(Amount received)');
  expect(pdf).toContain('(pay_Abc123 \\(test\\))');
  expect(pdf).toContain('(Nishadh \\(\\))');
});

test('a name with no latin characters still renders a placeholder', () => {
  const pdf = buildReceiptPdf({ ...RECEIPT, billedTo: 'निषाध' });
  expect(pdf).toContain('(-)');
});
