import { useRouteError } from 'react-router-dom';

export const RouteErrorFallback = () => {
  const error = useRouteError();
  console.error('Route render error caught by router boundary:', error);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        An unexpected error occurred. Reloading usually fixes it.
      </p>
      <button
        onClick={handleReload}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Reload
      </button>
    </div>
  );
};