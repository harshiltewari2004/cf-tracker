import {lazy,Suspense} from 'react';
import { createBrowserRouter } from "react-router-dom";

import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { GuestRoute } from "@/components/layout/GuestRoute";
import { RootRedirect } from "@/components/layout/RootRedirect";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { OnboardingLayout } from "@/components/layout/OnboardingLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingState } from '@/components/shared/LoadingState';
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import DashboardPage from "@/pages/DashboardPage";
import DailyPlanPage from "@/pages/DailyPlanPage";
import WeaknessPage from "@/pages/WeaknessPage";
import ContestsPage from "@/pages/ContestsPage";

import HandleEntryPage from "@/pages/HandleEntryPage";
import IngestProgressPage from "@/pages/IngestProgressPage";
import NotFoundPage from "@/pages/NotFoundPage";
import { RouteErrorFallback } from "./components/shared/RouteErrorFallback";
// eslint-disable-next-line react-refresh/only-export-components
const ContestDetailPage = lazy(() => import('@/pages/ContestDetailPage'));
// eslint-disable-next-line react-refresh/only-export-components
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
export const router = createBrowserRouter([
  
  
  {
    errorElement:<RouteErrorFallback/>,

    children: [
      { path: "/", element: <RootRedirect /> },
      {
         element: <GuestRoute />,
        children: [
        {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/signup", element: <SignupPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <OnboardingLayout />,
        children: [
          { path: "/onboarding/handle", element: <HandleEntryPage /> },
          { path: "/onboarding/ingesting", element: <IngestProgressPage /> },
        ],
      },
      {
        element: <AppLayout />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/plan", element: <DailyPlanPage /> },
          { path: "/weakness", element: <WeaknessPage /> },
          { path: "/contests", element: <ContestsPage /> },
          {
      path: '/contests/:cfContestId',
           element: (
            <Suspense fallback={<LoadingState />}>
              <ContestDetailPage />
            </Suspense>
      ),
},
{
          path: '/settings',
            element: (
            <Suspense fallback={<LoadingState />}>
              <SettingsPage />
            </Suspense>
  ),
},
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },

],
  },
]);