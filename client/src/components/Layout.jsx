import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMe, useLogout } from '../api/hooks';
import { useEvents } from '../realtime/useEvents';

export default function Layout() {
  const { data } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const user = data?.user;

  const { liveStatus, toastMessage, dismissToast } = useEvents(user);

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate('/login');
  };

  return (
    <div>
      <header className="navbar">
        <div className="navbar-brand">
          <span>🌿 LeafSync</span>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
            BookLeaf Support Portal
          </span>
        </div>

        {user && (
          <nav className="navbar-links">
            {user.role === 'author' ? (
              <>
                <NavLink to="/books" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  My Books
                </NavLink>
                <NavLink to="/tickets" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  My Tickets
                </NavLink>
                <NavLink to="/tickets/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  + Submit Query
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/admin/queue" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Ticket Queue
                </NavLink>
                <NavLink to="/admin/stats" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  Stats & AI Usage
                </NavLink>
              </>
            )}

            <span
              className={`badge ${liveStatus === 'live' ? 'badge-green' : 'badge-amber'}`}
              style={{ marginLeft: '8px' }}
              title={liveStatus === 'live' ? 'Connected via Server-Sent Events' : '15s Polling Fallback Active'}
            >
              ● {liveStatus === 'live' ? 'Live SSE' : 'Polling'}
            </span>

            <span className="badge badge-gray" style={{ marginLeft: '6px' }}>
              {user.role.toUpperCase()}
            </span>
            <button className="btn btn-outline" style={{ padding: '6px 12px', marginLeft: '6px' }} onClick={handleLogout}>
              Logout
            </button>
          </nav>
        )}
      </header>

      {/* Live Update Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: '#166534',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 1000,
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <span>⚡ {toastMessage}</span>
          <button
            type="button"
            onClick={dismissToast}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#dcfce7',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}