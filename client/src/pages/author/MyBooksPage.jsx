import { Link } from 'react-router-dom';
import { useBooks } from '../../api/hooks';

function formatRupees(val) {
  if (val === null || val === undefined) return '—';
  return `₹${Number(val).toLocaleString('en-IN')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function MyBooksPage() {
  const { data, isLoading, isError, error } = useBooks();

  if (isLoading) return <div>Loading your books...</div>;
  if (isError) return <div className="badge badge-red">{error.message}</div>;

  const books = data?.books || [];

  const totals = books.reduce(
    (acc, b) => {
      acc.copies += b.copies_sold || 0;
      acc.earned += b.royalty_earned || 0;
      acc.paid += b.royalty_paid || 0;
      acc.pending += b.royalty_pending || 0;
      return acc;
    },
    { copies: 0, earned: 0, paid: 0, pending: 0 }
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>My Books</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.92rem' }}>
            Track your publication status, sales figures, and quarterly royalty payouts.
          </p>
        </div>
        <Link to="/tickets/new" className="btn btn-primary">
          Raise a Support Query
        </Link>
      </div>

      {/* Totals Strip */}
      <div className="stats-strip">
        <div className="stat-box">
          <div className="stat-label">Total Books</div>
          <div className="stat-value">{books.length}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Copies Sold</div>
          <div className="stat-value">{totals.copies.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Royalty Earned</div>
          <div className="stat-value">{formatRupees(totals.earned)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Royalty Paid</div>
          <div className="stat-value" style={{ color: '#166534' }}>{formatRupees(totals.paid)}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Royalty Pending</div>
          <div className="stat-value" style={{ color: '#92400e' }}>{formatRupees(totals.pending)}</div>
        </div>
      </div>

      {/* Books Table */}
      <div className="card table-wrap" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Book Details</th>
              <th>Status</th>
              <th>Pub. Date</th>
              <th>MRP / Royalty</th>
              <th>Copies Sold</th>
              <th>Royalty Earned</th>
              <th>Royalty Paid</th>
              <th>Royalty Pending</th>
              <th>Distribution & Print</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => {
              const isInProduction = book.status.startsWith('In Production');
              const isZeroPayout = !isInProduction && book.royalty_paid === 0 && book.royalty_earned > 0;
              const isBelowThreshold = !isInProduction && book.royalty_pending > 0 && book.royalty_pending < 1000;
              const isSettled = !isInProduction && book.royalty_pending === 0 && book.royalty_earned > 0;

              return (
                <tr key={book.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{book.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>ISBN: {book.isbn}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{book.genre} ({book.external_id})</div>
                  </td>

                  <td>
                    {isInProduction ? (
                      <div>
                        <span className="badge badge-purple">In Production</span>
                        {book.production_stage && (
                          <div style={{ marginTop: '4px' }}>
                            <span className="badge badge-amber">Stage: {book.production_stage}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="badge badge-green">{book.status}</span>
                    )}
                  </td>

                  <td>{formatDate(book.publication_date)}</td>

                  <td>
                    <div>MRP: <strong>{formatRupees(book.mrp)}</strong></div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Royalty/copy: {formatRupees(book.royalty_per_copy)}
                    </div>
                  </td>

                  <td>
                    {isInProduction ? '—' : book.copies_sold.toLocaleString('en-IN')}
                  </td>

                  <td>
                    {isInProduction ? '—' : <strong>{formatRupees(book.royalty_earned)}</strong>}
                  </td>

                  <td>
                    {isInProduction ? (
                      '—'
                    ) : (
                      <div>
                        <div>{formatRupees(book.royalty_paid)}</div>
                        {isZeroPayout ? (
                          <span className="badge badge-amber" style={{ marginTop: '4px' }}>
                            Not yet paid
                          </span>
                        ) : book.last_payout_date ? (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                            Last: {formatDate(book.last_payout_date)}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>

                  <td>
                    {isInProduction ? (
                      '—'
                    ) : (
                      <div>
                        <div style={{ fontWeight: 700 }}>{formatRupees(book.royalty_pending)}</div>
                        {isBelowThreshold && (
                          <div style={{ marginTop: '4px' }}>
                            <span className="badge badge-amber">
                              Below ₹1,000 minimum, rolls over
                            </span>
                          </div>
                        )}
                        {isSettled && (
                          <div style={{ marginTop: '4px' }}>
                            <span className="badge badge-green">Settled</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td>
                    <div style={{ fontSize: '0.8rem' }}>
                      <strong>Print:</strong> {book.print_partner || '—'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                      {book.available_on?.length > 0 ? book.available_on.join(', ') : '—'}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}