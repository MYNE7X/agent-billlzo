import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Lock, Unlock, Pencil, Check, X } from "lucide-react";

import { AgentForm } from "@/components/agents/AgentForm";
import { DocumentManager } from "@/components/agents/DocumentManager";
import { EmployeeCardPrint } from "@/components/agents/EmployeeCardPrint";
import { LinkAccountPanel } from "@/components/agents/LinkAccountPanel";
import { MonthlySalesPanel } from "@/components/agents/MonthlySalesPanel";
import { SalaryManagementPanel } from "@/components/agents/SalaryManagementPanel";
import { SetPasswordPanel } from "@/components/agents/SetPasswordPanel";
import { StatusBadge } from "@/components/billzo/StatusBadge";
import { SecureImage } from "@/components/billzo/SecureImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgent, useSaveAgent, useToggleEmployeeIdLock, logEdit } from "@/lib/queries";
import { removeAgentFile } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/billzo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/agents/$agentId")({
  component: AgentDetail,
});

function AgentDetail() {
  const { agentId } = useParams({ from: "/_authenticated/agents/$agentId" });
  const { user, isStaff, isSuperAdmin } = useAuth();
  const { data: agent, isLoading, refetch } = useAgent(agentId);
  const save = useSaveAgent();
  const toggleLock = useToggleEmployeeIdLock();
  const [deletingPic, setDeletingPic] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState(false);
  const [empIdValue, setEmpIdValue] = useState("");

  async function handleDeleteProfilePic() {
    if (!agent?.profile_picture_url) return;
    if (!confirm(`Delete ${agent.full_name}'s profile picture? This cannot be undone.`)) return;
    setDeletingPic(true);
    try {
      await removeAgentFile(agent.profile_picture_url);
      await save.mutateAsync({ id: agentId, values: { profile_picture_url: null } as never });
      toast.success("Profile picture deleted");
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete picture");
    } finally {
      setDeletingPic(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="size-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!agent) return <p className="text-sm text-muted-foreground">Agent not found.</p>;

  return (
    <div className="space-y-5 animate-rise">
      {/* header */}
      <header className="flex items-center gap-4">
        {/* avatar with optional delete button for super admins */}
        <div className="relative shrink-0">
          {agent.profile_picture_url ? (
            <div className="size-14 overflow-hidden rounded-full ring-2 ring-primary/25 ring-offset-2 ring-offset-background">
              <SecureImage
                path={agent.profile_picture_url}
                alt={agent.full_name}
                className="size-full object-cover"
              />
            </div>
          ) : (
            <Avatar className="size-14 ring-2 ring-primary/25 ring-offset-2 ring-offset-background">
              <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
                {initials(agent.full_name)}
              </AvatarFallback>
            </Avatar>
          )}
          {/* Super Admin: delete profile picture button */}
          {isSuperAdmin && agent.profile_picture_url && (
            <Button
              size="sm"
              variant="destructive"
              className="absolute -bottom-1 -right-1 size-6 rounded-full p-0 shadow-lg"
              title="Delete profile picture"
              disabled={deletingPic}
              onClick={handleDeleteProfilePic}
            >
              <Trash2 className="size-3" />
            </Button>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{agent.full_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {/* Editable Employee ID */}
            {editingEmpId ? (
              <div className="flex items-center gap-1">
                <Input
                  value={empIdValue}
                  onChange={(e) => setEmpIdValue(e.target.value)}
                  className="h-7 w-32 font-mono text-xs"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-emerald-400 hover:bg-emerald-500/15"
                  onClick={async () => {
                    try {
                      await save.mutateAsync({ id: agentId, values: { employee_id: empIdValue } as never });
                      toast.success("Employee ID updated");
                      setEditingEmpId(false);
                      void refetch();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not update Employee ID");
                    }
                  }}
                >
                  <Check className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-muted-foreground hover:bg-secondary"
                  onClick={() => setEditingEmpId(false)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-muted-foreground">
                  {agent.employee_id} · {agent.reference_id}
                </span>
                {/* Edit button — staff can edit when unlocked, super_admin can always toggle lock */}
                {isStaff && !agent.employee_id_locked && (
                  <button
                    onClick={() => {
                      setEmpIdValue(agent.employee_id);
                      setEditingEmpId(true);
                    }}
                    className="grid size-5 place-items-center rounded text-muted-foreground/40 transition-colors hover:bg-primary/15 hover:text-primary"
                    title="Edit Employee ID"
                  >
                    <Pencil className="size-3" />
                  </button>
                )}
                {/* Lock indicator + toggle (super_admin only) */}
                {isSuperAdmin && (
                  <button
                    onClick={async () => {
                      try {
                        await toggleLock.mutateAsync({ agentId, locked: !agent.employee_id_locked });
                        toast.success(agent.employee_id_locked ? "Employee ID unlocked" : "Employee ID locked");
                        void refetch();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not toggle lock");
                      }
                    }}
                    className={cn(
                      "grid size-5 place-items-center rounded transition-colors",
                      agent.employee_id_locked
                        ? "text-amber-400 hover:bg-amber-500/15"
                        : "text-muted-foreground/30 hover:bg-secondary",
                    )}
                    title={agent.employee_id_locked ? "Locked — click to unlock (Super Admin)" : "Unlocked — click to lock"}
                  >
                    {agent.employee_id_locked ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                  </button>
                )}
              </div>
            )}
            <StatusBadge value={agent.status} />
          </div>
        </div>
      </header>

      <Tabs defaultValue="profile">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            {isStaff && <TabsTrigger value="salary">Salary</TabsTrigger>}
            {isStaff && <TabsTrigger value="sales">Monthly Sales</TabsTrigger>}
            {isStaff && <TabsTrigger value="account">Link Account</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="login">Login / Password</TabsTrigger>}
            {isStaff && <TabsTrigger value="idcard">ID Card</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-4">
          <AgentForm
            agent={agent}
            saving={save.isPending}
            readOnlyEmployment={!isStaff}
            onSubmit={async (payload) => {
              try {
                await save.mutateAsync({ id: agentId, values: payload as never });
                toast.success("Profile updated");
                // Log the edit for the history bubble
                logEdit({
                  entityType: "agent_profile",
                  entityId: agentId,
                  section: "profile",
                  editedBy: user?.id ?? null,
                });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save changes");
              }
            }}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentManager agentId={agentId} />
        </TabsContent>

        {isStaff && (
          <TabsContent value="salary" className="mt-4">
            <div className="glass rounded-xl p-5">
              <div className="mb-5">
                <h2 className="font-semibold">Salary Management</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Set base salary, add deductions (with remarks) and bonuses per month.
                </p>
              </div>
              <SalaryManagementPanel agentId={agentId} baseSalary={agent.salary} />
            </div>
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="sales" className="mt-4">
            <div className="glass rounded-xl p-5">
              <div className="mb-5">
                <h2 className="font-semibold">Monthly Sales</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Track and manage this agent's monthly sales figures.
                </p>
              </div>
              <MonthlySalesPanel agentId={agentId} />
            </div>
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="account" className="mt-4">
            <div className="glass rounded-xl p-5">
              <div className="mb-4">
                <h2 className="font-semibold">Link User Account</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Connect a registered user to this agent so they can log in and view their own profile, attendance, and salary.
                </p>
              </div>
              <LinkAccountPanel
                agentId={agentId}
                currentUserId={agent.user_id}
              />
            </div>
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="login" className="mt-4">
            <div className="glass rounded-xl p-5">
              <div className="mb-4">
                <h2 className="font-semibold">Login Account & Password</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {agent.user_id
                    ? "This agent has a linked account. You can force a temporary password reset."
                    : "Create a login account for this agent with a temporary password. They will be required to set a new password on first login."}
                </p>
              </div>
              <SetPasswordPanel
                agentId={agentId}
                agentEmail={agent.email}
                agentName={agent.full_name}
                currentUserId={agent.user_id}
                onAccountCreated={() => void refetch()}
              />
            </div>
          </TabsContent>
        )}

        {isStaff && (
          <TabsContent value="idcard" className="mt-4">
            <div className="glass rounded-xl p-5">
              <div className="mb-5">
                <h2 className="font-semibold">Employee ID Card</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Preview and print this agent's official ID card.
                </p>
              </div>
              <EmployeeCardPrint
                agent={{
                  id: agent.id,
                  full_name: agent.full_name,
                  employee_id: agent.employee_id,
                  reference_id: agent.reference_id,
                  profile_picture_url: agent.profile_picture_url,
                  designation: (agent as unknown as { designations?: { name?: string } }).designations?.name,
                  department: (agent as unknown as { departments?: { name?: string } }).departments?.name,
                  employee_type: agent.employee_type,
                  phone_number: agent.phone_number,
                  email: agent.email,
                  joining_date: agent.joining_date,
                  gender: agent.gender,
                  status: agent.status,
                  blood_group: agent.blood_group,
                  cnic_number: agent.cnic_number,
                }}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
