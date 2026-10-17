import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminQueue } from '../../api/hooks';
import { statusBadgeClass } from '../author/MyTicketsPage';

const SLA_HOURS = {
  Critical: 4,
  High: 24,
  Medium: 48,
  Low: 72,
};

const CATEGORIES = [
  'Royalty & Payments',
  'ISBN & Metadata Issues',
  'Printing & Quality',
  'Distribution & Availability',
  'Book Status & Production Updates',
  'General Inquiry',
];

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

export function priorityBadgeClass(priority) {
  switch (priority) {
    case 'Critical':
      return 'badge badge-red';
    case 'High':
      return 'badge badge-amber';
    case 'Medium':
      return 'badge badge-blue';
    case 'Low':
      return 'badge badge-gray';
    default:
      return 'badge badge-gray';
  }
}

export function computeAgeAndSlaChip(ticket) {
  const createdMs = new Date(ticket.created_at).getTime();
  const elapsedHours = Math.max(0, (Date.now() - createdMs) / (1000 * 60 * 60));
  const ageText =
    elapsedHours < 1
      ? `${Math.max(1, Math.round(elapsedHours * 60))}m`
      : elapsedHours < 48
      ? `${Math.round(elapsedHours)}h`
      : `${Math.round(elapsedHours / 24)}d`;

  if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
    return { className: 'badge badge-gray', label: `${ageText} ago` };
  }

  const targetHours = SLA_HOURS[ticket.priority] || 48;
  const ratio = elapsedHours / targetHours;

  if (ratio >= 1) {
    return { className: 'badge badge-red', label: `Overdue · ${ageText}` };
  }
  if (ratio >= 0.5) {
    return { className: 'badge badge-amber', label: `SLA Warning · ${ageText}` };
  }
  return { className: 'badge badge-green', label: `Age: ${ageText}` };
}

export default function AdminQueuePage() {
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
    assignedTo: '',
    from: '',
    to: '',
    q: '',
    page: 1,
  });

  const { data, isLoading, isError, error } = useAdminQueue(filters);

  const tickets = data?.tickets || [];
  const total = data?.total || 0;
  const limit = data?.limit || 25;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const resetFilters = () => {
    setFilters({
      status: '',
      category: '',
      priority: '',
      assignedTo: '',
      from: '',
      to: '',
      q: '',
      page: 1,
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Operations Ticket Queue</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Sorted by unresolved urgency first (Critical → Low), then oldest waiting tickets first.
          </p>
        </div>
        <div className="badge badge-gray" style={{ fontSize: '0.88rem', padding: '6px 12px' }}>
          Total Matching: {total}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div>
            <label className="form-label">Search</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ticket #, subject, author..."
              value={filters.q}
              onChange={(e) => updateFilter('q', e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Status</label>
            <select
              className="form-control"
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Priority</label>
            <select
              className="form-control"
              value={filters.priority}
              onChange={(e) => updateFilter('priority', e.target.value)}
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Category</label>
            <select
              className="form-control"
              value={filters.category}
              onChange={(e) => updateFilter('category', e.target.value)}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Assignment</label>
            <select
              className="form-control"
              value={filters.assignedTo}
              onChange={(e) => updateFilter('assignedTo', e.target.value)}
            >
              <option value="">Anyone</option>
              <option value="me">Assigned to Me</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>

          <div>
            <label className="form-label">From Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.from}
              onChange={(e) => updateFilter('from', e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">To Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.to}
              onChange={(e) => updateFilter('to', e.target.value)}
            />
          </div>

          <div>
            <button type="button" className="btn btn-outline" style={{ width: '100%' }} onClick={resetFilters}>
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {isLoading && <div>Loading ticket queue...</div>}
      {isError && <div className="badge badge-red">{error.message}</div>}

      {!isLoading && tickets.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
          No tickets match the selected filters.
        </div>
      )}

      {tickets.length > 0 && (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Author & Book</th>
                <th>Category & AI Source</th>
                <th>Priority</th>
                <th>Status</th>
                <th>SLA / Age</th>
                <th>Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const slaChip = computeAgeAndSlaChip(t);
                const isEditedByAdmin =
                  t.category_source === 'admin' || t.priority_source === 'admin';
                const isFallback =
                  t.category_source === 'fallback' || t.priority_source === 'fallback' || t.ai_state === 'failed';

                return (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/admin/tickets/${t.id}`} style={{ fontWeight: 700 }}>
                        {t.ticket_no}
                      </Link>
                      <div style={{ fontWeight: 600, marginTop: '2px' }}>
                        <Link to={`/admin/tickets/${t.id}`} style={{ color: '#0f172a' }}>
                          {t.subject}
                        </Link>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: 600 }}>{t.author_name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {t.book_title ? `${t.book_title} (${t.book_external_id})` : 'General / Account Level'}
                      </div>
                    </td>

                    <td>
                      <div>{t.category || 'Unclassified'}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {t.ai_state === 'pending' && (
                          <span className="badge badge-purple">AI Pending</span>
                        )}
                        {isEditedByAdmin && (
                          <span className="badge badge-blue">Edited by Admin</span>
                        )}
                        {!isEditedByAdmin && t.ai_state === 'done' && (
                          <span className="badge badge-green">
                            AI ({Math.round((Number(t.ai_confidence) || 0) * 100)}%)
                          </span>
                        )}
                        {isFallback && !isEditedByAdmin && (
                          <span className="badge badge-amber">Fallback · Needs Review</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className={priorityBadgeClass(t.priority)}>
                        {t.priority || 'Pending'}
                      </span>
                    </td>

                    <td>
                      <span className={statusBadgeClass(t.status)}>{t.status}</span>
                    </td>

                    <td>
                      <span className={slaChip.className}>{slaChip.label}</span>
                    </td>

                    <td>
                      {t.assigned_to_name ? (
                        <span className="badge badge-gray">{t.assigned_to_name}</span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Unassigned</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Page {filters.page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={filters.page <= 1}
              onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}