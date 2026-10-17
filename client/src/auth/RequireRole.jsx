import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../api/hooks';

export default function RequireRole({ role }) {
  const { data, isLoading, isError } = useMe();

  if (isLoading) {
    return <div className="container">Checking session...</div>;
  }

  if (isError || !data?.user) {
    return <Navigate to="/login" replace />;
  }

  if (role && data.user.role !== role) {
    const fallback = data.user.role === 'admin' ? '/admin/queue' : '/books';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet context={{ user: data.user }} />;
}