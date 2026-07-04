import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoadingState } from '@/components/shared/LoadingState';

export const GuestRoute = () => {
  const status = useAuthStore((s) => s.status);

  if (status === 'resolving') return <LoadingState />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  
  return <Outlet />;
};