const { getNextPayoutDeadline, monthsBetween, isRoyaltyOverdue } = require('../../utils/dates');

function buildContextFacts({ author, book, now = new Date() }) {
  const authorFirstName = (author?.name || 'Author').trim().split(/\s+/)[0];
  const payoutInfo = getNextPayoutDeadline(now);

  if (!book) {
    const text = [
      `Author First Name: ${authorFirstName}`,
      `Scope: General / Account Level (No specific book selected)`,
      `Checks (code): next quarterly payout deadline: ${payoutInfo.payoutDeadlineFormatted}`,
      `Missing data note: Bank-details status, printing costs, and per-platform sales are not in context.`,
    ].join('\n');

    return {
      authorFirstName,
      bookTitle: null,
      overdueRoyalty: false,
      belowThreshold: false,
      summaryLine: `Our next quarterly payout window closes on ${payoutInfo.payoutDeadlineFormatted}.`,
      text,
    };
  }

  const isInProduction = book.status.startsWith('In Production');
  const overdueRoyalty = isRoyaltyOverdue(book, now);
  const belowThreshold = !isInProduction && book.royalty_pending > 0 && book.royalty_pending < 1000;
  const aboveThreshold = !isInProduction && book.royalty_pending >= 1000;
  const pubMonths = monthsBetween(book.publication_date, now);

  let text;
  let summaryLine;

  if (isInProduction) {
    text = [
      `Author First Name: ${authorFirstName}`,
      `Book: ${book.title} (${book.external_id}) | ISBN: ${book.isbn} | Status: ${book.status}`,
      `Current Production Stage: ${book.production_stage || 'In Production'}`,
      `Note: Book is still in production (not yet published; MRP, sales, and royalties are N/A).`,
    ].join('\n');
    summaryLine = `Your book "${book.title}" is currently in the "${book.production_stage || book.status}" stage.`;
  } else {
    text = [
      `Author First Name: ${authorFirstName}`,
      `Book: ${book.title} (${book.external_id}) | ${book.status} | published ${
        book.publication_date ? new Date(book.publication_date).toISOString().slice(0, 10) : 'N/A'
      } (${pubMonths ?? 'N/A'} months ago) | MRP Rs ${book.mrp}`,
      `Royalty/copy Rs ${book.royalty_per_copy} | sold ${book.copies_sold} | earned Rs ${book.royalty_earned.toLocaleString(
        'en-IN'
      )} | paid Rs ${book.royalty_paid.toLocaleString('en-IN')} | pending Rs ${book.royalty_pending.toLocaleString(
        'en-IN'
      )} | last payout: ${
        book.last_payout_date ? new Date(book.last_payout_date).toISOString().slice(0, 10) : 'none'
      }`,
      `Print partner: ${book.print_partner || 'In-House'} | Platforms listed: ${
        book.available_on?.length ? book.available_on.join(', ') : 'none'
      }`,
      `Checks (code): above Rs 1,000 threshold: ${aboveThreshold ? 'yes' : 'no'}${
        belowThreshold ? ' (below Rs 1,000 minimum, rolls over to next quarter)' : ''
      } | payout overdue: ${overdueRoyalty ? 'yes' : 'no'} | next payout deadline: ${
        payoutInfo.payoutDeadlineFormatted
      }`,
      `Missing data note: Bank-details status, printing cost, and per-platform sales breakdown are not in database context.`,
    ].join('\n');

    summaryLine = `For "${book.title}", your total royalty earned is Rs ${book.royalty_earned.toLocaleString(
      'en-IN'
    )}, paid is Rs ${book.royalty_paid.toLocaleString(
      'en-IN'
    )}, and pending is Rs ${book.royalty_pending.toLocaleString('en-IN')}${
      belowThreshold ? ' (which is below the Rs 1,000 minimum threshold and rolls over)' : ''
    }. The next payout deadline is ${payoutInfo.payoutDeadlineFormatted}.`;
  }

  return {
    authorFirstName,
    bookTitle: book.title,
    overdueRoyalty,
    belowThreshold,
    summaryLine,
    text,
  };
}

module.exports = { buildContextFacts };