import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoadingState } from '@/components/shared/LoadingState';

export const ProtectedRoute = () => {
  const status = useAuthStore((s) => s.status);

  if (status === 'resolving') return <LoadingState />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  return <Outlet />;
};