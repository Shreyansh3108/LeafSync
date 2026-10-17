import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBooks, useCreateTicket } from '../../api/hooks';

export default function SubmitQueryPage() {
  const { data: booksData } = useBooks();
  const createTicket = useCreateTicket();
  const navigate = useNavigate();

  const [bookId, setBookId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);

  const books = booksData?.books || [];

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const mapped = files.slice(0, 5).map((f) => ({
      filename: f.name,
      size: f.size,
      mime: f.type || 'application/octet-stream',
    }));
    setAttachments(mapped);
  };

  const getFieldError = (fieldName) => {
    if (!createTicket.isError || !createTicket.error?.details) return null;
    const found = createTicket.error.details.find((d) => d.field === fieldName);
    return found ? found.issue : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        bookId: bookId === '' ? null : Number(bookId),
        subject,
        description,
        attachments,
      };
      const res = await createTicket.mutateAsync(payload);
      navigate(`/tickets/${res.ticket.id}`);
    } catch {
      // Inline errors displayed via createTicket.error
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/tickets" style={{ fontSize: '0.9rem' }}>← Back to My Tickets</Link>
      </div>

      <div className="card">
        <h1 style={{ marginTop: 0, fontSize: '1.4rem' }}>Submit a Support Query</h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 0, marginBottom: '20px' }}>
          Have a question regarding royalties, ISBN metadata, printing quality, or book production? Raise a ticket below and our operations team will assist you.
        </p>

        {createTicket.isError && (
          <div className="badge badge-red" style={{ display: 'block', padding: '10px 12px', borderRadius: '6px', marginBottom: '16px' }}>
            {createTicket.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Related Book</label>
            <select
              className="form-control"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
            >
              <option value="">General / Account Level</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.external_id} — {b.status})
                </option>
              ))}
            </select>
            {getFieldError('bookId') && <div className="field-error">{getFieldError('bookId')}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">
              Subject Line <span style={{ color: '#64748b', fontWeight: 400 }}>(5 to 120 characters)</span>
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g., Royalty payout status for Q3 or ISBN mismatch on Amazon"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span className="field-error">{getFieldError('subject')}</span>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{subject.length}/120</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Detailed Description <span style={{ color: '#64748b', fontWeight: 400 }}>(20 to 5,000 characters)</span>
            </label>
            <textarea
              rows={6}
              className="form-control"
              placeholder="Please describe your query in detail so our team can help you quickly..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span className="field-error">{getFieldError('description')}</span>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{description.length}/5000</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Attachments (Optional — UI Metadata Only)
            </label>
            <input
              type="file"
              multiple
              className="form-control"
              onChange={handleFileChange}
            />
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              Records file names and sizes with your ticket (UI-only demonstration mode).
            </div>

            {attachments.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '0.84rem' }}>
                {attachments.map((att, idx) => (
                  <li key={idx}>
                    {att.filename} ({Math.round(att.size / 1024)} KB)
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={createTicket.isPending}>
              {createTicket.isPending ? 'Submitting Ticket...' : 'Submit Support Ticket'}
            </button>
            <Link to="/tickets" className="btn btn-outline">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}