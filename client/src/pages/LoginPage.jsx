import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../api/hooks';

const DEMO_ACCOUNTS = [
  { label: 'Priya Sharma (Standard)', email: 'priya.sharma@email.com' },
  { label: 'Sneha Kulkarni (3 Books + Cover Design Stage)', email: 'sneha.kulkarni@email.com' },
  { label: 'Kavita Deshmukh (Rs 850 Rollover + Typesetting)', email: 'kavita.deshmukh@email.com' },
  { label: 'Ananya Reddy (Zero Payout / Pending)', email: 'ananya.reddy@email.com' },
  { label: 'Admin 1 (Operations)', email: 'admin1@bookleaf.demo' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('priya.sharma@email.com');
  const [password, setPassword] = useState('Password123');
  const [showDemoBox, setShowDemoBox] = useState(false);
  const login = useLogin();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await login.mutateAsync({ email, password });
      if (res.user.role === 'admin') {
        navigate('/admin/queue');
      } else {
        navigate('/books');
      }
    } catch {
      // Handled via login.error
    }
  };

  return (
    <div style={{ maxWidth: '460px', margin: '48px auto' }}>
      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: '6px' }}>Sign in to LeafSync</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 0, marginBottom: '20px' }}>
          BookLeaf Publishing Author & Operations Portal
        </p>

        {login.isError && (
          <div className="badge badge-red" style={{ display: 'block', padding: '10px', borderRadius: '6px', marginBottom: '16px' }}>
            {login.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={login.isPending}>
            {login.isPending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '20px 0' }} />

        {/* Professional Collapsible Toggle for Evaluators */}
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setShowDemoBox(!showDemoBox)}
            style={{
              background: 'none',
              border: 'none',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              textDecoration: 'underline'
            }}
          >
            {showDemoBox ? 'Hide Quick-Switch Demo Accounts ▲' : '⚡ Quick-Switch Demo Accounts (For Evaluators) ▼'}
          </button>

          {showDemoBox && (
            <div style={{ 
              marginTop: '12px', 
              padding: '12px', 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: '8px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '6px',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Click an account to auto-fill:
              </div>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="btn btn-outline"
                  style={{ justifyContent: 'space-between', fontSize: '0.78rem', padding: '6px 10px', background: '#fff' }}
                  onClick={() => setEmail(acc.email)}
                >
                  <span style={{ fontWeight: 500, color: '#1e293b' }}>{acc.label}</span>
                  <span style={{ color: '#64748b', fontSize: '0.72rem' }}>{acc.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}