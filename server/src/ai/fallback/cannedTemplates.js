const TEMPLATES = {
  'Royalty & Payments': (ctx) =>
    `Hi ${ctx.authorFirstName},\n\nThank you for reaching out to us regarding your royalty payout${ctx.bookTitle ? ` for "${ctx.bookTitle}"` : ''}. We completely understand how important timely royalty updates are.\n\nAt BookLeaf, royalties are calculated on an 80/20 net profit split on a quarterly cycle and paid within 45 days of the quarter ending (subject to a Rs 1,000 minimum threshold). ${ctx.summaryLine}\n\nCould you please confirm that your bank account details are linked and up to date in your author dashboard? Our finance team is also reviewing your account and will share a line-by-line breakdown within 48 hours.\n\nWarm regards,\nBookLeaf Author Support Team`,

  'ISBN & Metadata Issues': (ctx) =>
    `Hi ${ctx.authorFirstName},\n\nThank you for flagging this ISBN/metadata issue${ctx.bookTitle ? ` for "${ctx.bookTitle}"` : ''}. We take ISBN accuracy very seriously and sincerely apologise for the inconvenience caused.\n\nWe have escalated this as a high-priority issue to our production and metadata team right away. They will verify the ISBN registration and update you with a resolution within 48 hours.\n\nWarm regards,\nBookLeaf Author Support Team`,

  'Printing & Quality': (ctx) =>
    `Hi ${ctx.authorFirstName},\n\nWe are truly sorry to hear about the printing quality issue with your copies${ctx.bookTitle ? ` of "${ctx.bookTitle}"` : ''}. As our publishing partner, you deserve copies that meet our quality standards.\n\nCould you please reply with clear photos of the defective pages or binding? Once verified by our quality team, we will arrange a free replacement reprint right away (standard turnaround is 5-7 business days).\n\nWarm regards,\nBookLeaf Author Support Team`,

  'Distribution & Availability': (ctx) =>
    `Hi ${ctx.authorFirstName},\n\nThank you for letting us know about the availability status${ctx.bookTitle ? ` of "${ctx.bookTitle}"` : ''}. When a published book appears as unavailable on a partner store, it is typically due to a platform stock sync issue.\n\nWe are triggering a stock re-sync with our distribution team today. Your listing should reflect as available again within 24-48 hours. Please let us know if you still see any issue after that window.\n\nWarm regards,\nBookLeaf Author Support Team`,

  'Book Status & Production Updates': (ctx) =>
    `Hi ${ctx.authorFirstName},\n\nThank you for checking in on the production progress${ctx.bookTitle ? ` of "${ctx.bookTitle}"` : ''}. ${ctx.summaryLine}\n\nWe are coordinating with our production team to check the exact timeline for your current stage and will get back to you with a concrete schedule update within 24-48 hours.\n\nWarm regards,\nBookLeaf Author Support Team`,

  'General Inquiry': (ctx) =>
    `Hi ${ctx.authorFirstName},\n\nThank you for contacting BookLeaf Publishing Support. We have received your request${ctx.bookTitle ? ` regarding "${ctx.bookTitle}"` : ''}.\n\nIf you are requesting a book description or metadata update, please share the exact updated text in your reply—changes typically reflect on partner platforms within 3-5 business days. Otherwise, our team will get back to you within 24-48 hours.\n\nWarm regards,\nBookLeaf Author Support Team`,
};

function getCannedTemplate(category, contextFacts = {}) {
  const fn = TEMPLATES[category] || TEMPLATES['General Inquiry'];
  return fn({
    authorFirstName: contextFacts.authorFirstName || 'Author',
    bookTitle: contextFacts.bookTitle || null,
    summaryLine: contextFacts.summaryLine || '',
  });
}

module.exports = { getCannedTemplate };