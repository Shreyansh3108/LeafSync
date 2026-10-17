function classifyByKeywords({ subject = '', description = '', overdueRoyalty = false }) {
  const text = `${subject} ${description}`.toLowerCase();

  let category = 'General Inquiry';
  let priority = 'Medium';

  if (/\b(isbn|imprint|barcode|wrong book linked|duplicate isbn)\b/.test(text)) {
    category = 'ISBN & Metadata Issues';
    priority = 'High';
  } else if (/\b(royalt(y|ies)|payout|payment|paid|pending|earned|bank|commission|profit)\b/.test(text)) {
    category = 'Royalty & Payments';
    priority =
      /\b(6 months|4 months|overdue|still haven't|not received|never received)\b/.test(text) ||
      overdueRoyalty
        ? 'High'
        : 'Medium';
  } else if (/\b(print|blurry|misaligned|binding|defect|damaged|quality|reprint|pages)\b/.test(text)) {
    category = 'Printing & Quality';
    priority = 'High';
  } else if (/\b(typesetting|cover design|proofreading|production|stage|manuscript|when will it be done)\b/.test(text)) {
    category = 'Book Status & Production Updates';
    priority = 'Medium';
  } else if (/\b(bio|description)\b/.test(text)) {
    category = 'General Inquiry';
    priority = 'Low';
  } else if (/\b(unavailable|out of stock|amazon|flipkart|listing|distribution|sync)\b/.test(text)) {
    category = 'Distribution & Availability';
    priority = 'Medium';
  }

  return {
    category,
    priority,
    confidence: 0.55,
    reason: 'Assigned by deterministic keyword fallback (AI offline or rate-limited). Needs review.',
  };
}

module.exports = { classifyByKeywords };