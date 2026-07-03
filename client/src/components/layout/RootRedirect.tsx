import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoadingState } from '@/components/shared/LoadingState';

export const RootRedirect = () => {
  const status = useAuthStore((s) => s.status);

  if (status === 'resolving') return <LoadingState />;
  return <Navigate to={status === 'authenticated' ? '/dashboard' : '/login'} replace />;
};