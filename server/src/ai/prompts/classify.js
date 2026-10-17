const { z } = require('zod');

const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

const classificationOutputSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(3).max(300),
});

function buildClassifyPrompt({ subject, description }) {
  const truncatedDesc = String(description || '').slice(0, 2000);

  const system = `You classify incoming author support tickets for BookLeaf Publishing.
Return a JSON object with keys:
- "category": one of ["Royalty & Payments", "ISBN & Metadata Issues", "Printing & Quality", "Distribution & Availability", "Book Status & Production Updates", "General Inquiry"]
- "priority": one of ["Critical", "High", "Medium", "Low"]
- "confidence": number between 0 and 1
- "reason": short 1-sentence explanation.

Category definitions:
- Royalty & Payments: royalty amounts, payouts, pending balances, bank transfers, net profit split.
- ISBN & Metadata Issues: wrong ISBN, duplicate ISBN, imprint questions, barcode/metadata mismatches.
- Printing & Quality: blurry images, misaligned pages, binding defects, damaged copies, reprints.
- Distribution & Availability: book showing Currently Unavailable or out of stock on Amazon/Flipkart, listing delays.
- Book Status & Production Updates: books in typesetting, cover design, proofreading, production delays.
- General Inquiry: updating book description/author bio, publishing package questions, general account queries.`;

  const user = `<ticket>
Subject: ${subject}
Description: ${truncatedDesc}
</ticket>`;

  return { system, user };
}

const PRIORITY_RANK = { Low: 1, Medium: 2, High: 3, Critical: 4 };
const RANK_TO_PRIORITY = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Critical' };

function applyPriorityGuardrails(result, { subject, description, overdueRoyalty }) {
  const text = `${subject} ${description}`.toLowerCase();
  let rank = PRIORITY_RANK[result.priority] || 2;

  // Guardrail 1: ISBN category has a floor of High
  if (result.category === 'ISBN & Metadata Issues' && rank < 3) {
    rank = 3;
  }

  // Guardrail 2: Data errors, duplicates, wrong book linked, or sustained non-payment
  if (
    /\b(different isbn|wrong isbn|duplicate|wrong book|6 months|4 months|still haven't received|never received)\b/.test(
      text
    ) &&
    rank < 3
  ) {
    rank = 3;
  }

  // Guardrail 3: Computed overdue royalty flag lifts Medium to High
  if (overdueRoyalty && result.category === 'Royalty & Payments' && rank < 3) {
    rank = 3;
  }

  // Guardrail 4: Trivial asks (author bio, description update) stay Low or Medium
  if (
    result.category === 'General Inquiry' &&
    /\b(update.*description|author bio|change.*bio|update.*bio)\b/.test(text) &&
    rank > 2
  ) {
    rank = 1;
  }

  return {
    ...result,
    priority: RANK_TO_PRIORITY[rank],
  };
}

module.exports = {
  classificationOutputSchema,
  buildClassifyPrompt,
  applyPriorityGuardrails,
};