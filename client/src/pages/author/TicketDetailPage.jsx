import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTicketDetail, useAddTicketMessage } from '../../api/hooks';
import { statusBadgeClass } from './MyTicketsPage';

export default function TicketDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError, error } = useTicketDetail(id);
  const addMessage = useAddTicketMessage(id);
  const [replyBody, setReplyBody] = useState('');

  if (isLoading) return <div>Loading ticket conversation...</div>;
  if (isError) return <div className="badge badge-red">{error.message}</div>;

  const ticket = data?.ticket;
  if (!ticket) return <div>Ticket not found.</div>;

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    await addMessage.mutateAsync(replyBody);
    setReplyBody('');
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px' }}>
        <Link to="/tickets" style={{ fontSize: '0.9rem' }}>← Back to My Tickets</Link>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#166534', fontSize: '1.05rem' }}>{ticket.ticket_no}</span>
            <span className={statusBadgeClass(ticket.status)}>{ticket.status}</span>
            <span className="badge badge-gray">
              {ticket.book_title ? `${ticket.book_title} (${ticket.book_external_id})` : 'General / Account Level'}
            </span>
          </div>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Opened {new Date(ticket.created_at).toLocaleString('en-IN')}
          </span>
        </div>

        <h1 style={{ margin: '0 0 12px', fontSize: '1.35rem' }}>{ticket.subject}</h1>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ticket.description}</p>

        {ticket.attachments?.length > 0 && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', fontSize: '0.84rem' }}>
            <strong>Attached Files:</strong>{' '}
            {ticket.attachments.map((a) => `${a.filename} (${Math.round(a.size / 1024)} KB)`).join(', ')}
          </div>
        )}
      </div>

      {/* Conversation Thread */}
      <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>
        Conversation ({ticket.messages?.length || 0} replies)
      </h3>

      {(!ticket.messages || ticket.messages.length === 0) && (
        <div className="card" style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Our support team has received your ticket and will respond shortly. Any updates will appear here automatically.
        </div>
      )}

      {ticket.messages?.map((m) => {
        const isAdmin = m.sender_role === 'admin';
        return (
          <div key={m.id} className={`msg-bubble ${isAdmin ? 'msg-admin' : 'msg-author'}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
              <strong>
                {isAdmin ? `🌿 ${m.sender_name} (BookLeaf Support)` : `${m.sender_name} (Author)`}
              </strong>
              <span style={{ color: '#64748b' }}>
                {new Date(m.created_at).toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.94rem' }}>{m.body}</div>
          </div>
        );
      })}

      {/* Follow-up Reply Form */}
      {ticket.status !== 'Closed' ? (
        <div className="card" style={{ marginTop: '18px' }}>
          <form onSubmit={handleReply}>
            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label">
                Add a Follow-Up Reply
                {ticket.status === 'Resolved' && (
                  <span style={{ color: '#92400e', fontWeight: 500, marginLeft: '8px' }}>
                    (Replying will reopen this ticket to In Progress)
                  </span>
                )}
              </label>
              <textarea
                rows={3}
                className="form-control"
                placeholder="Write a follow-up message..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={addMessage.isPending}>
              {addMessage.isPending ? 'Sending...' : 'Send Reply'}
            </button>
          </form>
        </div>
      ) : (
        <div className="badge badge-gray" style={{ display: 'block', padding: '12px', textAlign: 'center' }}>
          This ticket is Closed and cannot receive new replies. Please raise a new query if you need further assistance.
        </div>
      )}
    </div>
  );
}