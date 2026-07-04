import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { LoadingState } from '@/components/shared/LoadingState';

export const RootRedirect = () => {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  if (status === 'resolving') return <LoadingState />;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
   return user?.onboardingCompleted ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/onboarding/handle" replace />
  );
};