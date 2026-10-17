import { useAdminStats, useAdminAiUsage } from '../../api/hooks';

export default function AdminStatsPage() {
  const { data: statsData, isLoading: loadingStats } = useAdminStats();
  const { data: usageData, isLoading: loadingUsage } = useAdminAiUsage();

  if (loadingStats || loadingUsage) return <div>Loading operational & AI telemetry...</div>;

  const stats = statsData?.stats || {};
  const usage = usageData?.usage || {};

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: '1.5rem' }}>Operations & AI Telemetry</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 0, marginBottom: '20px' }}>
        Real-time SLA monitoring, response velocity, and LLM token cost tracking.
      </p>

      {/* Top Operational Strip */}
      <div className="stats-strip">
        <div className="stat-box">
          <div className="stat-label">Overdue SLA Tickets</div>
          <div className="stat-value" style={{ color: stats.overdueCount > 0 ? '#991b1b' : '#166534' }}>
            {stats.overdueCount || 0}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Avg First Response</div>
          <div className="stat-value">
            {stats.avgFirstResponseMinutes !== null && stats.avgFirstResponseMinutes !== undefined
              ? `${stats.avgFirstResponseMinutes} mins`
              : '—'}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total AI Calls</div>
          <div className="stat-value">{usage.total_calls || 0}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Tokens (In / Out)</div>
          <div className="stat-value" style={{ fontSize: '1.2rem' }}>
            {(usage.total_tokens_in || 0).toLocaleString()} / {(usage.total_tokens_out || 0).toLocaleString()}
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-label">AI Failure / Fallback Rate</div>
          <div className="stat-value">{usage.failureRate || 0}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Tickets by Status</h3>
          {stats.byStatus?.map((row) => (
            <div key={row.status} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{row.status}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Tickets by Priority</h3>
          {stats.byPriority?.map((row) => (
            <div key={row.priority} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{row.priority}</span>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Recent AI Call Log Table */}
      <div className="card table-wrap" style={{ padding: 0 }}>
        <div style={{ padding: '16px 16px 8px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Recent AI Call Log (Cost & Latency Audit)</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Ticket ID</th>
              <th>Kind</th>
              <th>Provider / Model</th>
              <th>Tokens In / Out</th>
              <th>Latency</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {usage.recentCalls?.map((c) => (
              <tr key={c.id}>
                <td>#{c.id}</td>
                <td>{c.ticket_id ? `#${c.ticket_id}` : '—'}</td>
                <td><span className="badge badge-gray">{c.kind}</span></td>
                <td>{c.provider} · {c.model}</td>
                <td>{c.tokens_in || 0} / {c.tokens_out || 0}</td>
                <td>{c.latency_ms || 0} ms</td>
                <td>
                  {c.ok ? (
                    <span className="badge badge-green">OK</span>
                  ) : (
                    <span className="badge badge-amber">{c.error_code || 'FAILED'}</span>
                  )}
                </td>
                <td>{new Date(c.created_at).toLocaleTimeString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}