import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useAdminTicketDetail,
  usePatchAdminTicket,
  useSendAdminReply,
  useAddInternalNote,
  useTicketDraft,
  useRegenerateDraft,
  useReclassifyTicket,
} from '../../api/hooks';
import { statusBadgeClass } from '../author/MyTicketsPage';
import { priorityBadgeClass, computeAgeAndSlaChip } from './AdminQueuePage';

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

function formatRupees(val) {
  if (val === null || val === undefined) return '—';
  return `₹${Number(val).toLocaleString('en-IN')}`;
}

export default function AdminTicketDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError, error } = useAdminTicketDetail(id);
  const { data: draftData, isLoading: isDraftLoading } = useTicketDraft(id);

  const patchTicket = usePatchAdminTicket(id);
  const sendReply = useSendAdminReply(id);
  const addNote = useAddInternalNote(id);
  const regenerateDraft = useRegenerateDraft(id);
  const reclassify = useReclassifyTicket(id);

  const [replyText, setReplyText] = useState('');
  const [aiAssistedFlag, setAiAssistedFlag] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [overrideFeedback, setOverrideFeedback] = useState('');

  // Populate editor when AI draft arrives
  useEffect(() => {
    if (draftData?.draft && !replyText) {
      setReplyText(draftData.draft);
      setAiAssistedFlag(true);
    }
  }, [draftData]);

  if (isLoading) return <div>Loading ticket workspace...</div>;
  if (isError) return <div className="badge badge-red">{error.message}</div>;

  const ticket = data?.ticket;
  if (!ticket) return <div>Ticket not found.</div>;

  const slaChip = computeAgeAndSlaChip(ticket);
  const book = ticket.book;

  const handleFieldUpdate = async (payload, label) => {
    try {
      setOverrideFeedback('');
      await patchTicket.mutateAsync(payload);
      setOverrideFeedback(`Updated ${label} successfully.`);
      setTimeout(() => setOverrideFeedback(''), 3000);
    } catch {
      // Handled via patchTicket.error
    }
  };

  const handleRegenerate = async () => {
    const res = await regenerateDraft.mutateAsync();
    if (res.draft) {
      setReplyText(res.draft);
      setAiAssistedFlag(true);
    } else if (res.template) {
      setReplyText(res.template);
      setAiAssistedFlag(false);
    }
  };

  const handleUseTemplate = () => {
    if (draftData?.template) {
      setReplyText(draftData.template);
      setAiAssistedFlag(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    await sendReply.mutateAsync({
      body: replyText,
      aiAssisted: aiAssistedFlag,
    });
    setReplyText('');
    setAiAssistedFlag(false);
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await addNote.mutateAsync(noteText);
    setNoteText('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Link to="/admin/queue" style={{ fontSize: '0.9rem' }}>← Back to Ticket Queue</Link>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={slaChip.className}>{slaChip.label}</span>
          <span className={priorityBadgeClass(ticket.priority)}>{ticket.priority || 'Unscored'}</span>
          <span className={statusBadgeClass(ticket.status)}>{ticket.status}</span>
        </div>
      </div>

      {patchTicket.isError && (
        <div className="badge badge-red" style={{ display: 'block', padding: '10px', marginBottom: '12px' }}>
          {patchTicket.error.message}
        </div>
      )}

      {overrideFeedback && (
        <div className="badge badge-green" style={{ display: 'block', padding: '10px', marginBottom: '12px' }}>
          ✓ {overrideFeedback}
        </div>
      )}

      {/* Two-Column Operations Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* LEFT COLUMN: Original Query, Thread, and AI Draft Editor */}
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.84rem', color: '#64748b' }}>
              <span>
                <strong style={{ color: '#166534' }}>{ticket.ticket_no}</strong> · Submitted by <strong>{ticket.author_name}</strong>
              </span>
              <span>{new Date(ticket.created_at).toLocaleString('en-IN')}</span>
            </div>

            <h1 style={{ margin: '0 0 10px', fontSize: '1.3rem' }}>{ticket.subject}</h1>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ticket.description}</p>

            {ticket.attachments?.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                <strong>Attachments (UI Metadata):</strong>{' '}
                {ticket.attachments.map((a) => `${a.filename} (${Math.round(a.size / 1024)} KB)`).join(', ')}
              </div>
            )}
          </div>

          {/* Conversation Thread */}
          <h3 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
            Author-Visible Thread ({ticket.messages?.length || 0} messages)
          </h3>

          {ticket.messages?.map((m) => {
            const isAdmin = m.sender_role === 'admin';
            return (
              <div key={m.id} className={`msg-bubble ${isAdmin ? 'msg-admin' : 'msg-author'}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span>
                    <strong>{m.sender_name}</strong> ({m.sender_role.toUpperCase()})
                    {m.ai_assisted && (
                      <span className="badge badge-purple" style={{ marginLeft: '8px' }}>AI-Assisted</span>
                    )}
                  </span>
                  <span style={{ color: '#64748b' }}>{new Date(m.created_at).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{m.body}</div>
              </div>
            );
          })}

          {/* AI Draft & Reply Composer */}
          <div className="card" style={{ marginTop: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Reply to Author</h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  {draftData?.aiAvailable
                    ? `AI draft ready (${draftData.model}${draftData.cached ? ' · cached' : ''})`
                    : 'Manual / Canned Template Mode'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {draftData?.template && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    onClick={handleUseTemplate}
                  >
                    Insert Canned KB Template
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  disabled={regenerateDraft.isPending || isDraftLoading}
                  onClick={handleRegenerate}
                >
                  {regenerateDraft.isPending ? 'Regenerating...' : '↻ Regenerate AI Draft'}
                </button>
              </div>
            </div>

            {/* AI Unavailable Banner */}
            {draftData && !draftData.aiAvailable && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  <strong>AI Draft Unavailable ({draftData.reason || 'Offline'}):</strong> You can write a response manually or click &ldquo;Insert Canned KB Template&rdquo; above.
                </span>
              </div>
            )}

            <form onSubmit={handleSendReply}>
              <textarea
                rows={8}
                className="form-control"
                placeholder={isDraftLoading ? 'Generating AI draft from BookLeaf Knowledge Base...' : 'Review, edit, or write your response to the author...'}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={ticket.status === 'Closed'}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Human-in-the-loop: AI drafts are never sent without your review.
                </span>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sendReply.isPending || ticket.status === 'Closed'}
                >
                  {sendReply.isPending ? 'Sending...' : 'Approve & Send to Author'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Controls, Overrides, Context Card, Internal Notes, Audit Trail */}
        <div>
          {/* Ticket Management & AI Overrides Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Triage & Overrides</h3>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                onClick={() => handleFieldUpdate({ assignedTo: 'me' }, 'assignment')}
              >
                Assign to Me ({ticket.assigned_to_name || 'Unassigned'})
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Ticket Status</label>
              <select
                className="form-control"
                value={ticket.status}
                onChange={(e) => handleFieldUpdate({ status: e.target.value }, 'status')}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ margin: 0 }}>Category</label>
                <span className="badge badge-gray">Source: {ticket.category_source || 'pending'}</span>
              </div>
              <select
                className="form-control"
                value={ticket.category || ''}
                onChange={(e) => handleFieldUpdate({ category: e.target.value }, 'category override')}
              >
                <option value="" disabled>Select category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label className="form-label" style={{ margin: 0 }}>Priority Score</label>
                <span className="badge badge-gray">Source: {ticket.priority_source || 'pending'}</span>
              </div>
              <select
                className="form-control"
                value={ticket.priority || ''}
                onChange={(e) => handleFieldUpdate({ priority: e.target.value }, 'priority override')}
              >
                <option value="" disabled>Select priority...</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {ticket.ai_reason && (
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', color: '#475569', marginBottom: '10px' }}>
                <strong>AI Rationale ({Math.round((Number(ticket.ai_confidence) || 0) * 100)}% confidence):</strong> {ticket.ai_reason}
              </div>
            )}

            <button
              type="button"
              className="btn btn-outline"
              style={{ width: '100%', fontSize: '0.82rem' }}
              disabled={reclassify.isPending}
              onClick={() => reclassify.mutate()}
            >
              {reclassify.isPending ? 'Classifying...' : 'Re-run AI Classification'}
            </button>
          </div>

          {/* Author & Book Context Card */}
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Author & Book Context</h3>
            <div style={{ fontSize: '0.86rem', marginBottom: '10px' }}>
              <div><strong>Author:</strong> {ticket.author_name} ({ticket.author_external_id})</div>
              <div><strong>Email:</strong> {ticket.author_email}</div>
              <div><strong>City / Phone:</strong> {ticket.author_city} · {ticket.author_phone}</div>
            </div>

            {book ? (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                  📘 {book.title} ({book.external_id})
                </div>
                <div><strong>ISBN:</strong> {book.isbn} · <strong>Genre:</strong> {book.genre}</div>
                <div><strong>Status:</strong> {book.status}</div>
                {book.status.startsWith('In Production') ? (
                  <div className="badge badge-purple" style={{ marginTop: '6px' }}>
                    Production Stage: {book.production_stage} (Not Yet Published)
                  </div>
                ) : (
                  <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    <div><strong>MRP:</strong> {formatRupees(book.mrp)}</div>
                    <div><strong>Royalty/Copy:</strong> {formatRupees(book.royalty_per_copy)}</div>
                    <div><strong>Copies Sold:</strong> {book.copies_sold}</div>
                    <div><strong>Earned:</strong> {formatRupees(book.royalty_earned)}</div>
                    <div><strong>Paid:</strong> {formatRupees(book.royalty_paid)}</div>
                    <div><strong>Pending:</strong> <strong>{formatRupees(book.royalty_pending)}</strong></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Last Payout:</strong>{' '}
                      {book.last_payout_date
                        ? new Date(book.last_payout_date).toLocaleDateString('en-IN')
                        : 'Not yet paid'}
                    </div>
                    {book.royalty_pending > 0 && book.royalty_pending < 1000 && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span className="badge badge-amber">Below ₹1,000 minimum threshold (rolls over)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="badge badge-gray">General / Account-Level Query</div>
            )}
          </div>

          {/* Internal Notes Card (Distinct Yellow Style — Never Visible to Author) */}
          <div
            className="card"
            style={{
              background: '#fefce8',
              borderColor: '#fde047',
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#854d0e' }}>
              🔒 Internal Ops Notes (Admin Only)
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#a16207', marginTop: 0 }}>
              Stored in a separate table. Never visible to the author or included in AI prompts.
            </p>

            {ticket.internal_notes?.map((n) => (
              <div
                key={n.id}
                style={{
                  background: '#fef9c3',
                  border: '1px solid #fde047',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  marginBottom: '8px',
                  fontSize: '0.84rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#854d0e', marginBottom: '2px' }}>
                  <strong>{n.admin_name}</strong>
                  <span>{new Date(n.created_at).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
              </div>
            ))}

            <form onSubmit={handleAddNote}>
              <textarea
                rows={2}
                className="form-control"
                style={{ background: '#ffffff', marginBottom: '8px' }}
                placeholder="Add a private note for the operations team..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-outline" style={{ fontSize: '0.82rem' }} disabled={addNote.isPending}>
                {addNote.isPending ? 'Saving...' : 'Add Internal Note'}
              </button>
            </form>
          </div>

          {/* Audit Trail (ticket_events) */}
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Audit Trail (ticket_events)</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem' }}>
              {ticket.events?.map((ev) => (
                <div key={ev.id} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <strong>{ev.type}</strong>: {ev.from_value || '—'} → <strong>{ev.to_value}</strong>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.74rem' }}>
                    by {ev.actor_name} · {new Date(ev.created_at).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}