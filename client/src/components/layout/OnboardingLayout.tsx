import { Outlet, useLocation } from 'react-router-dom';

const STEPS = ['/onboarding/handle', '/onboarding/ingesting'];

export const OnboardingLayout = () => {
  const { pathname } = useLocation();
  const currentStep = STEPS.indexOf(pathname) + 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <p className="mb-4 text-center text-sm text-slate-500">
          Step {currentStep} of {STEPS.length}
        </p>
        <Outlet />
      </div>
    </div>
  );
};