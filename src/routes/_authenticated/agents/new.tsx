import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AgentForm } from "@/components/agents/AgentForm";
import { useSaveAgent } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/agents/new")({
  component: NewAgent,
});

function NewAgent() {
  const navigate = useNavigate();
  const save = useSaveAgent();

  return (
    <div className="space-y-5">
      <header className="animate-rise">
        <h1 className="text-2xl font-semibold sm:text-3xl">Add new agent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Employee ID and reference ID are generated automatically on save.
        </p>
      </header>
      <AgentForm
        saving={save.isPending}
        onSubmit={async (payload) => {
          try {
            const row = await save.mutateAsync({ values: payload as never });
            toast.success("Agent created successfully");
            void navigate({ to: "/agents/$agentId", params: { agentId: row.id } });
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not create agent");
          }
        }}
      />
    </div>
  );
}