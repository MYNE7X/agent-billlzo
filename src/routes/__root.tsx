import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  // Detect missing Supabase env vars — show a helpful setup message instead of
  // the generic "Something went wrong" error.
  const isMissingEnvVars =
    error?.message?.includes("Missing Supabase environment variable") ||
    error?.message?.includes("Connect Supabase in Lovable Cloud");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        {isMissingEnvVars ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Supabase not configured
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The app can't connect to Supabase because the environment variables are missing.
              Create a <code className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-xs">.env</code> file
              in the project root with your Supabase URL and publishable key, then restart the dev server.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-border/40 bg-secondary/30 p-3 text-left text-[11px] text-muted-foreground">
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...`}
            </pre>
            <p className="mt-3 text-xs text-muted-foreground/60">
              See <code className="font-mono">.env.example</code> for the full template.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              This page didn't load
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Something went wrong on our end. You can try refreshing or head back home.
            </p>
            <details className="mt-3 text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground/60 hover:text-muted-foreground">
                Show error details
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-border/40 bg-secondary/30 p-3 text-[10px] text-muted-foreground">
                {error?.message ?? String(error)}
              </pre>
            </details>
          </>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
