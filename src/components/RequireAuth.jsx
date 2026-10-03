import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

// Pages wrapped in this need a signed-in user with a finished profile.
export default function RequireAuth({ children }) {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <p className="pad muted">Loading…</p>;
  if (!user) return <Navigate to="/signin" state={{ from: loc.pathname + loc.search }} replace />;
  if (!profile) return <Navigate to="/welcome" state={{ from: loc.pathname + loc.search }} replace />;
  return children;
}
