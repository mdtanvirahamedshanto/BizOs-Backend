/**
 * NLP parser validation script.
 * Run: npx tsx scratch/test_telegram_nlp.ts
 */
import { parseNaturalLanguageEntry } from '../src/bot/nlp/parser';

const examples = ['রহিম বাকি 500', 'বিক্রি 1200', 'খরচ 50', 'খরচ 50 চা', 'unknown input'];

for (const text of examples) {
  const parsed = parseNaturalLanguageEntry(text);
  console.log(`Input: ${text}`);
  console.log(parsed);
  console.log('---');
}
