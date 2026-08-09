import { useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ShieldCheck,
  UserCircle,
  LogOut,
  Building2,
  UserCog,
  Zap,
  Receipt,
  Wifi,
  BarChart3,
  X,
  ChevronRight,
  Home,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { initials, labelize } from "@/lib/billzo";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  shortLabel?: string;
  icon: typeof Users;
  staffOnly?: boolean;
  superOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { to: "/attendance", label: "Attendance", shortLabel: "Punch", icon: CalendarCheck, staffOnly: true },
  { to: "/reports", label: "Reports", shortLabel: "Reports", icon: BarChart3 },
  { to: "/agents", label: "Agents", shortLabel: "Agents", icon: Users, staffOnly: true },
  { to: "/expenses", label: "Expenses", shortLabel: "Expenses", icon: Receipt, staffOnly: true },
  { to: "/pending-approvals", label: "Pending", shortLabel: "Pending", icon: UserCog, staffOnly: true },
  { to: "/network-settings", label: "Network", shortLabel: "Network", icon: Wifi, staffOnly: true },
  { to: "/admins", label: "Admins", shortLabel: "Admins", icon: ShieldCheck, superOnly: true },
  { to: "/my-profile", label: "Profile", shortLabel: "Me", icon: UserCircle },
];

// ── desktop sidebar (single source of truth) ───────────────────────────────

function SidebarNav({
  items,
  primaryRole,
  profile,
  onNavigate,
  onSignOut,
}: {
  items: NavItem[];
  primaryRole: "super_admin" | "admin" | "agent";
  profile: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
  onNavigate?: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Brand */}
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-secondary/40"
      >
        <span className="relative grid size-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/90 to-emerald-500/80 shadow-lg shadow-primary/20">
          <Building2 className="size-5 text-background" />
          <span className="absolute inset-0 ring-1 ring-inset ring-white/20" />
        </span>
        <span>
          <span className="font-display block text-lg font-bold leading-tight text-gradient">
            Billzo
          </span>
          <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Office System
          </span>
        </span>
      </Link>

      {/* Primary nav — banking-style grouped list */}
      <nav className="no-scrollbar no-scrollbar-webkit -mx-1 flex-1 overflow-y-auto px-1 py-2">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
          Menu
        </p>
        <div className="space-y-0.5">
          {items.map((item, idx) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              activeProps={{ className: "is-active" }}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                idx === 0 && "mt-0",
              )}
            >
              {/* active indicator bar (left) */}
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary opacity-0 transition-opacity duration-200 [.is-active_&]:opacity-100" />
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary/40 text-muted-foreground transition-all duration-200 group-hover:bg-primary/15 group-hover:text-primary [.is-active_&]:bg-primary/15 [.is-active_&]:text-primary">
                <item.icon className="size-4" />
              </span>
              <span className="flex-1 [.is-active_&]:text-foreground">{item.label}</span>
              <ChevronRight className="size-3.5 text-muted-foreground/30 [.is-active_&]:text-primary/60" />
            </Link>
          ))}
        </div>
      </nav>

      {/* Creator signature */}
      <CreatorBadge />

      {/* Account card */}
      <div className="rounded-2xl border border-border/50 bg-secondary/30 p-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 ring-2 ring-primary/20 ring-offset-1 ring-offset-background">
            <AvatarFallback className="bg-primary/20 text-xs font-bold text-primary">
              {initials(profile?.full_name ?? profile?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile?.full_name ?? "User"}</p>
            <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {labelize(primaryRole)}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onSignOut}
        >
          <LogOut className="size-3.5" /> Sign out
        </Button>
      </div>
    </div>
  );
}

