import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import RequireRole from './auth/RequireRole';
import LoginPage from './pages/LoginPage';
import MyBooksPage from './pages/author/MyBooksPage';
import SubmitQueryPage from './pages/author/SubmitQueryPage';
import MyTicketsPage from './pages/author/MyTicketsPage';
import TicketDetailPage from './pages/author/TicketDetailPage';
import AdminQueuePage from './pages/admin/AdminQueuePage';
import AdminTicketDetailPage from './pages/admin/AdminTicketDetailPage';
import AdminStatsPage from './pages/admin/AdminStatsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<LoginPage />} />

        {/* Author Portal Routes */}
        <Route element={<RequireRole role="author" />}>
          <Route path="/books" element={<MyBooksPage />} />
          <Route path="/tickets" element={<MyTicketsPage />} />
          <Route path="/tickets/new" element={<SubmitQueryPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Route>

        {/* Admin Portal Routes */}
        <Route element={<RequireRole role="admin" />}>
          <Route path="/admin/queue" element={<AdminQueuePage />} />
          <Route path="/admin/tickets/:id" element={<AdminTicketDetailPage />} />
          <Route path="/admin/stats" element={<AdminStatsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/books" replace />} />
      </Route>
    </Routes>
  );
}