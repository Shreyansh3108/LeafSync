function getNextPayoutDeadline(now = new Date()) {
  const year = now.getFullYear();
  // Quarters end: Mar 31, Jun 30, Sep 30, Dec 31
  const quarterEnds = [
    new Date(year - 1, 11, 31),
    new Date(year, 2, 31),
    new Date(year, 5, 30),
    new Date(year, 8, 30),
    new Date(year, 11, 31),
  ];

  // Payout is within 45 days of quarter ending
  for (const qEnd of quarterEnds) {
    const deadline = new Date(qEnd.getTime() + 45 * 24 * 60 * 60 * 1000);
    if (deadline >= now) {
      return {
        quarterEnd: qEnd.toISOString().slice(0, 10),
        payoutDeadline: deadline.toISOString().slice(0, 10),
        payoutDeadlineFormatted: deadline.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      };
    }
  }

  const fallback = new Date(year + 1, 1, 14);
  return {
    quarterEnd: `${year}-12-31`,
    payoutDeadline: fallback.toISOString().slice(0, 10),
    payoutDeadlineFormatted: '14 Feb ' + (year + 1),
  };
}

function monthsBetween(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(
    0,
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  );
}

function isRoyaltyOverdue(book, now = new Date()) {
  if (!book || book.status.startsWith('In Production')) return false;
  if ((book.royalty_pending || 0) < 1000) return false;

  const refDateStr = book.last_payout_date || book.publication_date;
  const months = monthsBetween(refDateStr, now);
  // Quarterly cycle (3 months) + 45 days (~1.5 months) => ~4.5 months
  return months !== null && months >= 5;
}

module.exports = {
  getNextPayoutDeadline,
  monthsBetween,
  isRoyaltyOverdue,
};