/** Compact creator signature */
function CreatorBadge() {
  return (
    <div
      className="relative overflow-hidden rounded-xl px-3 py-2.5"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--primary)/0.08) 0%, hsl(var(--primary)/0.04) 100%)",
        boxShadow: "inset 0 0 0 1px hsl(var(--primary)/0.15)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--primary)/0.6) 35%, hsl(160 70% 55%/0.6) 65%, transparent 100%)",
        }}
      />
      <div className="relative flex items-center gap-2.5">
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 rounded-lg blur-md opacity-60"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(160 70% 50%))" }}
          />
          <div
            className="relative grid size-8 place-items-center rounded-lg"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)/0.9), hsl(160 70% 45%/0.9))",
            }}
          >
            <Zap className="size-3.5 text-background fill-background" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
            Crafted by
          </p>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-sm font-bold leading-tight"
              style={{
                background: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(160 70% 60%) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Aziz
            </span>
            <span className="font-mono text-[10px] font-semibold text-muted-foreground/50">
              · Myne7x
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── main shell ─────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, roles, isSuperAdmin, isStaff, signOut } = useAuth();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const items = NAV.filter((i) => (!i.staffOnly || isStaff) && (!i.superOnly || isSuperAdmin));
  const primaryRole: "super_admin" | "admin" | "agent" = roles.includes("super_admin")
    ? "super_admin"
    : roles.includes("admin")
      ? "admin"
      : "agent";

  // Bottom tab bar — banking app style:
  // 4 fixed slots: Home, second-action, Reports, Me  (and a "more" if extra items exist)
  // Order matters: Home is always first, Me is always last.
  const profileItem = items.find((i) => i.to === "/my-profile")!;
  const dashboardItem = items.find((i) => i.to === "/dashboard")!;
  const reportsItem = items.find((i) => i.to === "/reports");
  const middleItems = items.filter(
    (i) => i.to !== "/my-profile" && i.to !== "/dashboard" && i.to !== "/reports",
  );

  // Build a fixed 4-or-5 slot bottom bar.
  // Slot 1: Home
  // Slot 2: Reports (if available) OR first middle item
  // Slot 3: A middle item OR More (if extra items)
  // Slot 4 (last): Me (Profile)
  const bottomSlots: (NavItem | { isMore: true })[] = [];
  bottomSlots.push(dashboardItem);
  if (reportsItem) {
    bottomSlots.push(reportsItem);
  } else if (middleItems[0]) {
    bottomSlots.push(middleItems[0]);
  }
  // Always include a "more" slot if there are leftover items
  const usedTos = new Set(bottomSlots.map((s) => ("to" in s ? s.to : "")));
  const leftover = items.filter((i) => !usedTos.has(i.to) && i.to !== "/my-profile");
  if (leftover.length > 0) {
    bottomSlots.push({ isMore: true });
  } else if (middleItems[1] && !reportsItem) {
    bottomSlots.push(middleItems[1]);
  } else if (middleItems[0] && reportsItem && !usedTos.has(middleItems[0].to)) {
    bottomSlots.push(middleItems[0]);
  }
  bottomSlots.push(profileItem);

  // Ensure we never exceed 5 slots
  const finalSlots = bottomSlots.slice(0, 5);

  const handleSignOut = async () => {
    setSheetOpen(false);
    await signOut();
    void router.navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── desktop sidebar (≥ lg) ───────────────────────────────────────── */}
      <aside className="glass fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-border/40 lg:block">
        <SidebarNav
          items={items}
          primaryRole={primaryRole}
          profile={profile}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* ── mobile top bar (fixed) ───────────────────────────────────────── */}
      <header
        className="glass safe-top fixed inset-x-0 top-0 z-30 border-b border-border/40 lg:hidden"
        style={{ paddingBottom: "8px" }}
      >
        <div className="flex h-14 items-center gap-2 px-4">
          {/* Hamburger / brand */}
          <button
            onClick={() => setSheetOpen(true)}
            className="grid size-9 place-items-center rounded-xl bg-secondary/40 text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground active:scale-95"
            aria-label="Open menu"
          >
            <Settings2 className="size-4.5" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-primary/90 to-emerald-500/80 shadow-sm shadow-primary/20">
              <Building2 className="size-3.5 text-background" />
            </span>
            <span className="font-display text-sm font-bold text-gradient">Billzo</span>
          </Link>

          <div className="flex-1" />

          {/* Role pill */}
          <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {labelize(primaryRole)}
          </span>

          {/* Avatar shortcut */}
          <Link
            to="/my-profile"
            className="grid size-9 place-items-center overflow-hidden rounded-full ring-2 ring-primary/20 ring-offset-1 ring-offset-background active:scale-95"
          >
            <Avatar className="size-full">
              <AvatarFallback className="bg-primary/20 text-[10px] font-bold text-primary">
                {initials(profile?.full_name ?? profile?.email)}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* ── mobile sheet menu (the "more" drawer) ────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[300px] border-border/40 bg-sidebar/95 p-0">
          <SheetHeader className="px-4 pt-4">
            <SheetTitle className="text-left text-base font-semibold">Menu</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-3rem)]">
            <SidebarNav
              items={items}
              primaryRole={primaryRole}
              profile={profile}
              onNavigate={() => setSheetOpen(false)}
              onSignOut={handleSignOut}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── desktop top bar (sticky, inside main column) ────────────────── */}
      <div className="lg:pl-[260px]">
        <header className="glass sticky top-0 z-30 hidden items-center gap-3 border-b border-border/40 px-8 py-3 lg:flex">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Home className="size-3.5" />
            <span>Billzo</span>
            <ChevronRight className="size-3 text-muted-foreground/40" />
            <span className="font-medium text-foreground">{labelize(primaryRole)} workspace</span>
          </div>
          <div className="flex-1" />
          <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {labelize(primaryRole)}
          </span>
        </header>

        {/* ── main content area ────────────────────────────────────────────
         * Mobile: pt-14 (header height) + pb-24 (bottom tab bar height)
         * Desktop: pt-0 (sticky header is in-flow) + pb-8
         */}
        <main
          className="surface-grid min-h-screen px-4 pt-14 pb-28 sm:px-5 lg:px-8 lg:pt-6 lg:pb-10"
        >
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* ── mobile bottom tab bar (banking-app style) ──────────────────────
       * Fixed floating bar, 4-5 evenly-spaced slots, raised icon for active.
       */}
      <nav
        className="glass safe-bottom shadow-bar fixed inset-x-0 bottom-0 z-40 border-t border-border/40 lg:hidden"
        style={{ paddingTop: "6px" }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
          {finalSlots.map((slot, idx) => {
            if ("isMore" in slot) {
              return (
                <button
                  key={`more-${idx}`}
                  onClick={() => setSheetOpen(true)}
                  className="group relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-muted-foreground transition-colors active:scale-95"
                  aria-label="More"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-secondary/40 transition-all duration-200 group-active:bg-primary/15 group-active:text-primary">
                    <Settings2 className="size-4.5" />
                  </span>
                  <span className="text-[9px] font-semibold leading-none tracking-wide">More</span>
                </button>
              );
            }
            const item = slot;
            return (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "is-active" }}
                className="group relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-muted-foreground transition-colors active:scale-95"
              >
                {/* active top pill */}
                <span className="absolute -top-[6px] h-0.5 w-8 rounded-full bg-primary opacity-0 transition-opacity duration-200 [.is-active_&]:opacity-100" />
                <span className="grid size-9 place-items-center rounded-xl bg-transparent transition-all duration-200 group-hover:bg-secondary/40 [.is-active_&]:bg-primary/15 [.is-active_&]:text-primary">
                  <item.icon className="size-4.5 transition-transform duration-200 group-active:scale-90 [.is-active_&]:scale-110" />
                </span>
                <span className="text-[9px] font-semibold leading-none tracking-wide [.is-active_&]:text-primary">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
