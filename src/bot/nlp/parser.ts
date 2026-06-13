export type ParsedEntryType = 'customer_due' | 'sale' | 'expense';

export interface ParsedEntry {
  type: ParsedEntryType;
  amountCents: number;
  customerName?: string;
  title?: string;
  raw: string;
}

const AMOUNT_PATTERN = '(\\d+(?:\\.\\d{1,2})?)';

const PATTERNS: Array<{ type: ParsedEntryType; regex: RegExp }> = [
  {
    type: 'customer_due',
    regex: new RegExp(`^(.+?)\\s+(?:বাকি|baki|bakhi|due|duee|বাকী)\\s+${AMOUNT_PATTERN}$`, 'iu'),
  },
  {
    type: 'sale',
    regex: new RegExp(`^(?:বিক্রি|bikri|sell|sale)\\s+${AMOUNT_PATTERN}$`, 'iu'),
  },
  {
    type: 'expense',
    regex: new RegExp(
      `^(?:খরচ|khoroch|kharcha|kharch|expense)\\s+${AMOUNT_PATTERN}(?:\\s+(.+))?$`,
      'iu',
    ),
  },
];

function parseAmountToCents(amountStr: string): number {
  const amount = parseFloat(amountStr);
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error('Invalid amount');
  }
  return Math.round(amount * 100);
}

/**
 * Parse natural-language Bengali/English shop entries.
 *
 * Examples:
 *   "রহিম বাকি 500"  → customer due 500 BDT
 *   "বিক্রি 1200"     → cash sale 1200 BDT
 *   "খরচ 50"          → expense 50 BDT
 *   "খরচ 50 চা"       → expense 50 BDT titled "চা"
 */
export function parseNaturalLanguageEntry(text: string): ParsedEntry | null {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return null;
  }

  for (const pattern of PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (!match) {
      continue;
    }

    if (pattern.type === 'customer_due') {
      const customerName = match[1]!.trim();
      const amountCents = parseAmountToCents(match[2]!);
      if (!customerName) {
        continue;
      }
      return { type: 'customer_due', amountCents, customerName, raw: normalized };
    }

    if (pattern.type === 'sale') {
      const amountCents = parseAmountToCents(match[1]!);
      return { type: 'sale', amountCents, raw: normalized };
    }

    if (pattern.type === 'expense') {
      const amountCents = parseAmountToCents(match[1]!);
      const title = match[2]?.trim() || 'Telegram expense';
      return { type: 'expense', amountCents, title, raw: normalized };
    }
  }

  return null;
}

export function getParserHelpText(): string {
  return [
    'Natural language examples:',
    '• রহিম বাকি 500 — record ৳500 due from Rahim',
    '• বিক্রি 1200 — record ৳1200 cash sale',
    '• খরচ 50 — record ৳50 expense',
    '• খরচ 50 চা — expense with title',
    '',
    'English aliases: due, sale, expense, baki, bikri, khoroch',
  ].join('\n');
}
