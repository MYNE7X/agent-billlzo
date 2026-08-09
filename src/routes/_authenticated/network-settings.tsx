import { createFileRoute } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
import { AllowedNetworksPanel, ViolationsLogPanel } from "@/components/admin/NetworkSettings";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/network-settings")({
  component: NetworkSettingsPage,
});

function NetworkSettingsPage() {
  const { isStaff } = useAuth();

  if (!isStaff) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Wifi className="size-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">You don't have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <h1 className="flex items-center gap-3 text-2xl font-semibold sm:text-3xl">
          <Wifi className="size-7 text-primary" />
          Network &amp; Attendance Security
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Restrict agent clock-in to approved office networks only. Add your office router's public
          IP to allow clock-in. Use the{" "}
          <span className="font-medium text-primary/80">Auto-detect</span> button while connected to
          the office WiFi (HMR / HMR 5G) to find the correct IP.
        </p>
      </header>

      <AllowedNetworksPanel />
      <ViolationsLogPanel />
    </div>
  );
}
