import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTickets } from '../../api/hooks';

const STATUS_OPTIONS = ['', 'Open', 'In Progress', 'Resolved', 'Closed'];

export function statusBadgeClass(status) {
  switch (status) {
    case 'Open':
      return 'badge badge-blue';
    case 'In Progress':
      return 'badge badge-amber';
    case 'Resolved':
      return 'badge badge-green';
    case 'Closed':
      return 'badge badge-gray';
    default:
      return 'badge badge-gray';
  }
}

export default function MyTicketsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading, isError, error } = useTickets(statusFilter);

  const tickets = data?.tickets || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>My Support Tickets</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.92rem' }}>
            View your submitted queries and real-time responses from BookLeaf Operations.
          </p>
        </div>
        <Link to="/tickets/new" className="btn btn-primary">
          + Submit a Query
        </Link>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map((st) => (
          <button
            key={st || 'ALL'}
            type="button"
            className={`btn ${statusFilter === st ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '6px 14px', fontSize: '0.84rem' }}
            onClick={() => setStatusFilter(st)}
          >
            {st || 'All Tickets'}
          </button>
        ))}
      </div>

      {isLoading && <div>Loading tickets...</div>}
      {isError && <div className="badge badge-red">{error.message}</div>}

      {!isLoading && tickets.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '44px 20px' }}>
          <h3 style={{ marginTop: 0 }}>No support tickets found</h3>
          <p style={{ color: '#64748b', maxWidth: '420px', margin: '0 auto 18px' }}>
            You haven&apos;t raised any support queries matching this filter yet. Need help with your books or royalties?
          </p>
          <Link to="/tickets/new" className="btn btn-primary">
            Submit Your First Support Query
          </Link>
        </div>
      )}

      {tickets.map((t) => (
        <Link
          key={t.id}
          to={`/tickets/${t.id}`}
          className="card"
          style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 700, color: '#166534' }}>{t.ticket_no}</span>
              <span className={statusBadgeClass(t.status)}>{t.status}</span>
              <span className="badge badge-gray">
                {t.book_title ? `${t.book_title} (${t.book_external_id})` : 'General / Account Level'}
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Created {new Date(t.created_at).toLocaleString('en-IN')}
            </span>
          </div>

          <div style={{ fontWeight: 600, fontSize: '1.02rem', marginBottom: '4px' }}>
            {t.subject}
          </div>
          <div style={{ fontSize: '0.88rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.description}
          </div>
        </Link>
      ))}
    </div>
  );
}